const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const modeloController = require("../controllers/vehiculos/modeloController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// Todas las rutas de modelos requieren estar autenticado
router.use(autenticarUsuario);

// GET /api/modelos (Listar) - Accesible para todos los usuarios autenticados
// El controlador se encarga de filtrar por activos si no es Admin
router.get("/", modeloController.obtenerModelos);

// POST /api/modelos (Crear) - Solo ADMIN
router.post(
  "/",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre es obligatorio").not().isEmpty(),
    check(
      "id_marca",
      "El ID de la marca es obligatorio y numérico",
    ).isNumeric(),
    validarCampos,
  ],
  modeloController.crearModelo,
);

// PUT /api/modelos/:id (Actualizar) - Solo ADMIN
router.put(
  "/:id",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre no puede estar vacío")
      .optional()
      .not()
      .isEmpty(),
    check("id_marca", "ID de marca inválido").optional().isNumeric(),
    validarCampos,
  ],
  modeloController.actualizarModelo,
);

// DELETE /api/modelos/:id (Desactivar) - Solo ADMIN
router.delete(
  "/:id",
  [authorizePermission(PERMISSIONS.MANAGE_SYSTEM), validarCampos],
  modeloController.desactivarModelo,
);

module.exports = router;
