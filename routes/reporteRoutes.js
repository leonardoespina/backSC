const express = require("express");
const router = express.Router();
const reporteController = require("../controllers/administracion/reporteController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Ruta para generar el reporte diario
router.get(
  "/diario",
  autenticarUsuario,
  authorizePermission([PERMISSIONS.VIEW_REPORTE_DIARIO, PERMISSIONS.VIEW_REPORTE_VENTAS]),
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

// Ruta para el reporte de situación de combustible (stock + consumo por llenadero y tipo)
router.get(
  "/situacion-combustible",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTES_GLOB),
  reporteController.obtenerSituacionCombustible,
);

// Ruta para el reporte de recepción de cisternas (cargas)
router.get(
  "/recepcion-cisternas",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTE_RECEPCION),
  reporteController.obtenerReporteRecepcionCisterna,
);

// Ruta para el reporte de desviaciones (faltantes y sobrantes)
router.get(
  "/desviaciones",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTES_GLOB),
  reporteController.obtenerReporteDesviaciones,
);

// Ruta para el motor matemático del Kardex Dinámico (Día a Día / Mensual / Anual)
router.get(
  "/kardex-dinamico",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTES_GLOB),
  reporteController.obtenerKardexDinamico,
);

// Ruta para el Consolidado Total (Global)
router.get(
  "/total-consolidado",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.VIEW_REPORTES_GLOB),
  reporteController.obtenerTotalConsolidado,
);

module.exports = router;
