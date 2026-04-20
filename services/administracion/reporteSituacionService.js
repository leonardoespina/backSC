"use strict";

/**
 * reporteSituacionService.js
 *
 * Genera el reporte "Situación del Combustible":
 * Por cada Llenadero activo, y agrupado dinámicamente por TipoCombustible,
 * devuelve: capacidad_total, stock_actual y consumido en el período indicado.
 *
 * Los tipos de combustible son completamente dinámicos (no hardcodeados).
 */

const { Tanque, Llenadero, TipoCombustible, MovimientoInventario } = require("../../models");
const { Op, fn, col, literal } = require("sequelize");
const { sequelize } = require("../../config/database");

/**
 * Construye un rango de fechas en UTC-4 (Venezuela).
 */
function buildDateRange(fecha_desde, fecha_hasta) {
    return {
        start: new Date(`${fecha_desde}T00:00:00-04:00`),
        end:   new Date(`${fecha_hasta}T23:59:59.999-04:00`),
    };
}

/**
 * Obtiene la situación del combustible agrupada por Llenadero y TipoCombustible.
 *
 * @param {{ fecha_desde?: string, fecha_hasta?: string }} opts
 *   fechas opcionales en formato YYYY-MM-DD.
 *   Si se omiten, se usa el día de hoy (Venezuela UTC-4).
 */
async function getSituacionCombustible({ fecha_desde, fecha_hasta } = {}) {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
    const desde = fecha_desde || hoy;
    const hasta  = fecha_hasta  || hoy;

    const { start, end } = buildDateRange(desde, hasta);

    // ─── 1. Stock actual y capacidad por Llenadero + TipoCombustible ───────────
    const stockRows = await Tanque.findAll({
        where: { estado: "ACTIVO" },
        attributes: [
            "id_llenadero",
            "id_tipo_combustible",
            [fn("SUM", col("capacidad_maxima")), "capacidad_total"],
            [fn("SUM", col("nivel_actual")),     "stock_actual"],
        ],
        include: [
            { model: Llenadero,       as: "Llenadero",       attributes: ["nombre_llenadero"] },
            { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
        ],
        group: [
            "Tanque.id_llenadero",
            "Tanque.id_tipo_combustible",
            "Llenadero.id_llenadero",
            "Llenadero.nombre_llenadero",
            "TipoCombustible.id_tipo_combustible",
            "TipoCombustible.nombre",
        ],
        order: [
            [col("Llenadero.nombre_llenadero"), "ASC"],
            [col("TipoCombustible.nombre"),      "ASC"],
        ],
        raw: true,
        nest: true,
    });

    // ─── 2. Consumo por TanqueID en el período ──────────────────────────────────
    //    Usamos subquery para llevar el id_llenadero desde Tanque
    const consumoRows = await sequelize.query(
        `
        SELECT
            t.id_llenadero,
            t.id_tipo_combustible,
            COALESCE(SUM(ABS(mi.variacion)), 0) AS consumido_periodo
        FROM movimientos_inventario mi
        INNER JOIN tanques t ON t.id_tanque = mi.id_tanque
        WHERE
            mi.tipo_movimiento = 'DESPACHO'
            AND mi.fecha_movimiento BETWEEN :start AND :end
            AND t.estado = 'ACTIVO'
        GROUP BY t.id_llenadero, t.id_tipo_combustible
        `,
        {
            replacements: { start, end },
            type: sequelize.QueryTypes.SELECT,
        }
    );

    // Indexar consumo por clave "llenaderoId_combustibleId"
    const consumoMap = {};
    consumoRows.forEach((r) => {
        const key = `${r.id_llenadero}_${r.id_tipo_combustible}`;
        consumoMap[key] = parseFloat(r.consumido_periodo) || 0;
    });

    // ─── 3. Ensamblar datos por Llenadero ───────────────────────────────────────
    const llenaderoMap = {};

    stockRows.forEach((row) => {
        const llId   = row.id_llenadero;
        const tcId   = row.id_tipo_combustible;
        const key    = `${llId}_${tcId}`;
        const nombre  = row["Llenadero.nombre_llenadero"] || row.Llenadero?.nombre_llenadero || "Sin nombre";
        const tcNombre = row["TipoCombustible.nombre"] || row.TipoCombustible?.nombre || "S/T";

        if (!llenaderoMap[llId]) {
            llenaderoMap[llId] = {
                id_llenadero:     llId,
                nombre_llenadero: nombre,
                tipos_combustible: [],
            };
        }

        llenaderoMap[llId].tipos_combustible.push({
            id_tipo_combustible: tcId,
            nombre_combustible:  tcNombre,
            capacidad_total:     parseFloat(parseFloat(row.capacidad_total || 0).toFixed(2)),
            stock_actual:        parseFloat(parseFloat(row.stock_actual     || 0).toFixed(2)),
            consumido_periodo:   parseFloat((consumoMap[key] || 0).toFixed(2)),
        });
    });

    // ─── 4. Totales globales por TipoCombustible ────────────────────────────────
    const totalesMap = {};

    Object.values(llenaderoMap).forEach((ll) => {
        ll.tipos_combustible.forEach((tc) => {
            if (!totalesMap[tc.id_tipo_combustible]) {
                totalesMap[tc.id_tipo_combustible] = {
                    id_tipo_combustible: tc.id_tipo_combustible,
                    nombre_combustible:  tc.nombre_combustible,
                    capacidad_total:     0,
                    stock_actual:        0,
                    consumido_periodo:   0,
                };
            }
            totalesMap[tc.id_tipo_combustible].capacidad_total   += tc.capacidad_total;
            totalesMap[tc.id_tipo_combustible].stock_actual       += tc.stock_actual;
            totalesMap[tc.id_tipo_combustible].consumido_periodo  += tc.consumido_periodo;
        });
    });

    // Redondear totales
    const totales_por_combustible = Object.values(totalesMap).map((t) => ({
        ...t,
        capacidad_total:   parseFloat(t.capacidad_total.toFixed(2)),
        stock_actual:      parseFloat(t.stock_actual.toFixed(2)),
        consumido_periodo: parseFloat(t.consumido_periodo.toFixed(2)),
    }));

    return {
        generado_en:            new Date().toISOString(),
        fecha_desde:            desde,
        fecha_hasta:            hasta,
        datos:                  Object.values(llenaderoMap),
        totales_por_combustible,
    };
}

module.exports = { getSituacionCombustible };
