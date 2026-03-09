const express = require("express");
const router = express.Router();
const biometriaController = require("../controllers/despachos/biometriaController");
const { autenticarUsuario } = require("../middlewares/authMiddleware");

// Todas las rutas de biometría requieren autenticación
router.use(autenticarUsuario);

router.post("/registrar", biometriaController.registrarBiometria);
router.post("/comparar", biometriaController.compararHuellas);
router.post("/verificar", biometriaController.verificarIdentidad);
router.get("/", biometriaController.obtenerRegistros);
router.delete("/:id", biometriaController.eliminarRegistro);

module.exports = router;
