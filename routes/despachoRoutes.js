const express = require("express");
const router = express.Router();
const despachoController = require("../controllers/despachos/despachoController");
const { autenticarUsuario } = require("../middlewares/authMiddleware");

// Todas las rutas requieren autenticación
router.use(autenticarUsuario);

// Listar solicitudes aprobadas para despacho (Buzón de Almacén)
router.get("/solicitudes", despachoController.listarSolicitudesParaDespacho);

// Validar Firma
router.post("/validar-firma", despachoController.validarFirma);

// Imprimir Ticket
router.post("/imprimir/:id", despachoController.imprimirTicket);

// Reimprimir Ticket
router.post("/reimprimir/:id", despachoController.reimprimirTicket);

// Despachar (Escaneo QR)
router.post("/despachar", despachoController.despacharSolicitud);

module.exports = router;
