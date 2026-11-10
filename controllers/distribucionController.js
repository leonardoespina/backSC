const distribucionService = require("../services/despachos/distribucionService");

/**
 * Obtener balance y detalle de distribuciones para un ticket nodriza
 */
exports.obtenerDistribucion = async (req, res) => {
  try {
    const data = await distribucionService.obtenerDistribucionPorSolicitud(
      req.params.id,
      req.usuario
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error en obtenerDistribucion:", error);
    res.status(400).json({ success: false, msg: error.message });
  }
};

/**
 * Obtener vehículos/equipos aptos para distribuir
 */
exports.obtenerVehiculosParaDistribucion = async (req, res) => {
  try {
    const data = await distribucionService.obtenerVehiculosParaDistribucion(
      req.params.id,
      req.usuario
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error en obtenerVehiculosParaDistribucion:", error);
    res.status(400).json({ success: false, msg: error.message });
  }
};

/**
 * Registrar una o más entregas de distribución
 */
exports.registrarDistribucion = async (req, res) => {
  try {
    const { items } = req.body;
    const result = await distribucionService.registrarDistribucion(
      req.params.id,
      items,
      req.usuario,
      req.ip
    );
    res.status(201).json(result);
  } catch (error) {
    console.error("Error en registrarDistribucion:", error);
    res.status(400).json({ success: false, msg: error.message });
  }
};

/**
 * Eliminar una entrega de distribución por id_distribucion
 */
exports.eliminarItemDistribucion = async (req, res) => {
  try {
    const result = await distribucionService.eliminarItemDistribucion(
      req.params.id_distribucion,
      req.usuario,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error en eliminarItemDistribucion:", error);
    res.status(400).json({ success: false, msg: error.message });
  }
};
