const express = require("express");
const router = express.Router();
const reporteController = require("../controllers/administracion/reporteController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Ruta para generar el reporte diario
router.get(
  "/diario",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTE_DIARIO),
  reporteController.generarReporteDiario,
);

// Ruta para generar el reporte detallado de despachos
router.get(
  "/despachos",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTE_DESPACHOS),
  reporteController.consultarDespachos,
);

// Ruta para que el usuario vea sus propios despachos
router.get(
  "/mis-despachos",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_MIS_DESPACHOS),
  reporteController.consultarMisDespachos,
);

// Ruta para el reporte de consumo agregado por dependencia
router.get(
  "/consumo-dependencia",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTE_CONSUMO),
  reporteController.obtenerConsumoPorDependencia,
);

// Ruta para que los usuarios vean sus propios cupos
router.get(
  "/mis-cupos",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_MIS_CUPOS),
  reporteController.obtenerReporteCuposUsuario,
);

module.exports = router;
