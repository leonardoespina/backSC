const subdependenciaService = require("../../services/organizacion/subdependenciaService");

// --- CREAR SUBDEPENDENCIA ---
exports.crearSubdependencia = async (req, res) => {
  try {
    const result = await subdependenciaService.crearSubdependencia(
      req.body,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("subdependencia:creado", result.subdependencia);

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("obligatorio") ||
      error.message.includes("vacío") ||
      error.message.includes("ya existe")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear subdependencia" });
    }
  }
};

// --- OBTENER SUBDEPENDENCIAS ---
exports.obtenerSubdependencias = async (req, res) => {
  try {
    const result = await subdependenciaService.obtenerSubdependencias(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener subdependencias" });
  }
};

// --- ACTUALIZAR SUBDEPENDENCIA ---
exports.actualizarSubdependencia = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await subdependenciaService.actualizarSubdependencia(
      id,
      req.body,
      req.ip,
    );

    if (req.io)
      req.io.emit("subdependencia:actualizado", result.subdependencia);

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("obligatorio") ||
      error.message.includes("vacío") ||
      error.message.includes("ya existe")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar subdependencia" });
    }
  }
};

// --- DESACTIVAR SUBDEPENDENCIA ---
exports.desactivarSubdependencia = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await subdependenciaService.desactivarSubdependencia(
      id,
      req.ip,
    );

    if (req.io)
      req.io.emit("subdependencia:actualizado", result.subdependencia);

    res.json({ msg: result.msg, estatus: result.estatus });
  } catch (error) {
    console.error(error);
    if (error.message === "Subdependencia no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al cambiar estado de la subdependencia" });
    }
  }
};
