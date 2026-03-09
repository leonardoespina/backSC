const validacionService = require("../../services/despachos/validacionService");

/**
 * Consultar datos de un Ticket para validación
 */
exports.consultarTicket = async (req, res) => {
  const { codigo } = req.params;

  try {
    const result = await validacionService.consultarTicket(codigo);
    res.json(result);
  } catch (error) {
    console.error("Error consultando ticket:", error);
    if (error.status === 404) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({
        msg: error.message,
        status: error.statusCode,
      });
    }
    res.status(500).json({ msg: "Error al consultar ticket" });
  }
};

/**
 * Finalizar Ticket (Cierre administrativo)
 * - Valida contraseña/seguridad (Simulado o real)
 * - Procesa excedentes (Reintegro) si aplica
 * - Cambia estado a FINALIZADA
 */
exports.finalizarTicket = async (req, res) => {
  try {
    const result = await validacionService.finalizarTicket(
      req.body,
      req.usuario,
      req.ip,
    );

    // Notificar
    if (req.io) {
      req.io.emit("solicitud:finalizada", {
        id_solicitud: result.ticket.id_solicitud,
        codigo: req.body.codigo_ticket,
      });
      if (result.updatedCupoId) {
        req.io.emit("cupo:actualizado", {
          id_cupo_actual: result.updatedCupoId,
        });
      }
    }

    res.json({
      msg: result.msg,
      detalle: result.detalle,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error("Error finalizando ticket:", error);
    if (error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("requerido") ||
      error.message.includes("debe estar") ||
      error.message.includes("mayor a la aprobada")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al finalizar ticket" });
  }
};
