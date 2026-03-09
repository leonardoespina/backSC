const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/operaciones/cierreTurnoController");
const { autenticarUsuario } = require("../../middlewares/authMiddleware");

router.use(autenticarUsuario);

// Consultas auxiliares para el formulario
router.get("/tanques-llenadero/:id_llenadero", ctrl.tanquesPorLlenadero);
router.get("/ultimo-nivel/:id_tanque", ctrl.ultimoNivel);

// CRUD principal
router.post("/generar", ctrl.generarCierre);
router.get("/", ctrl.listarCierres);
router.get("/:id", ctrl.obtenerCierre);
router.get("/:id/reporte", ctrl.generarReporte);
router.get("/:id/acta", ctrl.generarActaTurno);

module.exports = router;
