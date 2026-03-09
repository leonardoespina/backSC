const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const evaporacionController = require("../controllers/operaciones/evaporacionController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

router.use(autenticarUsuario);

// GET /api/evaporaciones
router.get(
  "/",
  authorizePermission(PERMISSIONS.VIEW_INVENTARIO),
  evaporacionController.listarEvaporaciones,
);

// POST /api/evaporaciones
router.post(
  "/",
  [
    authorizePermission(PERMISSIONS.VIEW_INVENTARIO),
    check("id_llenadero", "El ID de llenadero es obligatorio").isInt(),
    check("cantidad", "La cantidad es obligatoria y debe ser positiva").isFloat(
      { min: 0.01 },
    ),
    check("observacion", "La observación es obligatoria").not().isEmpty(),
    validarCampos,
  ],
  evaporacionController.registrarEvaporacion,
);

module.exports = router;
