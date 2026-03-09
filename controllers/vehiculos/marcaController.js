const marcaService = require("../../services/vehiculos/marcaService");

// --- CREAR MARCA (Solo Admin) ---
exports.crearMarca = async (req, res) => {
  try {
    const nuevaMarca = await marcaService.crearMarca(
      req.body,
      req.usuario,
      req.ip,
    );

    // Notificar vía socket
    if (req.io) req.io.emit("marca:creado", nuevaMarca);

    res.status(201).json({
      msg: "Marca creada exitosamente",
      marca: nuevaMarca,
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al crear la marca" });
    }
  }
};

// --- OBTENER MARCAS (Paginado y Búsqueda) ---
exports.obtenerMarcas = async (req, res) => {
  try {
    const result = await marcaService.obtenerMarcas(req.query, req.usuario);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener marcas" });
  }
};

// --- ACTUALIZAR MARCA (Solo Admin) ---
exports.actualizarMarca = async (req, res) => {
  const { id } = req.params;

  try {
    const marca = await marcaService.actualizarMarca(id, req.body, req.ip);

    // Notificar vía socket
    if (req.io) req.io.emit("marca:actualizado", marca);

    res.json({
      msg: "Marca actualizada correctamente",
      marca,
    });
  } catch (error) {
    console.error(error);
    if (error.message === "Marca no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar la marca" });
    }
  }
};

// --- DESACTIVAR MARCA (Solo Admin - Soft Delete) ---
exports.desactivarMarca = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await marcaService.desactivarMarca(id, req.ip);

    // Notificar vía socket
    if (req.io)
      req.io.emit("marca:actualizado", { id_marca: id, estado: "INACTIVO" });

    res.json({ msg: "Marca desactivada exitosamente" });
  } catch (error) {
    console.error(error);
    if (error.message === "Marca no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar la marca" });
    }
  }
};

// --- LISTA SIMPLE (Para selectores) ---
exports.obtenerListaMarcas = async (req, res) => {
  try {
    const marcas = await marcaService.obtenerListaMarcas();
    res.json(marcas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener la lista de marcas" });
  }
};
