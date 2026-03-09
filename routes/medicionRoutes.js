const express = require("express");
const router = express.Router();
const medicionController = require("../controllers/operaciones/medicionController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// Listar Mediciones
router.get("/", authorizePermission(PERMISSIONS.VIEW_OPERACIONES_TANQUES), medicionController.listarMediciones);

// Crear Medición
router.post("/", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), medicionController.crearMedicion);

// Actualizar Medición
router.put("/:id", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), medicionController.actualizarMedicion);

// Anular Medición
router.put("/:id/anular", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), medicionController.anularMedicion);

module.exports = router;
