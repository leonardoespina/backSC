const express = require("express");
const router = express.Router({ mergeParams: true });
const distribucionController = require("../controllers/distribucionController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const { criticalLimiter } = require("../middlewares/rateLimitMiddleware");

// Todas las rutas de distribución requieren autenticación
router.use(autenticarUsuario);

// Obtener vehículos candidatos para la distribución de la solicitud
router.get(
  "/:id/distribucion/vehiculos",
  distribucionController.obtenerVehiculosParaDistribucion
);

// Obtener balance y detalle de distribuciones de la solicitud
router.get(
  "/:id/distribucion",
  distribucionController.obtenerDistribucion
);

// Registrar entregas de distribución
router.post(
  "/:id/distribucion",
  criticalLimiter,
  authorizePermission(PERMISSIONS.CREATE_SOLICITUD),
  distribucionController.registrarDistribucion
);

// Eliminar un ítem de distribución
router.delete(
  "/distribucion/:id_distribucion",
  criticalLimiter,
  authorizePermission(PERMISSIONS.CREATE_SOLICITUD),
  distribucionController.eliminarItemDistribucion
);

module.exports = router;
