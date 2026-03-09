const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const {
  crearSubdependencia,
  obtenerSubdependencias,
  actualizarSubdependencia,
  desactivarSubdependencia,
} = require("../controllers/organizacion/subdependenciaController");
const validarCampos = require("../middlewares/validationMiddleware");
const { autenticarUsuario } = require("../middlewares/authMiddleware");

// Todas las rutas requieren autenticación para obtener req.usuario
router.use(autenticarUsuario);

// Rutas CRUD para Subdependencia
router.post(
  "/",
  [
    check("nombre", "El nombre es obligatorio").not().isEmpty(),
    check("id_dependencia", "El ID de la dependencia es obligatorio")
      .not()
      .isEmpty(),
    validarCampos,
  ],
  crearSubdependencia,
);
router.get("/", obtenerSubdependencias);
router.put("/:id", actualizarSubdependencia);
router.delete("/:id", desactivarSubdependencia);

module.exports = router;
