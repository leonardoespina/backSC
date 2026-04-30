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

    const transferenciasSalidas = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "TRANSFERENCIA_SALIDA" }
    });

    const transferenciasEntradas = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "TRANSFERENCIA_ENTRADA" }
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

    const salidasOrdenadas = transferenciasSalidas.map(mov => ({
        tipo: 'TRANSFERENCIA_SALIDA',
        fecha: mov.fecha_movimiento ? new Date(mov.fecha_movimiento) : new Date(mov.createdAt || 0),
        data: mov
    }));

    const entradasOrdenadas = transferenciasEntradas.map(mov => ({
        tipo: 'TRANSFERENCIA_ENTRADA',
        fecha: mov.fecha_movimiento ? new Date(mov.fecha_movimiento) : new Date(mov.createdAt || 0),
        data: mov
    }));

    const eventosTurno = [
        ...solicitudesOrdenadas, 
        ...cisternasOrdenadas, 
        ...salidasOrdenadas, 
        ...entradasOrdenadas
    ].sort((a, b) => a.fecha - b.fecha);

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
        } else if (evento.tipo === 'TRANSFERENCIA_SALIDA') {
            const mov = evento.data;
            const id_tanque_afectado = mov.id_tanque;
            const tanque = todosLosTanques.find((t) => t.id_tanque === id_tanque_afectado);
            mov._combustible_despacho = tanque?.TipoCombustible?.nombre || "Sin Especificar";
            mov._cantidadMovimiento = Math.abs(parseFloat(mov.variacion || (mov.volumen_despues - mov.volumen_antes) || 0));

            // En reversa, una salida RESTÓ stock en la vida real, por ende SUMAMOS para llegar al origen.
            stockInicial[id_tanque_afectado] = (stockInicial[id_tanque_afectado] || 0) + mov._cantidadMovimiento;
        } else if (evento.tipo === 'TRANSFERENCIA_ENTRADA') {
            const mov = evento.data;
            const id_tanque_afectado = mov.id_tanque;
            const tanque = todosLosTanques.find((t) => t.id_tanque === id_tanque_afectado);
            mov._combustible_despacho = tanque?.TipoCombustible?.nombre || "Sin Especificar";
            mov._cantidadMovimiento = Math.abs(parseFloat(mov.variacion || (mov.volumen_despues - mov.volumen_antes) || 0));

            // En reversa, una entrada SUMÓ stock en la vida real, por ende RESTAMOS para llegar al origen.
            stockInicial[id_tanque_afectado] = (stockInicial[id_tanque_afectado] || 0) - mov._cantidadMovimiento;
        }
    }

    // SOBRESCRIBIR stockInicial con el CIERRE ANTERIOR real (Para garantizar continuidad de la película)
    const { Op } = require("sequelize");
    const cierreAnterior = await CierreTurno.findOne({
        where: { 
            id_llenadero: cierre.id_llenadero, 
            id_cierre: { [Op.lt]: cierre.id_cierre }, 
            estado: "CERRADO" 
        },
        order: [["id_cierre", "DESC"]],
        include: [
            {
                model: CierreTurnoMedicion,
                as: "Mediciones",
                include: [{ model: MedicionTanque, as: "MedicionCierre" }]
            }
        ]
    });

    if (cierreAnterior) {
        for (const t of todosLosTanques) {
            const medAnterior = cierreAnterior.Mediciones.find(m => m.id_tanque === t.id_tanque);
            if (medAnterior && medAnterior.MedicionCierre?.volumen_real != null) {
                stockInicial[t.id_tanque] = parseFloat(medAnterior.MedicionCierre.volumen_real);
            }
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
        } else if (evento.tipo === 'TRANSFERENCIA_SALIDA') {
            const mov = evento.data;
            stockProgresivo[mov.id_tanque] = (stockProgresivo[mov.id_tanque] || 0) - mov._cantidadMovimiento;

            for (const tanque of todosLosTanques) {
                const nivel = stockProgresivo[tanque.id_tanque] ?? 0;
                stockPorTanque[tanque.codigo] = parseFloat(nivel.toFixed(2));
                stockTotal += nivel;
            }

            filas.push({
                es_ingreso: false,
                combustible_despacho: mov._combustible_despacho,
                item: item++,
                fecha: evento.fecha.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
                nombre_apellido: "TRASIEGO",
                vehiculo: "TRANSFERENCIA",
                placa: "N/A",
                dependencia: "SISTEMA INVENTARIO",
                subdependencia: "SALIDA",
                cant_solicitada: mov._cantidadMovimiento,
                cant_despachada: mov._cantidadMovimiento,
                stock_tanques: stockPorTanque,
                stock_total: parseFloat(stockTotal.toFixed(2)),
                almacen: "Sistema",
                pcp: "Aprobado Automáticamente",
            });
        } else if (evento.tipo === 'TRANSFERENCIA_ENTRADA') {
            const mov = evento.data;
            stockProgresivo[mov.id_tanque] = (stockProgresivo[mov.id_tanque] || 0) + mov._cantidadMovimiento;

            for (const tanque of todosLosTanques) {
                const nivel = stockProgresivo[tanque.id_tanque] ?? 0;
                stockPorTanque[tanque.codigo] = parseFloat(nivel.toFixed(2));
                stockTotal += nivel;
            }

            filas.push({
                es_ingreso: true,
                combustible_despacho: mov._combustible_despacho,
                item: item++,
                fecha: evento.fecha.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
                nombre_apellido: "TRASIEGO",
                vehiculo: "TRANSFERENCIA",
                placa: "N/A",
                dependencia: "SISTEMA INVENTARIO",
                subdependencia: "ENTRADA",
                cant_solicitada: mov._cantidadMovimiento,
                cant_despachada: mov._cantidadMovimiento,
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

    const transferenciasDuranteTurno = await MovimientoInventario.findAll({
        where: { id_cierre_turno: id_cierre, tipo_movimiento: "TRANSFERENCIA_SALIDA" } // Solo utilizamos salidas para no duplicar la suma de volumen total transferido
    });

    let observacionAuto = "";
    if (cisternasDuranteTurno && cisternasDuranteTurno.length > 0) {
        const totalCisterna = cisternasDuranteTurno.reduce((acc, mov) => acc + parseFloat(mov.variacion || 0), 0);
        observacionAuto += `Se registró ingreso de cisterna por un total de ${totalCisterna} L. `;
    }

    if (transferenciasDuranteTurno && transferenciasDuranteTurno.length > 0) {
        const totalTrasiego = transferenciasDuranteTurno.reduce((acc, mov) => acc + Math.abs(parseFloat(mov.variacion || 0)), 0);
        observacionAuto += `Durante el turno se contabilizaron trasiegos internos movilizando una sumatoria de ${totalTrasiego} L. `;
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
