"use strict";

const {
  getReporteDiario,
  buildDespachoWhere,
  fetchDespachos,
  getConsumoPorDependencia,
  getCuposUsuario,
} = require("../../services/administracion/reporteService");
const { Usuario } = require("../../models");

// ─────────────────────────────────────────────
// GET /api/reportes/diario
// ─────────────────────────────────────────────
exports.generarReporteDiario = async (req, res) => {
  try {
    const { id_llenadero, fecha } = req.query;

    if (!id_llenadero || !fecha) {
      return res.status(400).json({ msg: "Faltan parámetros obligatorios (id_llenadero, fecha)." });
    }

    const data = await getReporteDiario({ id_llenadero, fecha, query: req.query });
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
