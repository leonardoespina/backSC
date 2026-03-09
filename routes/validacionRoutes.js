const express = require("express");
const router = express.Router();
const validacionController = require("../controllers/despachos/validacionController");
const { autenticarUsuario } = require("../middlewares/authMiddleware");

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// Consultar ticket por código (QR)
router.get("/ticket/:codigo", validacionController.consultarTicket);

// Finalizar ticket y cerrar proceso
router.post("/finalizar", validacionController.finalizarTicket);

module.exports = router;
