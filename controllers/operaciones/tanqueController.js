const tanqueService = require("../../services/operaciones/tanqueService");

// --- CREAR TANQUE (Solo Admin) ---
exports.crearTanque = async (req, res) => {
  try {
    const tanque = await tanqueService.crearTanque(req.body, req.ip);

    if (req.io) req.io.emit("tanque:creado", tanque);

    res.status(201).json({ msg: "Tanque registrado exitosamente", tanque });
  } catch (error) {
    console.error("Error al crear tanque:", error);
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error interno al registrar el tanque" });
    }
  }
};

// --- OBTENER TANQUES (Paginado + Filtros) ---
exports.obtenerTanques = async (req, res) => {
  try {
    const result = await tanqueService.obtenerTanques(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener tanques:", error);
    res.status(500).json({ msg: "Error al obtener el listado de tanques" });
  }
};

// --- ACTUALIZAR TANQUE (Solo Admin) ---
exports.actualizarTanque = async (req, res) => {
  const { id } = req.params;

  try {
    const tanque = await tanqueService.actualizarTanque(id, req.body, req.ip);

    if (req.io) req.io.emit("tanque:actualizado", tanque);

    res.json({ msg: "Tanque actualizado correctamente", tanque });
  } catch (error) {
    console.error("Error al actualizar tanque:", error);
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al modificar los datos del tanque" });
    }
  }
};

// --- OBTENER UN SOLO TANQUE ---
exports.obtenerTanquePorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tanqueService.obtenerTanquePorId(id);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener detalle de tanque:", error);
    if (error.status === 404) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al obtener el detalle del tanque" });
  }
};

// --- DESACTIVAR / CAMBIAR ESTADO (Soft Delete) ---
exports.eliminarTanque = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await tanqueService.eliminarTanque(id, req.ip);

    if (req.io)
      req.io.emit("tanque:actualizado", {
        id_tanque: id,
        estado: "INACTIVO",
      });

    res.json({ msg: "Tanque desactivado exitosamente" });
  } catch (error) {
    console.error("Error al desactivar tanque:", error);
    if (error.status === 404) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al desactivar el recurso" });
  }
};

// --- LISTA SIMPLE ---
exports.obtenerListaTanques = async (req, res) => {
  try {
    const result = await tanqueService.obtenerListaTanques(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener lista de tanques:", error);
    res.status(500).json({ msg: "Error al obtener lista de tanques" });
  }
};
