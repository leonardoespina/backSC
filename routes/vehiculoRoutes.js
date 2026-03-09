const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const vehiculoController = require("../controllers/vehiculos/vehiculoController");
const {
  autenticarUsuario,
  authorizePermission,
} = require("../middlewares/authMiddleware");
const { PERMISSIONS } = require("../utils/permissions");
const validarCampos = require("../middlewares/validationMiddleware");

// Todas las rutas de vehículos requieren estar logueado
router.use(autenticarUsuario);

// GET /api/vehiculos - Listar y Buscar
router.get("/", vehiculoController.obtenerVehiculos);

// GET /api/vehiculos/lista - Para selectores
router.get("/lista", vehiculoController.obtenerListaVehiculos);

// GET /api/vehiculos/listas/modelos/:id_marca - Para dropdowns dependientes
router.get(
  "/listas/modelos/:id_marca",
  vehiculoController.obtenerModelosPorMarca,
);

// POST /api/vehiculos - Crear (Solo ADMIN)
router.post(
  "/",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),

    check("id_marca", "La marca es obligatoria").isNumeric(),
    check("id_modelo", "El modelo es obligatorio").isNumeric(),
    check("id_categoria", "La categoría es obligatoria").isNumeric(),
    check("id_dependencia", "La dependencia es obligatoria").isNumeric(),
    check("id_subdependencia", "El ID de subdependencia debe ser numérico")
      .optional({ nullable: true })
      .isNumeric(),
    check(
      "id_tipo_combustible",
      "El tipo de combustible es obligatorio",
    ).isNumeric(),
    check("es_generador").optional().isBoolean(),
    check("es_planta").optional().isBoolean(),
    validarCampos,
  ],
  vehiculoController.crearVehiculo,
);

// PUT /api/vehiculos/:id - Modificar (Solo ADMIN)
router.put(
  "/:id",
  [
    authorizePermission(PERMISSIONS.MANAGE_SYSTEM),
    check("placa", "La placa no puede estar vacía").optional().not().isEmpty(),
    check("id_categoria", "El ID de categoría debe ser numérico")
      .optional()
      .isNumeric(),
    check("id_dependencia", "El ID de dependencia debe ser numérico")
      .optional()
      .isNumeric(),
    check("id_tipo_combustible", "El ID de tipo combustible debe ser numérico")
      .optional()
      .isNumeric(),
    check("es_generador").optional().isBoolean(),
    check("es_planta").optional().isBoolean(),
    validarCampos,
  ],
  vehiculoController.actualizarVehiculo,
);

// DELETE /api/vehiculos/:id - Desactivar (Solo ADMIN)
router.delete(
  "/:id",
  [authorizePermission(PERMISSIONS.MANAGE_SYSTEM), validarCampos],
  vehiculoController.desactivarVehiculo,
);

module.exports = router;
