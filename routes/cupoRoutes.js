const express = require("express");
const router = express.Router();
const cupoController = require("../controllers/despachos/cupoController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const {
  criticalLimiter,
  creationLimiter,
} = require("../middlewares/rateLimitMiddleware");

// --- RUTAS DE CONFIGURACIÓN (Cupo Base) - Solo ADMIN ---
router.get(
  "/base",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM)],
  cupoController.obtenerCuposBase,
);

// Crear Cupo Base - Solo ADMIN - CON RATE LIMITING
router.post(
  "/base",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM), creationLimiter],
  cupoController.crearCupoBase,
);

router.put(
  "/base/:id",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM)],
  cupoController.actualizarCupoBase,
);

// --- RUTAS DE ESTADO ACTUAL - TODOS LOS ROLES AUTENTICADOS ---
router.get("/actual", [autenticarUsuario], cupoController.obtenerCuposActuales);

router.get(
  "/especifico",
  [autenticarUsuario],
  cupoController.obtenerCupoEspecifico,
);

// --- RUTAS DE GESTIÓN (Consumo y Recarga) - Solo ADMIN ---
// Consumir Cupo - OPERACIÓN CRÍTICA (Afecta inventario)
router.post(
  "/consumir",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM), criticalLimiter],
  cupoController.consumirCupo,
);

// Recargar Cupo - OPERACIÓN CRÍTICA (Afecta inventario)
router.post(
  "/recargar",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM), criticalLimiter],
  cupoController.recargarCupo,
);

// --- RUTA DE REINICIO MANUAL (Para pruebas) - Solo ADMIN ---
router.post(
  "/reiniciar-mes",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM)],
  async (req, res) => {
    const resultado = await cupoController.reiniciarCuposMensuales();
    if (resultado.success) {
      res.json(resultado);
    } else {
      res.status(500).json(resultado);
    }
  },
);

module.exports = router;
