"use strict";

const { sequelize } = require("../../config/database");
const moment = require("moment"); // Asegúrate de tener moment instalado

async function generarKardexConsolidado({ fecha_desde, fecha_hasta, agruparPor = 'DAY', agruparGlobalmente = false, llenaderosIds = [], combustiblesIds = [] }) {
  if (!fecha_desde || !fecha_hasta) throw new Error("Las fechas son obligatorias.");
  
  const hoyStr = moment().format("YYYY-MM-DD");
  
  const formatosFecha = ["YYYY-MM-DD", "YYYY/MM/DD", "YYYY-MM", "YYYY/MM"];
  
  if (moment(fecha_hasta, formatosFecha).isAfter(hoyStr)) {
    fecha_hasta = hoyStr;
  }
  
  if (moment(fecha_desde, formatosFecha).isAfter(hoyStr)) {
    return [];
  }

  const formatoGrupo = agruparPor === 'MONTH' ? 'YYYY-MM' : 'YYYY-MM-DD';

  const entidades = await obtenerEntidadesActivas(agruparGlobalmente, llenaderosIds, combustiblesIds);
  if (!entidades.length) return [];

  const stockBase = await obtenerStockInicialGlobal(`${fecha_desde} 00:00:00`, agruparGlobalmente, llenaderosIds, combustiblesIds);
  const movimientosRaw = await obtenerMovimientosRango(`${fecha_desde} 00:00:00`, `${fecha_hasta} 23:59:59`, llenaderosIds, combustiblesIds);
  
  const lineaTiempo = generarLineaTiempo(fecha_desde, fecha_hasta, agruparPor);
  const resultadoFinal = [];

  entidades.forEach(entidad => {
    const key = agruparGlobalmente 
      ? `GLOBAL_${entidad.id_tipo_combustible}`
      : `${entidad.id_llenadero}_${entidad.id_tipo_combustible}`;

    let saldoFlotante = stockBase[key] || 0;

    lineaTiempo.forEach(periodo => {
      const movsPeriodo = movimientosRaw.filter(m => 
        (agruparGlobalmente || m.id_llenadero === entidad.id_llenadero) && 
        m.id_tipo_combustible === entidad.id_tipo_combustible &&
        moment(m.fecha_movimiento).format(formatoGrupo) === periodo
      );

      const consolidado = movsPeriodo.reduce((acc, mov) => {
        const val = parseFloat(mov.variacion);
        switch (mov.tipo_movimiento) {
          case 'RECEPCION_CISTERNA': acc.recepcion += val; break;
          case 'TRANSFERENCIA_ENTRADA': acc.tr_entrada += val; break;
          case 'DESPACHO': 
            acc.despacho += Math.abs(val); 
            acc.intercambio += parseFloat(mov.intercambio || 0);
            break;
          case 'TRANSFERENCIA_SALIDA': acc.tr_salida += Math.abs(val); break;
          case 'AJUSTE_MEDICION':
          case 'ANULACION': acc.ajustes += val; break;
        }
        return acc;
      }, { recepcion: 0, tr_entrada: 0, despacho: 0, tr_salida: 0, ajustes: 0, intercambio: 0 });

      const saldoFinal = saldoFlotante 
        + consolidado.recepcion + consolidado.tr_entrada 
        - consolidado.despacho - consolidado.tr_salida 
        + consolidado.ajustes;

      const enProgreso = (agruparPor === 'DAY' && periodo === hoyStr) || 
                         (agruparPor === 'MONTH' && periodo === hoyStr.substring(0, 7));

      resultadoFinal.push({
        periodo,
        estado: enProgreso ? 'EN_PROGRESO' : 'CERRADO',
        id_llenadero: entidad.id_llenadero,
        nombre_llenadero: entidad.nombre_llenadero,
        nombre_combustible: entidad.nombre_combustible,
        stock_inicial: saldoFlotante.toFixed(2),
        ...consolidado,
        intercambio: consolidado.intercambio.toFixed(2),
        stock_final: saldoFinal.toFixed(2)
      });

      saldoFlotante = saldoFinal;
    });
  });

  return resultadoFinal;
}

/* =====================================================================
 * FUNCIONES AUXILIARES PRIVADAS
 * ===================================================================== */

async function obtenerEntidadesActivas(agruparGlobalmente, llenaderosIds = [], combustiblesIds = []) {
  if (agruparGlobalmente) {
    let sql = `
      SELECT 'GLOBAL' AS id_llenadero, 'TODAS LAS SEDES (GLOBAL)' AS nombre_llenadero, tc.id_tipo_combustible, tc.nombre AS nombre_combustible
      FROM tipo_combustible tc
      WHERE tc.activo = true
    `;
    let replacements = {};
    if (combustiblesIds && combustiblesIds.length > 0) {
      sql += ` AND tc.id_tipo_combustible IN (:combustiblesIds)`;
      replacements.combustiblesIds = combustiblesIds;
    }
    return await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  } else {
    let sql = `
      SELECT t.id_llenadero, ll.nombre_llenadero, t.id_tipo_combustible, tc.nombre AS nombre_combustible
      FROM tanques t
      JOIN llenaderos ll ON t.id_llenadero = ll.id_llenadero
      JOIN tipo_combustible tc ON t.id_tipo_combustible = tc.id_tipo_combustible
      WHERE t.estado = 'ACTIVO'
    `;
    let replacements = {};
    if (llenaderosIds && llenaderosIds.length > 0) {
      sql += ` AND t.id_llenadero IN (:llenaderosIds)`;
      replacements.llenaderosIds = llenaderosIds;
    }
    if (combustiblesIds && combustiblesIds.length > 0) {
      sql += ` AND t.id_tipo_combustible IN (:combustiblesIds)`;
      replacements.combustiblesIds = combustiblesIds;
    }
    sql += ` GROUP BY t.id_llenadero, ll.nombre_llenadero, t.id_tipo_combustible, tc.nombre`;
    
    return await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  }
}

async function obtenerStockInicialGlobal(fechaCorte, agruparGlobalmente, llenaderosIds = [], combustiblesIds = []) {
  let rows;
  if (agruparGlobalmente) {
    let sql = `
      SELECT 'GLOBAL' AS id_llenadero, t.id_tipo_combustible,
             SUM(COALESCE((
                 SELECT mi.volumen_despues 
                 FROM movimientos_inventario mi 
                 WHERE mi.id_tanque = t.id_tanque AND mi.fecha_movimiento < :fechaCorte
                 ORDER BY mi.fecha_movimiento DESC, mi.id_movimiento DESC LIMIT 1
             ), 0)) AS stock_inicial
      FROM tanques t
      WHERE t.estado = 'ACTIVO'
    `;
    let replacements = { fechaCorte };
    if (combustiblesIds && combustiblesIds.length > 0) {
      sql += ` AND t.id_tipo_combustible IN (:combustiblesIds)`;
      replacements.combustiblesIds = combustiblesIds;
    }
    sql += ` GROUP BY t.id_tipo_combustible`;
    rows = await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  } else {
    let sql = `
      SELECT t.id_llenadero, t.id_tipo_combustible,
             SUM(COALESCE((
                 SELECT mi.volumen_despues 
                 FROM movimientos_inventario mi 
                 WHERE mi.id_tanque = t.id_tanque AND mi.fecha_movimiento < :fechaCorte
                 ORDER BY mi.fecha_movimiento DESC, mi.id_movimiento DESC LIMIT 1
             ), 0)) AS stock_inicial
      FROM tanques t
      WHERE t.estado = 'ACTIVO'
    `;
    let replacements = { fechaCorte };
    if (llenaderosIds && llenaderosIds.length > 0) {
      sql += ` AND t.id_llenadero IN (:llenaderosIds)`;
      replacements.llenaderosIds = llenaderosIds;
    }
    if (combustiblesIds && combustiblesIds.length > 0) {
      sql += ` AND t.id_tipo_combustible IN (:combustiblesIds)`;
      replacements.combustiblesIds = combustiblesIds;
    }
    sql += ` GROUP BY t.id_llenadero, t.id_tipo_combustible`;
    
    rows = await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  }

  const mapa = {};
  rows.forEach(r => {
    const key = agruparGlobalmente ? `GLOBAL_${r.id_tipo_combustible}` : `${r.id_llenadero}_${r.id_tipo_combustible}`;
    mapa[key] = parseFloat(r.stock_inicial);
  });
  return mapa;
}

async function obtenerMovimientosRango(fechaInicio, fechaFin, llenaderosIds = [], combustiblesIds = []) {
  let sql = `
    SELECT mi.fecha_movimiento, t.id_llenadero, t.id_tipo_combustible, mi.tipo_movimiento, mi.variacion,
           (CASE 
              WHEN mi.tabla_referencia = 'solicitudes' AND mi.tipo_movimiento = 'DESPACHO' THEN 
                (SELECT s.cantidad_despachada 
                 FROM solicitudes s 
                 WHERE s.id_solicitud = mi.id_referencia AND s.tipo_solicitud = 'VENTA')
              ELSE 0 
            END) as intercambio
    FROM movimientos_inventario mi
    JOIN tanques t ON mi.id_tanque = t.id_tanque
    WHERE mi.fecha_movimiento >= :fechaInicio AND mi.fecha_movimiento <= :fechaFin
      AND t.estado = 'ACTIVO'
  `;
  let replacements = { fechaInicio, fechaFin };
  if (llenaderosIds && llenaderosIds.length > 0) {
    sql += ` AND t.id_llenadero IN (:llenaderosIds)`;
    replacements.llenaderosIds = llenaderosIds;
  }
  if (combustiblesIds && combustiblesIds.length > 0) {
    sql += ` AND t.id_tipo_combustible IN (:combustiblesIds)`;
    replacements.combustiblesIds = combustiblesIds;
  }
  return await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
}

function generarLineaTiempo(start, end, type) {
  const formatosFecha = ["YYYY-MM-DD", "YYYY/MM/DD", "YYYY-MM", "YYYY/MM"];
  const arr = [];
  let current = moment(start, formatosFecha);
  const final = moment(end, formatosFecha);
  
  const formato = type === 'MONTH' ? 'YYYY-MM' : 'YYYY-MM-DD';
  const salto = type === 'MONTH' ? 'months' : 'days';
  
  while (current.isSameOrBefore(final, salto)) {
    arr.push(current.format(formato));
    current.add(1, salto);
  }
  return arr;
}

module.exports = { generarKardexConsolidado };
