const express = require("express");
const router = express.Router();
const vehiculoSinPlacaController = require("../controllers/vehiculos/vehiculoSinPlacaController");

// --- RUTAS PARA GESTIÓN DE CORRELATIVOS DE VEHÍCULOS SIN PLACA ---

// Obtener último correlativo (para frontend)
router.get(
  "/ultimo-correlativo",
  vehiculoSinPlacaController.obtenerUltimoCorrelativo,
);

// Generar siguiente correlativo (para backend al crear vehículo)
router.post(
  "/generar-siguiente",
  vehiculoSinPlacaController.generarSiguienteCorrelativo,
);

// Actualizar correlativo manualmente (Admin)
router.put(
  "/actualizar-correlativo",
  vehiculoSinPlacaController.actualizarCorrelativo,
);

// Obtener configuración actual
router.get("/configuracion", vehiculoSinPlacaController.obtenerConfiguracion);

module.exports = router;
