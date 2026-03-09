const express = require("express");
const router = express.Router();
const transferenciaController = require("../controllers/despachos/transferenciaController");
const { autenticarUsuario, authorizePermission } = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// Listar Transferencias
router.get("/", authorizePermission(PERMISSIONS.VIEW_OPERACIONES_TANQUES), transferenciaController.listarTransferencias);

// Obtener Detalle
router.get("/:id", authorizePermission(PERMISSIONS.VIEW_OPERACIONES_TANQUES), transferenciaController.obtenerTransferenciaPorId);

// Crear Transferencia
router.post("/", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), transferenciaController.crearTransferencia);

// Actualizar (Solo observaciones)
router.put("/:id", authorizePermission(PERMISSIONS.MANAGE_OPERACIONES_TANQUES), transferenciaController.actualizarTransferencia);

module.exports = router;
