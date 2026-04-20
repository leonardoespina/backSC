const {
    CierreTurno,
    CierreTurnoMedicion,
    MovimientoInventario,
    MedicionTanque,
    Solicitud,
    Tanque,
    TipoCombustible,
    Llenadero,
    Usuario,
} = require("../../models");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { paginate } = require("../../helpers/paginationHelper");
const { Op } = require("sequelize");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el último nivel registrado en un cierre para un tanque.
 * Si no existe cierre previo, devuelve el nivel_actual del tanque.
 */
exports.obtenerUltimoNivel = async (id_tanque) => {
    const tanque = await Tanque.findByPk(id_tanque, {
        include: [{ model: TipoCombustible, as: "TipoCombustible" }],
    });
    if (!tanque) throw new Error("Tanque no encontrado.");

    const ultimaMedicion = await MedicionTanque.findOne({
        where: { id_tanque, tipo_medicion: "CIERRE" },
        order: [
            ["fecha_medicion", "DESC"],
            ["hora_medicion", "DESC"],
        ],
    });

    return {
        id_tanque: tanque.id_tanque,
        codigo: tanque.codigo,
        nombre: tanque.nombre,
        tipo_tanque: tanque.tipo_tanque,
        unidad_medida: tanque.unidad_medida,
        largo: tanque.largo,
        ancho: tanque.ancho,
        alto: tanque.alto,
        radio: tanque.radio,
        con_aforo: tanque.con_aforo,
        aforo: tanque.aforo ?? null,
        tabla_aforo: tanque.aforo ?? null,  // alias para compatibilidad
        nivel_actual: parseFloat(tanque.nivel_actual),
        combustible: tanque.TipoCombustible?.nombre,
        id_tipo_combustible: tanque.id_tipo_combustible,
        ultimo_cierre: ultimaMedicion
            ? {
                volumen_real: parseFloat(ultimaMedicion.volumen_real),
                fecha: ultimaMedicion.fecha_medicion,
                hora: ultimaMedicion.hora_medicion,
            }
            : null,
    };
};


/**
 * Devuelve los tanques activos para despacho de un llenadero
 * con su último nivel de cierre incluido.
 */
exports.obtenerTanquesLlenaderoConNivel = async (id_llenadero) => {
    const tanques = await Tanque.findAll({
        where: { id_llenadero, estado: "ACTIVO" },
        include: [{ model: TipoCombustible, as: "TipoCombustible" }],
        order: [["codigo", "ASC"]],
    });

    return await Promise.all(
        tanques.map((t) => exports.obtenerUltimoNivel(t.id_tanque))
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR CIERRE (operación única)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el cierre de turno en un solo paso:
 *  1. Crea CierreTurno en estado CERRADO
 *  2. Por cada tanque: crea MedicionTanque tipo=CIERRE, recalibra nivel_actual,
 *     registra MovimientoInventario tipo=AJUSTE_MEDICION
 *  3. Asigna todas las Solicitudes FINALIZADA pendientes del llenadero
 *  4. Asigna todos los MovimientoInventario pendientes del llenadero
 *
 * @param {Object} data
 * @param {Object} user - req.usuario
 * @param {string} clientIp
 */
exports.generarCierre = async (data, user, clientIp) => {
    const { id_usuario } = user;
    const {
        id_llenadero,
        turno,
        fecha_lote,
        hora_inicio_lote,
        hora_cierre_lote,
        observaciones,
        mediciones, // [{ id_tanque, id_tipo_combustible, medida_vara, volumen_real }]
    } = data;

    if (!mediciones || mediciones.length === 0) {
        throw new Error("Debe incluir al menos una medición de tanque.");
    }

    return await executeTransaction(clientIp, async (t) => {
        // 0. Validación Anti-Cierre Vacío: Verificar si hay operaciones pendientes
        const qSolicitudesPendientes = await Solicitud.count({
            where: {
                id_cierre_turno: null,
                id_llenadero,
                estado: "FINALIZADA"
            },
            transaction: t
        });

        const tanquesLlenadero = await Tanque.findAll({
            where: { id_llenadero },
            attributes: ["id_tanque"],
            transaction: t,
        });
        const idsTanques = tanquesLlenadero.map((tk) => tk.id_tanque);

        const qMovimientosPendientes = await MovimientoInventario.count({
            where: {
                id_cierre_turno: null,
                id_tanque: { [Op.in]: idsTanques }
            },
            transaction: t
        });

        if (qSolicitudesPendientes === 0 && qMovimientosPendientes === 0) {
            const error = new Error("No se puede generar un cierre en blanco. No existen despachos ni operaciones de inventario pendientes en este surtidor.");
            error.statusCode = 400; // Opcional, dependiendo de la configuración de tu manejador de errores backend
            throw error;
        }

        // 1. Buscar una solicitud finalizada pendiente de cierre para obtener su PCP (id_validador)
        const solicitudConValidador = await Solicitud.findOne({
            where: {
                id_cierre_turno: null,
                id_llenadero,
                estado: "FINALIZADA",
                id_validador: { [Op.not]: null } // Que tenga un validador registrado
            },
            order: [["fecha_despacho", "DESC"]], // Tomamos el más reciente
            transaction: t,
        });

        // Este será el usuario PCP asignado automáticamente al cierre
        const pcpAutomatico = solicitudConValidador ? solicitudConValidador.id_validador : null;

        // 2. Crear CierreTurno directamente en CERRADO
        const cierre = await CierreTurno.create(
            {
                id_llenadero,
                id_usuario_almacen: id_usuario,
                id_usuario_pcp: pcpAutomatico, // <--- Automático, no viaja del frontend
                turno,
                fecha_lote,
                hora_inicio_lote,
                hora_cierre_lote,
                observaciones: observaciones || null,
                estado: "CERRADO",
            },
            { transaction: t }
        );

        // 2. Medición CIERRE por tanque + recalibrar nivel
        for (const med of mediciones) {
            const tanque = await Tanque.findByPk(med.id_tanque, {
                transaction: t,
                lock: true,
            });
            if (!tanque) continue;

            const volumen_antes = parseFloat(tanque.nivel_actual);
            const v_real = parseFloat(med.volumen_real);

            // Crear medición de cierre
            const medicionCierre = await MedicionTanque.create(
                {
                    id_tanque: med.id_tanque,
                    id_usuario,
                    fecha_medicion: fecha_lote,
                    hora_medicion: hora_cierre_lote,
                    medida_vara: med.medida_vara ?? null,
                    volumen_real: v_real,
                    volumen_teorico: volumen_antes,
                    diferencia: parseFloat((volumen_antes - v_real).toFixed(2)),
                    merma_evaporacion: med.merma_evaporacion || 0,
                    tipo_medicion: "CIERRE",
                    id_cierre_turno: cierre.id_cierre,
                    estado: "PROCESADO",
                },
                { transaction: t }
            );

            // Recalibrar nivel_actual del tanque
            await tanque.update({ nivel_actual: v_real }, { transaction: t });

            // Movimiento de ajuste por recalibración
            await MovimientoInventario.create(
                {
                    id_tanque: med.id_tanque,
                    id_cierre_turno: cierre.id_cierre,
                    tipo_movimiento: "AJUSTE_MEDICION",
                    id_referencia: medicionCierre.id_medicion,
                    tabla_referencia: "mediciones_tanque",
                    volumen_antes,
                    volumen_despues: v_real,
                    variacion: parseFloat((v_real - volumen_antes).toFixed(2)),
                    fecha_movimiento: new Date(),
                    id_usuario,
                    observaciones: `Cierre de turno #${cierre.id_cierre}`,
                },
                { transaction: t }
            );

            // Detalle en CierreTurnoMedicion
            await CierreTurnoMedicion.create(
                {
                    id_cierre: cierre.id_cierre,
                    id_tanque: med.id_tanque,
                    id_tipo_combustible:
                        med.id_tipo_combustible || tanque.id_tipo_combustible,
                    id_medicion_inicial: null,
                    id_medicion_cierre: medicionCierre.id_medicion,
                },
                { transaction: t }
            );
        }

        // 3. (idsTanques ya fueron obtenidos al inicio de la transacción para la validación anti-cierre vacío)

        // 4. Asignar MovimientoInventario pendientes del llenadero a este cierre
        await MovimientoInventario.update(
            { id_cierre_turno: cierre.id_cierre },
            {
                where: {
                    id_cierre_turno: null,
                    id_tanque: { [Op.in]: idsTanques },
                },
                transaction: t,
            }
        );

        // 5. Asignar Solicitudes FINALIZADA pendientes del llenadero a este cierre
        await Solicitud.update(
            { id_cierre_turno: cierre.id_cierre },
            {
                where: {
                    id_cierre_turno: null,
                    id_llenadero,
                    estado: "FINALIZADA",
                },
                transaction: t,
            }
        );

        return cierre;
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtener un cierre por ID con detalle de mediciones.
 */
exports.obtenerCierre = async (id_cierre) => {
    return await CierreTurno.findByPk(id_cierre, {
        include: [
            { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
            { model: Usuario, as: "Almacenista", attributes: ["nombre", "apellido"] },
            { model: Usuario, as: "ValidadorPCP", attributes: ["nombre", "apellido"] },
            {
                model: CierreTurnoMedicion,
                as: "Mediciones",
                include: [
                    {
                        model: Tanque,
                        as: "Tanque",
                        attributes: ["codigo", "nombre", "unidad_medida"],
                        include: [{ model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] }]
                    },
                    {
                        model: MedicionTanque,
                        as: "MedicionCierre",
                        attributes: ["volumen_real", "volumen_teorico", "medida_vara", "diferencia", "merma_evaporacion", "hora_medicion"],
                    },
                ],
            },
        ],
    });
};

/**
 * Listado paginado de cierres de turno.
 */
exports.listarCierres = async (query) => {
    const { id_llenadero, estado, fecha_inicio, fecha_fin } = query;
    const where = {};

    if (id_llenadero) where.id_llenadero = id_llenadero;
    if (estado) where.estado = estado;
    if (fecha_inicio && fecha_fin) {
        where.fecha_lote = { [Op.between]: [fecha_inicio, fecha_fin] };
    }

    const pagedResult = await paginate(CierreTurno, query, {
        where,
        searchableFields: ["observaciones"],
        include: [
            { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
            { model: Usuario, as: "Almacenista", attributes: ["nombre", "apellido"] },
            {
                model: Solicitud,
                as: "Solicitudes",
                attributes: ["id_solicitud", "cantidad_despachada"],
                where: { estado: "FINALIZADA" },
                required: false,
            },
        ],
        order: [
            ["id_cierre", "DESC"],
        ],
    });

    if (pagedResult && pagedResult.data && pagedResult.data.length > 0) {
        const idsLlenaderos = [...new Set(pagedResult.data.map(c => c.id_llenadero))];
        const ultimosCierres = {};

        for (const idLoc of idsLlenaderos) {
            const u = await CierreTurno.findOne({
                where: { id_llenadero: idLoc, estado: "CERRADO" },
                order: [["id_cierre", "DESC"]],
                attributes: ["id_cierre"]
            });
            ultimosCierres[idLoc] = u ? u.id_cierre : null;
        }

        pagedResult.data = pagedResult.data.map(cierre => {
            const item = cierre.toJSON ? cierre.toJSON() : cierre;
            const isLast = ultimosCierres[item.id_llenadero] === item.id_cierre;
            return { ...item, can_revert: !!isLast };
        });
    }

    return pagedResult;
};


/**
 * Revertir Cierre de Turno
 *
 * Condiciones requeridas:
 *  a) El cierre debe estar en estado "CERRADO"
 *  b) Debe ser el ÚLTIMO cierre del llenadero
 *  c) Por cada tanque medido, el último movimiento del ledger debe ser
 *     el AJUSTE_MEDICION de este cierre (Regla de Oro)
 *
 * Acción atómica:
 *  1. Desvincula Solicitudes → id_cierre_turno = NULL
 *  2. Desvincula movimientos de despacho/cisterna → id_cierre_turno = NULL
 *  3. Por cada tanque: restaura nivel, anula MedicionTanque, destruye el ajuste
 *  4. Marca CierreTurno → estado "ANULADO"
 */
exports.revertirCierre = async (id_cierre, clientIp) => {
    return await executeTransaction(clientIp, async (t) => {
        // 1. Cargar el cierre con sus mediciones detalladas
        const cierre = await CierreTurno.findByPk(id_cierre, {
            include: [
                {
                    model: CierreTurnoMedicion,
                    as: "Mediciones",
                    include: [
                        {
                            model: MedicionTanque,
                            as: "MedicionCierre",
                            attributes: ["id_medicion", "estado", "tipo_medicion", "id_tanque"],
                        },
                    ],
                },
            ],
            transaction: t,
        });

        if (!cierre) {
            const err = new Error("Cierre de turno no encontrado.");
            err.statusCode = 404;
            throw err;
        }
        if (cierre.estado === "ANULADO") {
            const err = new Error("El cierre de turno ya se encuentra anulado.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Verificar que sea el ÚLTIMO cierre del llenadero
        const ultimoCierre = await CierreTurno.findOne({
            where: { id_llenadero: cierre.id_llenadero, estado: "CERRADO" },
            order: [["id_cierre", "DESC"]],
            transaction: t,
        });

        if (!ultimoCierre || ultimoCierre.id_cierre !== cierre.id_cierre) {
            const err = new Error(
                `No se puede revertir. Existen cierres posteriores para este llenadero. ` +
                    `Debe revertir el cierre #${ultimoCierre?.id_cierre} primero.`
            );
            err.statusCode = 409;
            throw err;
        }

        // 3. Validar la Regla de Oro por cada tanque medido en el cierre
        const ajustesACancelar = [];
        for (const detalleMedicion of cierre.Mediciones) {
            const ultimoMovimiento = await MovimientoInventario.findOne({
                where: { id_tanque: detalleMedicion.id_tanque },
                order: [["id_movimiento", "DESC"]],
                transaction: t,
            });

            if (
                !ultimoMovimiento ||
                ultimoMovimiento.id_cierre_turno !== cierre.id_cierre ||
                ultimoMovimiento.tipo_movimiento !== "AJUSTE_MEDICION"
            ) {
                const err = new Error(
                    `No se puede revertir. El Tanque ID ${detalleMedicion.id_tanque} tiene ` +
                        `movimientos de inventario posteriores al cierre. Revierte esas operaciones primero.`
                );
                err.statusCode = 409;
                throw err;
            }
            ajustesACancelar.push({ detalleMedicion, ajuste: ultimoMovimiento });
        }

        // 4. Desvincular Solicitudes del cierre (quedan pendientes de reasignación)
        await Solicitud.update(
            { id_cierre_turno: null },
            { where: { id_cierre_turno: id_cierre }, transaction: t }
        );

        // 5. Desvincular movimientos de despacho/cisterna (excluye AJUSTE_MEDICION que se destruyen)
        await MovimientoInventario.update(
            { id_cierre_turno: null },
            {
                where: {
                    id_cierre_turno: id_cierre,
                    tipo_movimiento: { [Op.ne]: "AJUSTE_MEDICION" },
                },
                transaction: t,
            }
        );

        // 6. Por cada tanque medido: restaurar nivel, anular medición y limpiar ledger
        const tanquesRestaurados = [];
        for (const { detalleMedicion, ajuste } of ajustesACancelar) {
            const tanque = await Tanque.findByPk(detalleMedicion.id_tanque, {
                transaction: t,
                lock: true,
            });
            const nivelRestaurado = parseFloat(ajuste.volumen_antes);
            await tanque.update({ nivel_actual: nivelRestaurado }, { transaction: t });

            if (detalleMedicion.MedicionCierre) {
                await MedicionTanque.update(
                    { estado: "ANULADO" },
                    {
                        where: { id_medicion: detalleMedicion.MedicionCierre.id_medicion },
                        transaction: t,
                    }
                );
            }

            await ajuste.destroy({ transaction: t });
            tanquesRestaurados.push({ id_tanque: detalleMedicion.id_tanque, nivelRestaurado });
        }

        // 7. Marcar el cierre como ANULADO
        await cierre.update({ estado: "ANULADO" }, { transaction: t });

        return { cierre, tanquesRestaurados };
    });
};


