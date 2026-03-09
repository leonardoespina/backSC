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
    Dependencia,
    Subdependencia,
    Vehiculo,
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
        id_usuario_pcp,
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

    return await paginate(CierreTurno, query, {
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
            ["fecha_lote", "DESC"],
            ["hora_inicio_lote", "DESC"],
        ],
    });
};


// ─────────────────────────────────────────────────────────────────────────────
// REPORTE FINAL POR TURNO
// ─────────────────────────────────────────────────────────────────────────────

exports.generarReporteTurno = async (id_cierre) => {
    const cierre = await CierreTurno.findByPk(id_cierre, {
        include: [
            { model: Llenadero, as: "Llenadero" },
            { model: Usuario, as: "Almacenista", attributes: ["nombre", "apellido"] },
            {
                model: CierreTurnoMedicion,
                as: "Mediciones",
                include: [
                    { model: Tanque, as: "Tanque", attributes: ["id_tanque", "codigo", "nombre"] },
                    { model: MedicionTanque, as: "MedicionCierre", attributes: ["volumen_real"] },
                ],
            },
            {
                model: Solicitud,
                as: "Solicitudes",
                where: { estado: "FINALIZADA" },
                required: false,
                include: [
                    { model: Usuario, as: "Solicitante", attributes: ["nombre", "apellido"] },
                    { model: Usuario, as: "Almacenista", attributes: ["nombre", "apellido"] },
                    { model: Usuario, as: "Validador", attributes: ["nombre", "apellido"] },
                    { model: Dependencia, as: "Dependencia", attributes: ["nombre_dependencia"] },
                    { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
                ],
            },
        ],
    });

    if (!cierre) throw new Error("Cierre no encontrado.");

    // ── Obtener TODOS los tanques activos del llenadero ──────────────────────
    const todosLosTanques = await Tanque.findAll({
        where: { id_llenadero: cierre.id_llenadero, estado: "ACTIVO" },
        attributes: ["id_tanque", "codigo", "nombre", "nivel_actual"],
        include: [{ model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] }],
        order: [["codigo", "ASC"]],
    });

    // Mapa de tanques medidos en el cierre (id_tanque → volumen_real)
    const medicionFinalMap = {};
    for (const med of cierre.Mediciones) {
        if (med.MedicionCierre?.volumen_real != null) {
            medicionFinalMap[med.id_tanque] = parseFloat(med.MedicionCierre.volumen_real);
        }
    }

    // Inicializar stockMap:
    //  - Tanques con medición de cierre → volumen_real (stock final real)
    //  - Tanques sin medición → nivel_actual (se usará como referencia estable)
    const stockMap = {};
    for (const t of todosLosTanques) {
        stockMap[t.id_tanque] =
            medicionFinalMap[t.id_tanque] ?? parseFloat(t.nivel_actual || 0);
    }


    // Obtener movimientos de cisterna asociados a este turno
    const movimientosCisterna = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "RECEPCION_CISTERNA" }
    });

    const solicitudesOrdenadas = (cierre.Solicitudes || []).map(sol => ({
        tipo: 'DESPACHO',
        fecha: sol.fecha_validacion ? new Date(sol.fecha_validacion) : new Date(sol.createdAt || 0),
        data: sol
    }));

    const cisternasOrdenadas = movimientosCisterna.map(mov => ({
        tipo: 'CISTERNA',
        fecha: mov.fecha_movimiento ? new Date(mov.fecha_movimiento) : new Date(mov.createdAt || 0),
        data: mov
    }));

    const eventosTurno = [...solicitudesOrdenadas, ...cisternasOrdenadas].sort((a, b) => a.fecha - b.fecha);

    const filas = [];
    let item = 1;

    // Reconstruir el stock después de cada despacho usando MovimientoInventario
    // Cargamos todos los movimientos DESPACHO del cierre de una vez (optimización)
    const movimientosDespacho = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "DESPACHO" }
    });
    const movMap = {};
    for (const m of movimientosDespacho) {
        movMap[m.id_referencia] = m;
    }

    // Reconstruir stock en orden cronológico
    const stockInicial = { ...stockMap };
    for (const evento of [...eventosTurno]) {
        if (evento.tipo === 'DESPACHO') {
            const sol = evento.data;
            let id_tanque_afectado = null;
            let combustible_despacho = "Sin Especificar";

            const mov = movMap[sol.id_solicitud];
            if (mov) {
                id_tanque_afectado = mov.id_tanque;
            } else {
                const tanqueFallback = todosLosTanques.find((t) => t.id_tipo_combustible === sol.id_tipo_combustible);
                if (tanqueFallback) id_tanque_afectado = tanqueFallback.id_tanque;
            }

            if (id_tanque_afectado) {
                const tanque = todosLosTanques.find((t) => t.id_tanque === id_tanque_afectado);
                if (tanque) combustible_despacho = tanque.TipoCombustible?.nombre || "Sin Especificar";
                // En reversa, un despacho RESTÓ stock en la vida real, por ende SUMAMOS para llegar al origen.
                stockInicial[id_tanque_afectado] = (stockInicial[id_tanque_afectado] || 0) + parseFloat(sol.cantidad_despachada || 0);
            }

            sol._tanque_afectado = id_tanque_afectado;
            sol._combustible_despacho = combustible_despacho;
        } else if (evento.tipo === 'CISTERNA') {
            const mov = evento.data;
            const id_tanque_afectado = mov.id_tanque;

            const tanque = todosLosTanques.find((t) => t.id_tanque === id_tanque_afectado);
            mov._combustible_despacho = tanque?.TipoCombustible?.nombre || "Sin Especificar";
            mov._cantidadIngresada = parseFloat(mov.variacion || (mov.volumen_despues - mov.volumen_antes) || 0);

            // En reversa, una cisterna SUMÓ stock en la vida real, por ende RESTAMOS para llegar al origen.
            stockInicial[id_tanque_afectado] = (stockInicial[id_tanque_afectado] || 0) - mov._cantidadIngresada;
        }
    }

    // Iteramos Hacia adelante ahora para mostrar la cascada
    const stockProgresivo = { ...stockInicial };

    for (const evento of eventosTurno) {
        const stockPorTanque = {};
        let stockTotal = 0;

        if (evento.tipo === 'DESPACHO') {
            const sol = evento.data;
            if (sol._tanque_afectado) {
                stockProgresivo[sol._tanque_afectado] = (stockProgresivo[sol._tanque_afectado] || 0) - parseFloat(sol.cantidad_despachada || 0);
            }

            for (const tanque of todosLosTanques) {
                const nivel = stockProgresivo[tanque.id_tanque] ?? 0;
                stockPorTanque[tanque.codigo] = parseFloat(nivel.toFixed(2));
                stockTotal += nivel;
            }

            filas.push({
                es_ingreso: false,
                combustible_despacho: sol._combustible_despacho,
                item: item++,
                fecha: evento.fecha.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
                nombre_apellido: `${sol.Solicitante?.nombre || ""} ${sol.Solicitante?.apellido || ""}`.trim(),
                vehiculo: `${sol.marca || ""} ${sol.modelo || ""}`.trim(),
                placa: sol.placa,
                dependencia: sol.Dependencia?.nombre_dependencia || "",
                subdependencia: sol.Subdependencia?.nombre || "",
                cant_solicitada: parseFloat(sol.cantidad_litros || 0),
                cant_despachada: parseFloat(sol.cantidad_despachada || 0),
                stock_tanques: stockPorTanque,
                stock_total: parseFloat(stockTotal.toFixed(2)),
                almacen: sol.Almacenista ? `${sol.Almacenista.nombre} ${sol.Almacenista.apellido}` : "",
                pcp: sol.Validador ? `${sol.Validador.nombre} ${sol.Validador.apellido}` : "",
            });
        } else if (evento.tipo === 'CISTERNA') {
            const mov = evento.data;
            stockProgresivo[mov.id_tanque] = (stockProgresivo[mov.id_tanque] || 0) + mov._cantidadIngresada;

            for (const tanque of todosLosTanques) {
                const nivel = stockProgresivo[tanque.id_tanque] ?? 0;
                stockPorTanque[tanque.codigo] = parseFloat(nivel.toFixed(2));
                stockTotal += nivel;
            }

            const placaCisterna = mov.observaciones ? (mov.observaciones.split("Placa: ")[1]?.split(" ")[0] || "S/I") : "S/I";

            filas.push({
                es_ingreso: true,
                combustible_despacho: mov._combustible_despacho,
                item: item++,
                fecha: evento.fecha.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
                nombre_apellido: "RECEPCIÓN CISTERNA",
                vehiculo: "GANDOLA",
                placa: placaCisterna,
                dependencia: "DESCARGA COMBUSTIBLE",
                subdependencia: "ALMACENAJE CENTRAL",
                cant_solicitada: mov._cantidadIngresada, // Para que muestre algo visualmente sin romper
                cant_despachada: mov._cantidadIngresada,
                stock_tanques: stockPorTanque,
                stock_total: parseFloat(stockTotal.toFixed(2)),
                almacen: "Sistema",
                pcp: "Aprobado Automáticamente",
            });
        }
    }

    return {
        encabezado: {
            llenadero: cierre.Llenadero?.nombre_llenadero,
            turno: cierre.turno,
            fecha_lote: cierre.fecha_lote,
            hora_inicio: cierre.hora_inicio_lote,
            hora_cierre: cierre.hora_cierre_lote,
            almacenista: cierre.Almacenista
                ? `${cierre.Almacenista.nombre} ${cierre.Almacenista.apellido}`
                : "",
            tanques: todosLosTanques.map((t) => {
                const medDet = cierre.Mediciones.find((m) => m.id_tanque === t.id_tanque);
                return {
                    id_tanque: t.id_tanque,
                    codigo: t.codigo,
                    nombre: t.nombre,
                    combustible: t.TipoCombustible?.nombre || "Sin Especificar",
                    stock_inicial: stockInicial[t.id_tanque] ?? null,
                    // Para tanques sin medición de cierre, usar nivel_actual como stock final de referencia
                    stock_final: medDet?.MedicionCierre?.volumen_real ?? parseFloat(t.nivel_actual || 0),
                };
            }),
        },
        filas,
    };
};

/**
 * Genera la estructura de datos para el Acta de PCP (ActaViewerDialog).
 * Clasifica consumos por tipo de unidad (Planta, Generador, Vehículo).
 */
exports.generarActaTurno = async (id_cierre) => {
    const cierre = await CierreTurno.findByPk(id_cierre, {
        include: [
            { model: Llenadero, as: "Llenadero" },
            { model: Usuario, as: "Almacenista", attributes: ["nombre", "apellido", "cedula"] },
            { model: Usuario, as: "ValidadorPCP", attributes: ["nombre", "apellido", "cedula"] },
            {
                model: Solicitud,
                as: "Solicitudes",
                where: { estado: "FINALIZADA" },
                required: false,
                include: [
                    {
                        model: Vehiculo,
                        attributes: ["es_generador", "es_planta"]
                    },
                    {
                        model: TipoCombustible,
                        attributes: ["nombre"]
                    }
                ]
            },
            {
                model: CierreTurnoMedicion,
                as: "Mediciones",
                include: [
                    {
                        model: Tanque,
                        as: "Tanque",
                        include: [{ model: TipoCombustible, as: "TipoCombustible" }]
                    },
                    { model: MedicionTanque, as: "MedicionCierre" }
                ]
            }
        ]
    });

    if (!cierre) throw new Error("Cierre no encontrado.");

    // 1. Clasificar consumos de las solicitudes
    let consumoPlanta = 0;
    let consumoGenerador = 0;
    let consumoVehiculosGasoil = 0;
    let consumoTotalGasoil = 0;
    let consumoTotalGasolina = 0;

    cierre.Solicitudes.forEach(sol => {
        const cant = parseFloat(sol.cantidad_despachada || 0);
        const nombreCombustible = sol.TipoCombustible?.nombre?.toUpperCase() || "";
        const isGasoil = nombreCombustible.includes("GASOIL") || nombreCombustible.includes("DIESEL");
        const isGasolina = nombreCombustible.includes("GASOLINA");

        if (sol.Vehiculo?.es_planta) {
            if (isGasoil) consumoPlanta += cant;
        } else if (sol.Vehiculo?.es_generador) {
            if (isGasoil) consumoGenerador += cant;
        } else {
            if (isGasoil) consumoVehiculosGasoil += cant;
        }

        if (isGasoil) {
            consumoTotalGasoil += cant;
        } else if (isGasolina) {
            consumoTotalGasolina += cant;
        }
    });

    // 2. Agrupar Inventarios por tipo de combustible
    const reporte = await exports.generarReporteTurno(id_cierre);
    const tanquesReporte = reporte.encabezado.tanques;

    const invGasolina = { tanques: [], saldo_inicial_total: 0, stock_total: 0, evaporizacion_total: 0, consumo_total_despachos: consumoTotalGasolina };
    const invGasoil = { tanques: [], saldo_inicial_total: 0, stock_total: 0 };

    tanquesReporte.forEach(repT => {
        const comb = repT.combustible?.toUpperCase() || "";

        // Buscar medición real si existe para este tanque
        const medicionReal = cierre.Mediciones.find(m => m.id_tanque === repT.id_tanque);
        const evaporacionTanque = parseFloat(medicionReal?.MedicionCierre?.merma_evaporacion || 0);

        const infoActa = {
            nombre: repT.codigo,
            nivel_final: parseFloat(repT.stock_final || 0),
            nivel_inicial: parseFloat(repT.stock_inicial || 0),
            evaporizacion: evaporacionTanque,
            es_principal: false
        };

        if (comb.includes("GASOLINA")) {
            invGasolina.tanques.push(infoActa);
            invGasolina.saldo_inicial_total += infoActa.nivel_inicial;
            invGasolina.stock_total += infoActa.nivel_final;
        } else {
            invGasoil.tanques.push(infoActa);
            invGasoil.saldo_inicial_total += infoActa.nivel_inicial;
            invGasoil.stock_total += infoActa.nivel_final;
        }
    });

    const cisternasDuranteTurno = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "RECEPCION_CISTERNA" }
    });

    let observacionAuto = "";
    if (cisternasDuranteTurno && cisternasDuranteTurno.length > 0) {
        const totalCisterna = cisternasDuranteTurno.reduce((acc, mov) => acc + parseFloat(mov.variacion || 0), 0);
        observacionAuto += `Se registró ingreso de cisterna por un total de ${totalCisterna} L. `;
    }

    let totalEvaporacion = 0;
    cierre.Mediciones.forEach(m => {
        totalEvaporacion += parseFloat(m.MedicionCierre?.merma_evaporacion || 0);
    });

    if (totalEvaporacion > 0) {
        observacionAuto += `Se registró una evaporación total de ${totalEvaporacion.toFixed(2)} L. `;
    }

    return {
        datos_generales: {
            llenadero: cierre.Llenadero?.nombre_llenadero || "Sin Especificar",
            turno: cierre.turno,
            inspector_servicio: cierre.ValidadorPCP
                ? `${cierre.ValidadorPCP.nombre} ${cierre.ValidadorPCP.apellido}`
                : "PENDIENTE POR FIRMA",
            fecha_cierre: cierre.fecha_lote + " " + (cierre.hora_cierre_lote || "00:00:00")
        },
        seccion_principal: {
            nivel_inicio: tanquesReporte.reduce((s, rt) => s + rt.stock_inicial, 0),
            consumo_planta: consumoPlanta,
            total_disponible: invGasoil.stock_total,
            consumo_total_despachos: consumoVehiculosGasoil, // En el componente se usa como "consumoVehiculosNeto"
            desglose_consumo: JSON.stringify({
                generadores: consumoGenerador,
                usuario: cierre.ValidadorPCP,
                almacenista: cierre.Almacenista
            })
        },
        inventario_gasolina: invGasolina,
        inventario_gasoil: invGasoil,
        observacion: (observacionAuto + (cierre.observaciones || "")).trim()
    };
};

