const express = require("express");
const router = express.Router();
const auditoriaController = require("../controllers/auditoriaController");
const {
    autenticarUsuario,
    authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");

// Todas las rutas de auditoría requieren autenticación + permiso específico
router.use(autenticarUsuario);
router.use(authorizePermission(PERMISSIONS.VIEW_AUDITORIA));

// GET /api/auditoria — Listar registros (con filtros y paginación)
router.get("/", auditoriaController.obtenerRegistros);

// GET /api/auditoria/estadisticas — Dashboard de actividad
router.get("/estadisticas", auditoriaController.obtenerEstadisticas);

// GET /api/auditoria/:id — Detalle completo de un registro
router.get("/:id", auditoriaController.obtenerDetalle);

module.exports = router;
