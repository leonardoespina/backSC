const precioService = require("../../services/operaciones/precioService");

/**
 * === GESTIÓN DE MONEDAS ===
 */

// Obtener Monedas (con paginación y búsqueda)
exports.obtenerMonedas = async (req, res) => {
  try {
    const result = await precioService.obtenerMonedas(req.query);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener monedas" });
  }
};

// Crear Moneda (Solo Admin)
exports.crearMoneda = async (req, res) => {
  try {
    const nuevaMoneda = await precioService.crearMoneda(req.body, req.ip);

    if (req.io) req.io.emit("moneda:creado", nuevaMoneda);

    res.status(201).json({
      msg: "Moneda creada exitosamente",
      moneda: nuevaMoneda,
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear moneda" });
    }
  }
};

// Actualizar Moneda
exports.actualizarMoneda = async (req, res) => {
  const { id } = req.params;

  try {
    const moneda = await precioService.actualizarMoneda(id, req.body, req.ip);

    if (req.io) req.io.emit("moneda:actualizado", moneda);

    res.json({ msg: "Moneda actualizada correctamente", moneda });
  } catch (error) {
    console.error(error);
    if (error.message === "Moneda no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("Ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar moneda" });
    }
  }
};

// Desactivar Moneda
exports.desactivarMoneda = async (req, res) => {
  const { id } = req.params;

  try {
    const moneda = await precioService.desactivarMoneda(id, req.ip);

    if (req.io) req.io.emit("moneda:actualizado", moneda);

    res.json({ msg: "Moneda desactivada exitosamente" });
  } catch (error) {
    console.error(error);
    if (error.message === "Moneda no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("asociados")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar moneda" });
    }
  }
};

/**
 * === GESTIÓN DE PRECIOS ===
 */

// Obtener Precios Actuales (Vista de Tabla Dinámica)
exports.obtenerPreciosActuales = async (req, res) => {
  try {
    const result = await precioService.obtenerPreciosActuales();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener precios" });
  }
};

// Obtener precios actuales para un combustible específico
exports.obtenerPreciosPorCombustible = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await precioService.obtenerPreciosPorCombustible(id);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener precios por combustible" });
  }
};

// Actualizar Precios para un Combustible
exports.actualizarPrecios = async (req, res) => {
  try {
    const result = await precioService.actualizarPrecios(req.body, req.ip);

    if (req.io) req.io.emit("precio:actualizado", result);

    res.json({ msg: "Precios actualizados correctamente" });
  } catch (error) {
    console.error(error);
    if (error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar precios" });
    }
  }
};
