const medicionService = require("../../services/operaciones/medicionService");

/**
 * crearMedicion
 * Registra una nueva medición física de un tanque
 */
exports.crearMedicion = async (req, res) => {
  try {
    const result = await medicionService.crearMedicion(
      req.body,
      req.usuario,
      req.ip,
    );

    const { nuevaMedicion, v_real, id_tanque, resumen } = result;

    // Notificar via Socket.io
    if (req.io) {
      req.io.emit("tanque:actualizado", {
        id_tanque,
        nivel_actual: v_real,
      });
      req.io.emit("medicion:creada", nuevaMedicion);
    }

    res.status(201).json({
      msg: "Medición física registrada exitosamente.",
      data: nuevaMedicion,
      resumen,
    });
  } catch (error) {
    console.error("Error en crearMedicion:", error);
    if (error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al registrar la medición física." });
  }
};

/**
 * listarMediciones
 */
exports.listarMediciones = async (req, res) => {
  try {
    const result = await medicionService.listarMediciones(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error en listarMediciones:", error);
    res.status(500).json({ msg: "Error al listar mediciones." });
  }
};

/**
 * anularMedicion
 * Cambia el estado a ANULADO.
 */
exports.anularMedicion = async (req, res) => {
  const { id } = req.params;
  try {
    const medicion = await medicionService.anularMedicion(id, req.ip);

    if (req.io) req.io.emit("medicion:actualizada", medicion);

    res.json({ msg: "Medición anulada correctamente." });
  } catch (error) {
    console.error("Error en anularMedicion:", error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya se encuentra anulada")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al anular la medición." });
  }
};

/**
 * actualizarMedicion
 */
exports.actualizarMedicion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await medicionService.actualizarMedicion(
      id,
      req.body,
      req.ip,
    );

    const { medicion, v_real, id_tanque } = result;

    if (req.io) {
      req.io.emit("tanque:actualizado", {
        id_tanque,
        nivel_actual: v_real,
      });
      req.io.emit("medicion:actualizada", medicion);
    }

    res.json({ msg: "Medición actualizada correctamente.", data: medicion });
  } catch (error) {
    console.error("Error en actualizarMedicion:", error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("anulada")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al actualizar la medición." });
  }
};
