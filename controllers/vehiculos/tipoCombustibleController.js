const tipoCombustibleService = require("../../services/vehiculos/tipoCombustibleService");

// --- CREAR TIPO DE COMBUSTIBLE ---
exports.crearTipoCombustible = async (req, res) => {
  try {
    const tipo = await tipoCombustibleService.crearTipoCombustible(
      req.body,
      req.ip,
    );

    if (req.io) req.io.emit("tipo_combustible:creado", tipo);

    res
      .status(201)
      .json({ msg: "Tipo de combustible creado exitosamente", data: tipo });
  } catch (error) {
    console.error(error);
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear tipo de combustible" });
    }
  }
};

// --- OBTENER TIPOS DE COMBUSTIBLE (Paginado) ---
exports.obtenerTiposCombustible = async (req, res) => {
  try {
    const result = await tipoCombustibleService.obtenerTiposCombustible(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener tipos de combustible" });
  }
};

// --- OBTENER TODOS (Lista simple para Selects) ---
exports.listarTodos = async (req, res) => {
  try {
    const result = await tipoCombustibleService.listarTodos();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al listar tipos de combustible" });
  }
};

// --- ACTUALIZAR TIPO DE COMBUSTIBLE ---
exports.actualizarTipoCombustible = async (req, res) => {
  const { id } = req.params;

  try {
    const tipo = await tipoCombustibleService.actualizarTipoCombustible(
      id,
      req.body,
      req.ip,
    );

    if (req.io) req.io.emit("tipo_combustible:actualizado", tipo);

    res.json({ msg: "Tipo de combustible actualizado", data: tipo });
  } catch (error) {
    console.error(error);
    if (error.message === "Tipo de combustible no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar tipo de combustible" });
    }
  }
};

// --- ELIMINAR (Soft Delete / Desactivar) ---
exports.eliminarTipoCombustible = async (req, res) => {
  const { id } = req.params;
  try {
    const tipo = await tipoCombustibleService.eliminarTipoCombustible(
      id,
      req.ip,
    );

    if (req.io) req.io.emit("tipo_combustible:actualizado", tipo);
    res.json({ msg: "Tipo de combustible desactivado" });
  } catch (error) {
    console.error(error);
    if (error.message === "Tipo de combustible no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar tipo de combustible" });
    }
  }
};
