const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const precioController = require("../controllers/operaciones/precioController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// ============================================================
// RUTAS DE MONEDAS
// ============================================================

// GET /api/precios/monedas (Listar monedas con paginación)
router.get("/monedas", autenticarUsuario, precioController.obtenerMonedas);

// POST /api/precios/monedas (Crear moneda) - Solo ADMIN
router.post(
  "/monedas",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("nombre", "El nombre de la moneda es obligatorio").not().isEmpty(),
    check("simbolo", "El símbolo de la moneda es obligatorio").not().isEmpty(),
    validarCampos,
  ],
  precioController.crearMoneda,
);

// PUT /api/precios/monedas/:id (Actualizar moneda) - Solo ADMIN
router.put(
  "/monedas/:id",
  [autenticarUsuario, authorizePermission(PERMISSIONS.MANAGE_SYSTEM), validarCampos],
  precioController.actualizarMoneda,
);

// DELETE /api/precios/monedas/:id (Desactivar moneda) - Solo ADMIN
router.delete(
  "/monedas/:id",
  autenticarUsuario,
  authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
  precioController.desactivarMoneda,
);

// ============================================================
// RUTAS DE PRECIOS DE COMBUSTIBLES
// ============================================================

// GET /api/precios/actuales (Obtener tabla de precios actuales)
router.get(
  "/actuales",
  autenticarUsuario,
  precioController.obtenerPreciosActuales,
);

// GET /api/precios/combustible/:id (Obtener precios actuales por combustible)
router.get(
  "/combustible/:id",
  autenticarUsuario,
  precioController.obtenerPreciosPorCombustible,
);

// POST /api/precios/actualizar (Actualizar precios de un combustible) - Solo ADMIN
router.post(
  "/actualizar",
  [
    autenticarUsuario,
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check(
      "id_tipo_combustible",
      "El ID del tipo de combustible es obligatorio",
    ).isInt(),
    check("precios", "Los precios deben ser un objeto").isObject(),
    validarCampos,
  ],
  precioController.actualizarPrecios,
);

module.exports = router;
