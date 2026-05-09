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
router.post("/", authorizePermission(PERMISSIONS.CREATE_TRANSFERENCIA), transferenciaController.crearTransferencia);

// Editar una transferencia existente
router.put("/:id", authorizePermission(PERMISSIONS.CREATE_TRANSFERENCIA), transferenciaController.actualizarTransferencia);

// Revertir Transferencia (Regla de Oro: solo si es el último movimiento de AMBOS tanques)
router.put("/:id/revertir", authorizePermission(PERMISSIONS.REVERTIR_OPERACION), transferenciaController.revertirTransferencia);

module.exports = router;
