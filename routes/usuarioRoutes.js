const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const usuarioController = require("../controllers/administracion/usuarioController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");
const {
  loginLimiter,
  creationLimiter,
} = require("../middlewares/rateLimitMiddleware");

// --- RUTAS PÚBLICAS ---

// POST /api/usuarios/login (Login) - CON RATE LIMITING RESTRICTIVO
router.post(
  "/login",
  loginLimiter, // 5 intentos cada 15 minutos
  [
    check("cedula", "La cédula es obligatoria").not().isEmpty(),
    check("password", "El password es obligatorio").exists(),
    validarCampos,
  ],
  usuarioController.loginUsuario,
);

// POST /api/usuarios/logout (Logout) - Requiere estar autenticado
router.post("/logout", autenticarUsuario, usuarioController.logoutUsuario);

// PUT /api/usuarios/cambiar-password (Cambiar propia contraseña)
router.put(
  "/cambiar-password",
  autenticarUsuario,
  [
    check("passwordActual", "La contraseña actual es obligatoria")
      .not()
      .isEmpty(),
    check(
      "nuevaPassword",
      "La nueva contraseña debe tener al menos 6 caracteres",
    ).isLength({ min: 6 }),
    validarCampos,
  ],
  usuarioController.cambiarPassword,
);

// --- RUTAS PROTEGIDAS (Requieren Token) ---

// GET /api/usuarios (Listar) - Accesible para Admin y roles operativos para listar selectores
router.get(
  "/",
  autenticarUsuario,

  usuarioController.obtenerUsuarios,
);

// POST /api/usuarios (Crear) - Solo ADMIN - CON RATE LIMITING
router.post(
  "/",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_USERS),
    creationLimiter, // 30 creaciones cada 10 minutos
    check("nombre", "El nombre es obligatorio").not().isEmpty(),
    check("apellido", "El apellido es obligatorio").not().isEmpty(),
    check("cedula", "La cédula es obligatoria").not().isEmpty(),
    check("password", "Mínimo 6 caracteres").isLength({ min: 6 }),
    validarCampos,
  ],
  usuarioController.crearUsuario,
);

// PUT /api/usuarios/:id (Actualizar) - Solo ADMIN
router.put(
  "/:id",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_USERS),
    check("nombre", "El nombre es obligatorio").optional().not().isEmpty(),
    check("apellido", "El apellido es obligatorio").optional().not().isEmpty(),
    // Si envían password, validamos longitud
    //check("password", "Mínimo 6 caracteres").optional().isLength({ min: 6 }),
    //  validarCampos,
  ],
  usuarioController.actualizarUsuario,
);

// DELETE /api/usuarios/:id (Desactivar) - Solo ADMIN
router.delete(
  "/:id",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.MANAGE_USERS),
  usuarioController.desactivarUsuario,
);

module.exports = router;
