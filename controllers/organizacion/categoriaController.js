const categoriaService = require("../../services/organizacion/categoriaService");

// --- CREAR CATEGORÍA (Solo Admin) ---
exports.crearCategoria = async (req, res) => {
  try {
    const result = await categoriaService.crearCategoria(
      req.body,
      req.usuario.id_usuario,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("categoria:creado", result.categoria);

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error en el servidor" });
    }
  }
};

// --- OBTENER JERARQUÍA (Lazy Loading / Search) ---
exports.obtenerJerarquia = async (req, res) => {
  try {
    const result = await categoriaService.obtenerJerarquia(req.query);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error obteniendo jerarquía de categorías" });
  }
};

// --- OBTENER CATEGORÍAS (Solo Admin o Auth) ---
exports.obtenerCategorias = async (req, res) => {
  try {
    const result = await categoriaService.obtenerCategorias(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error obteniendo categorías" });
  }
};

// --- ACTUALIZAR CATEGORÍA ---
exports.actualizarCategoria = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await categoriaService.actualizarCategoria(
      id,
      req.body,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("categoria:actualizado", result.categoria);

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message === "Categoría no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar categoría" });
    }
  }
};

// --- DESACTIVAR CATEGORÍA ---
exports.desactivarCategoria = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await categoriaService.desactivarCategoria(id, req.ip);

    // Notificar a clientes
    if (req.io) req.io.emit("categoria:actualizado", result.categoria);

    res.json({ msg: result.msg });
  } catch (error) {
    console.error(error);
    if (error.message === "Categoría no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("No se puede desactivar")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar categoría" });
    }
  }
};
