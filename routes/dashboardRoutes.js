const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/administracion/dashboardController");
const { autenticarUsuario } = require("../middlewares/authMiddleware");

// Todas las estadísticas requieren estar autenticado
router.get("/stats", autenticarUsuario, dashboardController.obtenerStats);

module.exports = router;
