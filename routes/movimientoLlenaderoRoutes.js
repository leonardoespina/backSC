const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const movimientoController = require("../controllers/operaciones/movimientoLlenaderoController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

router.use(autenticarUsuario);

// GET /api/movimientos-llenadero
router.get(
  "/",
  authorizePermission(PERMISSIONS.VIEW_INVENTARIO),
  movimientoController.listarMovimientos,
);

// POST /api/movimientos-llenadero
router.post(
  "/",
  [
    authorizePermission(PERMISSIONS.VIEW_INVENTARIO),
    check("id_llenadero", "El ID de llenadero es obligatorio").isInt(),
    check(
      "tipo_movimiento",
      "El tipo de movimiento es obligatorio y debe ser CARGA o EVAPORACION",
    ).isIn(["CARGA", "EVAPORACION"]),
    check("cantidad", "La cantidad es obligatoria y debe ser positiva").isFloat(
      { min: 0.01 },
    ),
    check("observacion", "La observación es obligatoria").not().isEmpty(),
    validarCampos,
  ],
  movimientoController.crearMovimiento,
);

module.exports = router;
