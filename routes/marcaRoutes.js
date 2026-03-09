const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const marcaController = require("../controllers/vehiculos/marcaController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// Todas las rutas de marcas requieren estar logueado
router.use(autenticarUsuario);

// GET /api/marcas - Listar y Buscar
router.get("/", marcaController.obtenerMarcas);

// GET /api/marcas/lista - Para selectores
router.get("/lista", marcaController.obtenerListaMarcas);

// POST /api/marcas - Crear (Solo ADMIN)
router.post(
  "/",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre de la marca es obligatorio").not().isEmpty(),
    validarCampos,
  ],
  marcaController.crearMarca,
);

// PUT /api/marcas/:id - Modificar (Solo ADMIN)
router.put(
  "/:id",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre no puede estar vacío")
      .optional()
      .not()
      .isEmpty(),
    validarCampos,
  ],
  marcaController.actualizarMarca,
);

// DELETE /api/marcas/:id - Desactivar (Solo ADMIN)
router.delete(
  "/:id",
  [authorizePermission(PERMISSIONS.MANAGE_SYSTEM), validarCampos],
  marcaController.desactivarMarca,
);

module.exports = router;
