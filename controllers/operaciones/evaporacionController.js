const evaporacionService = require("../../services/operaciones/evaporacionService");

/**
 * Registrar una nueva evaporación
 * Solo permitido para Gasolina. Resta inventario.
 */
exports.registrarEvaporacion = async (req, res) => {
  try {
    const result = await evaporacionService.registrarEvaporacion(
      req.body,
      req.usuario,
      req.ip,
    );

    // Notificar socket
    if (req.io) {
      req.io.emit("llenadero:actualizado", {
        id_llenadero: req.body.id_llenadero,
        disponibilidadActual: result.saldo_nuevo,
      });
    }

    res.status(201).json({
      msg: "Evaporación registrada exitosamente.",
      data: result.nuevoMovimiento,
    });
  } catch (error) {
    console.error("Error en registrarEvaporacion:", error);
    const status = error.status || 500;
    const msg = error.msg || error.message || "Error al registrar evaporación.";
    res.status(status).json({ msg });
  }
};

/**
 * Listar solo Evaporaciones
 */
exports.listarEvaporaciones = async (req, res) => {
  try {
    const result = await evaporacionService.listarEvaporaciones(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error en listarEvaporaciones:", error);
    res.status(500).json({ msg: "Error al listar evaporaciones." });
  }
};
