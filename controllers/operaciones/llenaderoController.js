const llenaderoService = require("../../services/operaciones/llenaderoService");

/**
 * Crear Llenadero (Solo Admin)
 */
exports.crearLlenadero = async (req, res) => {
  try {
    const nuevoLlenadero = await llenaderoService.crearLlenadero(
      req.body,
      req.ip,
    );

    // Notificar vía socket
    if (req.io) req.io.emit("llenadero:creado", nuevoLlenadero);

    res.status(201).json({
      msg: "Llenadero creado exitosamente",
      llenadero: nuevoLlenadero,
    });
  } catch (error) {
    console.error(error);
    if (error.status === 400 || error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear el llenadero" });
    }
  }
};

/**
 * Obtener Llenaderos (Paginado y Búsqueda)
 */
exports.obtenerLlenaderos = async (req, res) => {
  try {
    const result = await llenaderoService.obtenerLlenaderos(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener llenaderos" });
  }
};

/**
 * Actualizar Llenadero (Solo Admin)
 */
exports.actualizarLlenadero = async (req, res) => {
  const { id } = req.params;

  try {
    const llenadero = await llenaderoService.actualizarLlenadero(
      id,
      req.body,
      req.ip,
    );

    // Notificar vía socket
    if (req.io) req.io.emit("llenadero:actualizado", llenadero);

    res.json({
      msg: "Llenadero actualizado correctamente",
      llenadero,
    });
  } catch (error) {
    console.error(error);
    if (error.status === 404 || error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.status === 400 || error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar el llenadero" });
    }
  }
};

/**
 * Desactivar Llenadero (Solo Admin - Soft Delete)
 */
exports.desactivarLlenadero = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await llenaderoService.desactivarLlenadero(id, req.ip);

    // Notificar vía socket
    if (req.io)
      req.io.emit("llenadero:actualizado", {
        id_llenadero: id,
        estado: "INACTIVO",
      });

    res.json({ msg: "Llenadero desactivado exitosamente" });
  } catch (error) {
    console.error(error);
    if (error.status === 404 || error.message.includes("no encontrado")) {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar el llenadero" });
    }
  }
};

/**
 * Lista Simple (Para selectores)
 */
exports.obtenerListaLlenaderos = async (req, res) => {
  try {
    const llenaderos = await llenaderoService.obtenerListaLlenaderos();
    res.json(llenaderos);
    console.log(llenaderos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener la lista de llenaderos" });
  }
};
