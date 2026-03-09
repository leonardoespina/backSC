const cargaCisternaService = require("../../services/operaciones/cargaCisternaService");

/**
 * crearCargaCisterna
 */
exports.crearCargaCisterna = async (req, res) => {
  try {
    const result = await cargaCisternaService.crearCargaCisterna(
      req.body,
      req.usuario,
      req.ip,
    );

    const { nuevaCarga, nuevoNivel, id_tanque } = result;

    if (req.io) {
      req.io.emit("tanque:actualizado", {
        id_tanque: id_tanque,
        nivel_actual: nuevoNivel,
      });
      req.io.emit("carga:creada", nuevaCarga);
    }

    res.status(201).json({
      msg: "Carga de cisterna registrada exitosamente.",
      data: nuevaCarga,
    });
  } catch (error) {
    console.error("Error en crearCargaCisterna:", error);
    if (error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al registrar la carga." });
  }
};

/**
 * listarCargasCisterna
 */
exports.listarCargasCisterna = async (req, res) => {
  try {
    const result = await cargaCisternaService.listarCargasCisterna(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error en listarCargasCisterna:", error);
    res.status(500).json({ msg: "Error al listar cargas." });
  }
};

/**
 * actualizarCarga
 */
exports.actualizarCarga = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await cargaCisternaService.actualizarCarga(
      id,
      req.body,
      req.ip,
    );

    const { carga, nuevoNivel, id_tanque } = result;

    if (req.io) {
      if (nuevoNivel !== null) {
        req.io.emit("tanque:actualizado", {
          id_tanque: id_tanque,
          nivel_actual: nuevoNivel,
        });
      }
      req.io.emit("carga:actualizada", carga);
    }

    res.json({ msg: "Carga actualizada correctamente.", data: carga });
  } catch (error) {
    console.error("Error en actualizarCarga:", error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al actualizar la carga." });
  }
};
