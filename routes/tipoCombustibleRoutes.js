const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const tipoCombustibleController = require("../controllers/vehiculos/tipoCombustibleController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// --- RUTAS PROTEGIDAS ---

// GET /api/tipos-combustible/lista (Para Selects - Todos los autenticados)
router.get("/lista", autenticarUsuario, tipoCombustibleController.listarTodos);

// GET /api/tipos-combustible (Listar Paginado - Solo Admin/Supervisor)
router.get(
  "/",
  [autenticarUsuario],
  tipoCombustibleController.obtenerTiposCombustible,
);

// POST /api/tipos-combustible (Crear - Solo Admin)
router.post(
  "/",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre es obligatorio").not().isEmpty(),
    validarCampos,
  ],
  tipoCombustibleController.crearTipoCombustible,
);

// PUT /api/tipos-combustible/:id (Actualizar - Solo Admin)
router.put(
  "/:id",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre es obligatorio").optional().not().isEmpty(),
    validarCampos,
  ],
  tipoCombustibleController.actualizarTipoCombustible,
);

// DELETE /api/tipos-combustible/:id (Desactivar - Solo Admin)
router.delete(
  "/:id",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM)],
  tipoCombustibleController.eliminarTipoCombustible,
);

module.exports = router;
