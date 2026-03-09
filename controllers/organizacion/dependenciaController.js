const dependenciaService = require("../../services/organizacion/dependenciaService");

// --- CREAR DEPENDENCIA ---
exports.crearDependencia = async (req, res) => {
  try {
    const result = await dependenciaService.crearDependencia(req.body, req.ip);

    // Notificar a clientes
    if (req.io) req.io.emit("dependencia:creado", result.dependencia);

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.message === "Categoría no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear dependencia" });
    }
  }
};

// --- OBTENER DEPENDENCIAS ---
exports.obtenerDependencias = async (req, res) => {
  try {
    const result = await dependenciaService.obtenerDependencias(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener dependencias" });
  }
};

// --- ACTUALIZAR DEPENDENCIA ---
exports.actualizarDependencia = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await dependenciaService.actualizarDependencia(
      id,
      req.body,
      req.ip,
    );

    if (req.io) req.io.emit("dependencia:actualizado", result.dependencia);

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar dependencia" });
    }
  }
};

// --- DESACTIVAR DEPENDENCIA ---
exports.desactivarDependencia = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await dependenciaService.desactivarDependencia(id, req.ip);

    if (req.io) req.io.emit("dependencia:actualizado", result.dependencia);

    res.json({ msg: result.msg });
  } catch (error) {
    console.error(error);
    if (error.message === "Dependencia no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar" });
    }
  }
};

// --- LISTAR TODAS (Para selectores) ---
exports.listarTodas = async (req, res) => {
  try {
    const result = await dependenciaService.listarTodas();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al listar dependencias" });
  }
};
