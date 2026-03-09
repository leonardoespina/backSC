const modeloService = require("../../services/vehiculos/modeloService");

// --- CREAR MODELO (Solo Admin) ---
exports.crearModelo = async (req, res) => {
  try {
    const nuevoModelo = await modeloService.crearModelo(req.body, req.ip);

    // Notificar vía socket
    if (req.io) req.io.emit("modelo:creado", nuevoModelo);

    res.status(201).json({
      msg: "Modelo creado exitosamente",
      modelo: nuevoModelo,
    });
  } catch (error) {
    console.error(error);
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear modelo" });
    }
  }
};

// --- OBTENER MODELOS (Solo Admin - Paginado) ---
exports.obtenerModelos = async (req, res) => {
  try {
    const result = await modeloService.obtenerModelos(req.query, req.usuario);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener modelos" });
  }
};

// --- ACTUALIZAR MODELO (Solo Admin) ---
exports.actualizarModelo = async (req, res) => {
  const { id } = req.params;

  try {
    const modelo = await modeloService.actualizarModelo(id, req.body, req.ip);

    if (req.io) req.io.emit("modelo:actualizado", modelo);

    res.json({ msg: "Modelo actualizado", modelo });
  } catch (error) {
    console.error(error);
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar modelo" });
    }
  }
};

// --- DESACTIVAR MODELO (Solo Admin) ---
exports.desactivarModelo = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await modeloService.desactivarModelo(id, req.ip);

    if (req.io)
      req.io.emit("modelo:actualizado", { id_modelo: id, estado: "INACTIVO" });

    res.json({ msg: "Modelo desactivado exitosamente" });
  } catch (error) {
    console.error(error);
    if (error.status === 404) {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar modelo" });
    }
  }
};
