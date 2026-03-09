const transferenciaService = require("../../services/despachos/transferenciaService");

/**
 * crearTransferencia
 */
exports.crearTransferencia = async (req, res) => {
  try {
    const result = await transferenciaService.crearTransferencia(
      req.body,
      req.usuario,
      req.ip,
    );

    const {
      nuevaTransferencia,
      nivel_origen_despues,
      nivel_destino_despues,
      id_tanque_origen,
      id_tanque_destino,
    } = result;

    if (req.io) {
      req.io.emit("tanque:actualizado", {
        id_tanque: id_tanque_origen,
        nivel_actual: nivel_origen_despues,
      });
      req.io.emit("tanque:actualizado", {
        id_tanque: id_tanque_destino,
        nivel_actual: nivel_destino_despues,
      });
      req.io.emit("transferencia:creada", nuevaTransferencia);
    }

    res.status(201).json({
      msg: "Transferencia interna registrada exitosamente.",
      data: nuevaTransferencia,
    });
  } catch (error) {
    console.error("Error en crearTransferencia:", error);
    if (error.message.includes("encontrados")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("insuficiente")) {
      return res.status(400).json({ msg: error.message });
    }
    res
      .status(500)
      .json({ msg: "Error al registrar la transferencia interna." });
  }
};

/**
 * listarTransferencias
 */
exports.listarTransferencias = async (req, res) => {
  try {
    const result = await transferenciaService.listarTransferencias(req.query);
    res.json(result);
  } catch (error) {
    console.error("CRITICAL ERROR en listarTransferencias:", error.message);
    res.status(500).json({
      msg: "Error al listar transferencias.",
      error: error.message,
    });
  }
};

/**
 * actualizarTransferencia
 */
exports.actualizarTransferencia = async (req, res) => {
  const { id } = req.params;
  try {
    const transferencia = await transferenciaService.actualizarTransferencia(
      id,
      req.body,
      req.ip,
    );

    if (req.io) req.io.emit("transferencia:actualizada", transferencia);

    res.json({
      msg: "Transferencia actualizada correctamente.",
      data: transferencia,
    });
  } catch (error) {
    console.error("Error en actualizarTransferencia:", error);
    if (error.message === "Transferencia no encontrada.") {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al actualizar la transferencia." });
  }
};

/**
 * obtenerTransferenciaPorId
 */
exports.obtenerTransferenciaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await transferenciaService.obtenerTransferenciaPorId(id);
    res.json(result);
  } catch (error) {
    console.error("Error en obtenerTransferenciaPorId:", error);
    if (error.message === "Transferencia no encontrada.") {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al obtener detalle." });
  }
};
