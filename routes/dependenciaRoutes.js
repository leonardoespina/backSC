const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const dependenciaController = require("../controllers/organizacion/dependenciaController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// --- RUTAS PROTEGIDAS (Requieren Token) ---

// GET /api/dependencias (Listar)
router.get("/", autenticarUsuario, dependenciaController.obtenerDependencias);

// POST /api/dependencias (Crear) - Solo ADMIN
router.post(
  "/",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("id_categoria", "El ID de categoría es obligatorio").not().isEmpty(),
    check("nombre_dependencia", "El nombre de la dependencia es obligatorio")
      .not()
      .isEmpty(),
    validarCampos,
  ],
  dependenciaController.crearDependencia,
);

// PUT /api/dependencias/:id (Actualizar) - Solo ADMIN
router.put(
  "/:id",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre_dependencia", "El nombre es obligatorio")
      .optional()
      .not()
      .isEmpty(),
    validarCampos,
  ],
  dependenciaController.actualizarDependencia,
);

// DELETE /api/dependencias/:id (Desactivar) - Solo ADMIN
router.delete(
  "/:id",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
  dependenciaController.desactivarDependencia,
);

module.exports = router;
