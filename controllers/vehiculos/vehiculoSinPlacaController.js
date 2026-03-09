const vehiculoSinPlacaService = require("../../services/vehiculos/vehiculoSinPlacaService");

// --- OBTENER ÚLTIMO CORRELATIVO ---
exports.obtenerUltimoCorrelativo = async (req, res) => {
  try {
    const result = await vehiculoSinPlacaService.obtenerUltimoCorrelativo();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el último correlativo" });
  }
};

// --- GENERAR SIGUIENTE CORRELATIVO ---
exports.generarSiguienteCorrelativo = async (req, res) => {
  try {
    const result = await vehiculoSinPlacaService.generarSiguienteCorrelativo(
      req.ip,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ msg: "Error al generar el siguiente correlativo" });
    }
  }
};

// --- ACTUALIZAR CORRELATIVO MANUALMENTE (Solo Admin) ---
exports.actualizarCorrelativo = async (req, res) => {
  const { nuevoCorrelativo } = req.body;

  try {
    const result = await vehiculoSinPlacaService.actualizarCorrelativo(
      nuevoCorrelativo,
      req.ip,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar el correlativo" });
    }
  }
};

// --- OBTENER CONFIGURACIÓN ACTUAL ---
exports.obtenerConfiguracion = async (req, res) => {
  try {
    const result = await vehiculoSinPlacaService.obtenerConfiguracion();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener la configuración" });
  }
};
