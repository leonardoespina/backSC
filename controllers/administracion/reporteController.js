"use strict";

const {
  getReporteDiario,
  buildDespachoWhere,
  fetchDespachos,
  getConsumoPorDependencia,
  getCuposUsuario,
  getReporteRecepcionCisterna,
} = require("../../services/administracion/reporteService");
const { getSituacionCombustible } = require("../../services/administracion/reporteSituacionService");
const { Usuario } = require("../../models");
const { hasPermission, PERMISSIONS } = require("../../utils/permissions");
const { getOperativeRange } = require("../../utils/dateUtils");

// ─────────────────────────────────────────────
// GET /api/reportes/diario
// ─────────────────────────────────────────────
exports.generarReporteDiario = async (req, res) => {
  try {
    let { id_llenadero, fecha_desde, fecha_hasta, tipo_reporte } = req.query;

    if (!id_llenadero || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ msg: "Faltan parámetros obligatorios (id_llenadero, fecha_desde, fecha_hasta)." });
    }

    const canViewInstitucional = hasPermission(req.usuario, PERMISSIONS.VIEW_REPORTE_DIARIO);
    const canViewVentas = hasPermission(req.usuario, PERMISSIONS.VIEW_REPORTE_VENTAS);

    // Si intenta ver ventas pero no tiene permiso, 403
    if (tipo_reporte === "VENTA" && !canViewVentas) {
      return res.status(403).json({ msg: "Acceso denegado: No tienes permiso para ver el reporte de ventas." });
    }

    // Si intenta ver institucional o todos pero no tiene permiso institucional, 403
    // EXCEPCIÓN: Si el usuario es de VENTA y no especificó tipo, le forzamos VENTA
    if ((tipo_reporte === "INSTITUCIONAL" || tipo_reporte === "TODOS" || !tipo_reporte) && !canViewInstitucional) {
      if (canViewVentas) {
        tipo_reporte = "VENTA"; // Autocorrección para usuarios de ventas
      } else {
        return res.status(403).json({ msg: "Acceso denegado: No tienes permiso para ver el reporte institucional." });
      }
    }

    const data = await getReporteDiario({ 
      id_llenadero, 
      fecha_desde, 
      fecha_hasta, 
      tipo_reporte, 
      query: req.query,
      user: req.usuario 
    });
    res.json(data);
  } catch (error) {
    console.error("Error en reporte diario:", error);
    res.status(500).json({ msg: "Error al generar el reporte.", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/reportes/despachos
// ─────────────────────────────────────────────
exports.consultarDespachos = async (req, res) => {
  try {
    const { id_dependencia, id_subdependencia, id_tipo_combustible, fecha_desde, fecha_hasta } = req.query;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({ msg: "Debe seleccionar un rango de fechas (Desde y Hasta)." });
    }

    const where = buildDespachoWhere({
      fecha_desde,
      fecha_hasta,
      id_dependencia,
      subdependencias: id_subdependencia, // compat: sigue aceptando ID único
      id_tipo_combustible,
    });

    const { filas, pagination, total_general } = await fetchDespachos(where, req.query);

    res.json({ data: filas, pagination, total_general });
  } catch (error) {
    console.error("Error en reporte de despachos:", error);
    res.status(500).json({ msg: "Error al consultar despachos.", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/reportes/mis-despachos  (NUEVO)
// Filtra automáticamente por la dependencia del usuario logueado.
// Permite seleccionar una o varias subdependencias.
// ─────────────────────────────────────────────
exports.consultarMisDespachos = async (req, res) => {
  try {
    const { subdependencias, id_tipo_combustible, fecha_desde, fecha_hasta } = req.query;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({ msg: "Debe seleccionar un rango de fechas (Desde y Hasta)." });
    }

    // La dependencia se toma del token — el usuario no la puede manipular
    const { id_dependencia } = req.usuario;

    if (!id_dependencia) {
      return res.status(400).json({ msg: "El usuario no tiene una dependencia asignada." });
    }

    const where = buildDespachoWhere({
      fecha_desde,
      fecha_hasta,
      id_dependencia,
      subdependencias, // acepta array (?subdependencias[]=1&subdependencias[]=2) o ID único
      id_tipo_combustible,
    });

    const { filas, pagination, total_general } = await fetchDespachos(where, req.query);

    res.json({ data: filas, pagination, total_general });
  } catch (error) {
    console.error("Error en mis-despachos:", error);
    res.status(500).json({ msg: "Error al consultar sus despachos.", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/reportes/consumo-dependencia
// ─────────────────────────────────────────────
exports.obtenerConsumoPorDependencia = async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({ msg: "Rango de fechas requerido (fecha_desde, fecha_hasta)." });
    }

    const data = await getConsumoPorDependencia({ fecha_desde, fecha_hasta });
    res.json(data);
  } catch (error) {
    console.error("Error en reporte de consumo por dependencia:", error);
    res.status(500).json({ msg: "Error al generar el reporte estadístico.", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/reportes/mis-cupos
// ─────────────────────────────────────────────
exports.obtenerReporteCuposUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.usuario;
    const periodo = req.query.periodo || new Date().toISOString().slice(0, 7);

    // Verificar usuario activo y obtener su dependencia
    const usuarioBD = await Usuario.findByPk(id_usuario, {
      attributes: ["id_dependencia", "nombre", "apellido", "estado"],
    });

    if (!usuarioBD) return res.status(404).json({ msg: "Usuario no encontrado." });
    if (usuarioBD.estado !== "ACTIVO") return res.status(403).json({ msg: "Usuario inactivo." });
    if (!usuarioBD.id_dependencia) return res.status(400).json({ msg: "El usuario no tiene una dependencia asignada." });

    const reporte = await getCuposUsuario({
      id_usuario,
      id_dependencia: usuarioBD.id_dependencia,
      periodo,
    });

    res.json({
      periodo,
      usuario_solicitante: `${req.usuario.nombre} ${req.usuario.apellido}`,
      data: reporte,
    });
  } catch (error) {
    console.error("Error al obtener reporte de cupos de usuario:", error);
    res.status(500).json({ msg: "Error al consultar sus cupos.", error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/reportes/situacion-combustible
// ─────────────────────────────────────────────
exports.obtenerSituacionCombustible = async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    // Normalizar fechas para el Día Operativo (07:00 AM)
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
    const desde = fecha_desde || hoy;
    const hasta = fecha_hasta || hoy;
    const { start, end } = getOperativeRange(desde, hasta);

    const data = await getSituacionCombustible({ start, end, fecha_desde: desde, fecha_hasta: hasta });
    res.json(data);
  } catch (error) {
    console.error("Error en situación de combustible:", error);
    res.status(500).json({ msg: "Error al generar el reporte de situación.", error: error.message });
  }
};
// ─────────────────────────────────────────────
// GET /api/reportes/recepcion-cisternas
// ─────────────────────────────────────────────
exports.obtenerReporteRecepcionCisterna = async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, id_llenadero, id_tipo_combustible } = req.query;

    if (!fecha_desde || !fecha_hasta) {
      return res.status(400).json({ msg: "Debe seleccionar un rango de fechas (Desde y Hasta)." });
    }

    const data = await getReporteRecepcionCisterna({
      fecha_desde,
      fecha_hasta,
      id_llenadero,
      id_tipo_combustible
    });

    res.json({ data });
  } catch (error) {
    console.error("Error en reporte de recepción de cisternas:", error);
    res.status(500).json({ msg: "Error al generar el reporte de recepción.", error: error.message });
  }
};
