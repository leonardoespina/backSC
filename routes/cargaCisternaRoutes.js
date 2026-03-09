const express = require("express");
const router = express.Router();
const cargaCisternaController = require("../controllers/operaciones/cargaCisternaController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// Listar Cargas
router.get("/", authorizePermission(PERMISSIONS.VIEW_OPERACIONES_TANQUES), cargaCisternaController.listarCargasCisterna);

// Crear Carga
router.post("/", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), cargaCisternaController.crearCargaCisterna);

// Actualizar Carga
router.put("/:id", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), cargaCisternaController.actualizarCarga);

module.exports = router;
