"use strict";

const {
    Solicitud,
    Usuario,
    Vehiculo,
    Dependencia,
    Subdependencia,
    PrecioCombustible,
    Moneda,
    Marca,
    Modelo,
    TipoCombustible,
    CupoActual,
    CupoBase,
    Categoria,
} = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("sequelize");
const { paginate } = require("../../helpers/paginationHelper");

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/** Valida que un valor de query no sea vacío, "null" o "undefined". */
const isValidFilter = (val) =>
    val !== undefined && val !== null && val !== "" && val !== "null" && val !== "undefined";

/** Construye el rango de fechas ajustado a Venezuela (UTC-4). */
function buildDateRange(fecha_desde, fecha_hasta) {
    return {
        start: new Date(`${fecha_desde}T00:00:00-04:00`),
        end: new Date(`${fecha_hasta}T23:59:59.999-04:00`),
    };
}

/** Formatea los datos del vehículo según tipo_suministro. */
function formatVehiculo(solicitud) {
    if (solicitud.tipo_suministro === "BIDON") {
        return { vehiculo: "BIDÓN", placa: "NO APLICA" };
    }
    const marca = solicitud.Vehiculo?.Marca?.nombre || solicitud.marca || "";
    const modelo = solicitud.Vehiculo?.Modelo?.nombre || solicitud.modelo || "";
    return {
        vehiculo: `${marca} ${modelo}`.trim() || "Desconocido",
        placa: solicitud.Vehiculo?.placa || solicitud.placa || "S/P",
    };
}

/** Formatea una hora a "HH:MM AM/PM" en zona Venezuela. */
function formatHora(fecha) {
    if (!fecha) return "";
    return new Date(fecha).toLocaleTimeString("es-VE", {
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

// ─────────────────────────────────────────────
// REPORTE DIARIO
// ─────────────────────────────────────────────

/**
 * Genera el reporte diario de un llenadero agrupado en INSTITUCIONAL y VENTA.
 * @param {{ id_llenadero: string, fecha: string, query: object }} opts
 */
async function getReporteDiario({ id_llenadero, fecha, query }) {
    const { start, end } = buildDateRange(fecha, fecha);

    const whereBase = {
        id_llenadero,
        [Op.or]: [
            { fecha_despacho: { [Op.between]: [start, end] } },
            { [Op.and]: [{ fecha_despacho: null }, { fecha_solicitud: { [Op.between]: [start, end] } }] },
        ],
        estado: "FINALIZADA",
    };

    // Totales agrupados por Combustible y Tipo de Solicitud
    const agrupados = await Solicitud.findAll({
        where: whereBase,
        attributes: [
            "tipo_solicitud",
            [sequelize.col("TipoCombustible.nombre"), "combustible"],
            [sequelize.fn("SUM", sequelize.col("cantidad_despachada")), "total_litros"],
            [sequelize.fn("SUM", sequelize.col("monto_total")), "total_monto"]
        ],
        include: [{ model: TipoCombustible, attributes: [] }],
        group: ["tipo_solicitud", "TipoCombustible.id_tipo_combustible", "TipoCombustible.nombre"],
        raw: true
    });

    const totalesPorCombustible = {};
    let totalInstitucional = 0;
    let totalVentaLitros = 0;
    let totalVentaMonto = 0;

    agrupados.forEach(row => {
        const tipoCombs = row.combustible || "S/I";
        const litros = parseFloat(row.total_litros) || 0;
        const monto = parseFloat(row.total_monto) || 0;

        if (!totalesPorCombustible[tipoCombs]) {
            totalesPorCombustible[tipoCombs] = { institucional: 0, venta: 0, total: 0 };
        }

        if (row.tipo_solicitud === "INSTITUCIONAL") {
            totalesPorCombustible[tipoCombs].institucional += litros;
            totalInstitucional += litros;
        } else if (row.tipo_solicitud === "VENTA") {
            totalesPorCombustible[tipoCombs].venta += litros;
            totalVentaLitros += litros;
            totalVentaMonto += monto;
        }
        totalesPorCombustible[tipoCombs].total += litros;
    });

    const result = await paginate(Solicitud, query, {
        where: whereBase,
        include: [
            { model: Usuario, as: "Solicitante", attributes: ["nombre", "apellido"] },
            {
                model: Vehiculo, required: false, attributes: ["placa"],
                include: [
                    { model: Marca, as: "Marca", attributes: ["nombre"] },
                    { model: Modelo, as: "Modelo", attributes: ["nombre"] },
                ],
            },
            { model: Dependencia, as: "Dependencia", attributes: ["nombre_dependencia"] },
            { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
            {
                model: PrecioCombustible, as: "PrecioCombustible", attributes: ["precio", "id_moneda"],
                include: [{ model: Moneda, as: "Moneda", attributes: ["nombre", "simbolo"] }],
            },
            { model: TipoCombustible, attributes: ["nombre"] },
        ],
        attributes: [
            "id_solicitud", "codigo_ticket", "fecha_validacion",
            "cantidad_litros", "cantidad_despachada", "monto_total",
            "precio_unitario", "tipo_solicitud", "tipo_suministro", "placa", "marca", "modelo",
        ],
        order: [["id_solicitud", "ASC"]],
    });

    const institucionalData = result.data.filter((s) => s.tipo_solicitud === "INSTITUCIONAL");
    const ventasData = result.data.filter((s) => s.tipo_solicitud === "VENTA");

    const saldosPorMoneda = {};

    const ventasMapped = ventasData.map((v) => {
        const cant_solic = parseFloat(v.cantidad_litros || 0);
        const cant_desp = parseFloat(v.cantidad_despachada || 0);
        const precio = parseFloat(v.PrecioCombustible?.precio || v.precio_unitario || 0);
        const simbolo = v.PrecioCombustible?.Moneda?.simbolo || (v.id_precio ? "N/A" : "$");

        const saldo_favor = cant_desp < cant_solic ? (cant_solic - cant_desp) * precio : 0;
        if (saldo_favor > 0) {
            saldosPorMoneda[simbolo] = (saldosPorMoneda[simbolo] || 0) + saldo_favor;
        }

        return {
            id_solicitud: v.id_solicitud,
            codigo_ticket: v.codigo_ticket,
            fecha: v.fecha_validacion,
            hora: formatHora(v.fecha_validacion),
            solicitante: `${v.Solicitante?.nombre} ${v.Solicitante?.apellido}`,
            ...formatVehiculo(v),
            dependencia: v.Dependencia?.nombre_dependencia,
            subdependencia: v.Subdependencia?.nombre,
            cant_solic: v.cantidad_litros,
            cant_desp: v.cantidad_despachada,
            tipo_combustible: v.TipoCombustible?.nombre || "S/I",
            precio: v.PrecioCombustible?.precio || v.precio_unitario,
            total_pagar: v.monto_total,
            moneda: simbolo,
            saldo_favor: saldo_favor.toFixed(2),
        };
    });

    return {
        institucional: institucionalData.map((i) => ({
            id_solicitud: i.id_solicitud,
            codigo_ticket: i.codigo_ticket,
            fecha: i.fecha_validacion,
            hora: formatHora(i.fecha_validacion),
            solicitante: `${i.Solicitante?.nombre} ${i.Solicitante?.apellido}`,
            ...formatVehiculo(i),
            dependencia: i.Dependencia?.nombre_dependencia,
            subdependencia: i.Subdependencia?.nombre,
            tipo_combustible: i.TipoCombustible?.nombre || "S/I",
            cant_solic: i.cantidad_litros,
            cant_desp: i.cantidad_despachada,
        })),
        venta: ventasMapped,
        pagination: result.pagination,
        totales: {
            litros_institucional: (parseFloat(totalInstitucional) || 0).toFixed(2),
            litros_venta: (parseFloat(totalVentaLitros) || 0).toFixed(2),
            monto_venta: (parseFloat(totalVentaMonto) || 0).toFixed(2),
            total_litros: (
                (parseFloat(totalInstitucional) || 0) + (parseFloat(totalVentaLitros) || 0)
            ).toFixed(2),
            resumen_saldos: Object.entries(saldosPorMoneda).map(([moneda, total]) => ({
                moneda, total: total.toFixed(2),
            })),
            por_combustible: Object.entries(totalesPorCombustible).map(([combustible, totales]) => ({
                combustible,
                institucional: totales.institucional.toFixed(2),
                venta: totales.venta.toFixed(2),
                total: totales.total.toFixed(2)
            }))
        },
    };
}

// ─────────────────────────────────────────────
// REPORTE DE DESPACHOS (genérico y por usuario)
// ─────────────────────────────────────────────

/**
 * Construye el objeto `where` de Sequelize para consultas de despachos.
 * Soporta subdependencias como ID único o array de IDs.
 */
function buildDespachoWhere({ fecha_desde, fecha_hasta, id_dependencia, subdependencias, id_tipo_combustible }) {
    const { start, end } = buildDateRange(fecha_desde, fecha_hasta);

    const where = {
        estado: "FINALIZADA",
        [Op.or]: [
            { fecha_despacho: { [Op.between]: [start, end] } },
            {
                [Op.and]: [
                    { fecha_despacho: null },
                    { fecha_solicitud: { [Op.between]: [start, end] } },
                ],
            },
        ],
    };

    if (isValidFilter(id_dependencia)) {
        where.id_dependencia = id_dependencia;
    }

    if (subdependencias) {
        const ids = (Array.isArray(subdependencias) ? subdependencias : [subdependencias])
            .filter(isValidFilter);
        if (ids.length === 1) where.id_subdependencia = ids[0];
        else if (ids.length > 1) where.id_subdependencia = { [Op.in]: ids };
    }

    if (isValidFilter(id_tipo_combustible)) {
        where.id_tipo_combustible = id_tipo_combustible;
    }

    return where;
}

/**
 * Ejecuta la consulta paginada de despachos.
 * @returns {{ filas: Array, pagination: object, total_general: string }}
 */
async function fetchDespachos(where, query) {
    const result = await paginate(Solicitud, query, {
        where,
        include: [
            {
                model: Vehiculo, required: false, attributes: ["placa"],
                include: [
                    { model: Marca, as: "Marca", attributes: ["nombre"] },
                    { model: Modelo, as: "Modelo", attributes: ["nombre"] },
                ],
            },
            { model: Usuario, as: "Solicitante", attributes: ["nombre", "apellido"] },
            { model: Dependencia, as: "Dependencia", attributes: ["nombre_dependencia"] },
            { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
        ],
        attributes: [
            "id_solicitud", "codigo_ticket", "fecha_validacion",
            "cantidad_litros", "cantidad_despachada", "tipo_suministro", "placa", "marca", "modelo",
        ],
        order: [["fecha_validacion", "ASC"]],
    });

    const totalDespachado = await Solicitud.sum("cantidad_despachada", { where });

    const filas = result.data.map((d) => ({
        id: d.id_solicitud,
        codigo_ticket: d.codigo_ticket,
        fecha: d.fecha_validacion,
        hora: formatHora(d.fecha_validacion),
        ...formatVehiculo(d),
        dependencia: d.Dependencia?.nombre_dependencia,
        subdependencia: d.Subdependencia?.nombre,
        solicitante: `${d.Solicitante?.nombre} ${d.Solicitante?.apellido}`,
        cantidad_aprobada: parseFloat(d.cantidad_litros),
        cantidad_despachada: parseFloat(d.cantidad_despachada || 0),
    }));

    return { filas, pagination: result.pagination, total_general: (totalDespachado || 0).toFixed(2) };
}

// ─────────────────────────────────────────────
// CONSUMO POR DEPENDENCIA
// ─────────────────────────────────────────────

/**
 * Retorna el consumo agregado por Dependencia y Tipo de Combustible.
 */
async function getConsumoPorDependencia({ fecha_desde, fecha_hasta }) {
    const { start, end } = buildDateRange(fecha_desde, fecha_hasta);

    const consumos = await Solicitud.findAll({
        where: {
            estado: "FINALIZADA",
            fecha_validacion: { [Op.between]: [start, end] },
        },
        attributes: [
            "id_dependencia",
            "id_tipo_combustible",
            [sequelize.fn("SUM", sequelize.col("cantidad_despachada")), "total_litros"],
        ],
        include: [
            { model: Dependencia, as: "Dependencia", attributes: ["nombre_dependencia"] },
            { model: TipoCombustible, attributes: ["nombre"] },
        ],
        group: [
            "Solicitud.id_dependencia",
            "Solicitud.id_tipo_combustible",
            "Dependencia.id_dependencia",
            "Dependencia.nombre_dependencia",
            "TipoCombustible.id_tipo_combustible",
            "TipoCombustible.nombre",
        ],
        order: [[sequelize.col("Dependencia.nombre_dependencia"), "ASC"]],
    });

    return consumos.map((c) => ({
        id_dependencia: c.id_dependencia,
        dependencia: c.Dependencia?.nombre_dependencia || "Desconocida",
        id_tipo_combustible: c.id_tipo_combustible,
        tipo_combustible: c.TipoCombustible?.nombre || "N/A",
        total_litros: parseFloat(parseFloat(c.get("total_litros") || 0).toFixed(2)),
    }));
}

// ─────────────────────────────────────────────
// CUPOS DEL USUARIO
// ─────────────────────────────────────────────

/**
 * Retorna los cupos del periodo para la dependencia del usuario dado.
 * @param {{ id_usuario: number, id_dependencia: number, periodo: string }} opts
 */
async function getCuposUsuario({ id_usuario, id_dependencia, periodo }) {
    const cupos = await CupoActual.findAll({
        where: { periodo },
        include: [
            {
                model: CupoBase,
                as: "CupoBase",
                where: { id_dependencia },
                include: [
                    { model: Categoria, as: "Categoria", attributes: ["nombre"] },
                    { model: Dependencia, as: "Dependencia", attributes: ["nombre_dependencia"] },
                    { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
                    { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
                ],
            },
        ],
        order: [
            [sequelize.col("CupoBase.Dependencia.nombre_dependencia"), "ASC"],
            [sequelize.col("CupoBase.Subdependencia.nombre"), "ASC"],
        ],
    });

    return cupos.map((c) => ({
        id_cupo_actual: c.id_cupo_actual,
        periodo: c.periodo,
        dependencia: c.CupoBase?.Dependencia?.nombre_dependencia,
        subdependencia: c.CupoBase?.Subdependencia?.nombre || "General",
        categoria: c.CupoBase?.Categoria?.nombre,
        tipo_combustible: c.CupoBase?.TipoCombustible?.nombre,
        asignado: parseFloat(c.cantidad_asignada),
        consumido: parseFloat(c.cantidad_consumida),
        recargado: parseFloat(c.cantidad_recargada),
        disponible: parseFloat(c.cantidad_disponible),
        estado: c.estado,
        porcentaje_uso: c.cantidad_asignada > 0
            ? ((c.cantidad_consumida / c.cantidad_asignada) * 100).toFixed(1)
            : "0.0",
    }));
}

module.exports = {
    getReporteDiario,
    buildDespachoWhere,
    fetchDespachos,
    getConsumoPorDependencia,
    getCuposUsuario,
};
