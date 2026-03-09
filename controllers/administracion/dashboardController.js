const dashboardService = require("../../services/administracion/dashboardService");

/**
 * Obtener estadísticas globales para el Dashboard
 */
exports.obtenerStats = async (req, res) => {
  try {
    const stats = await dashboardService.getStats();

    // Notificar al Dashboard que ha sido consultado (opcional, para real-time tracking)
    if (req.io) {
      req.io.emit("dashboard:consultado", { fecha: new Date() });
    }

    res.json(stats);
  } catch (error) {
    console.error("CRITICAL Error Dashboard Stats:", error);
    res
      .status(500)
      .json({ msg: "Error al generar estadísticas.", error: error.message });
  }
};
