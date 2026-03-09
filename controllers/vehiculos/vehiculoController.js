const vehiculoService = require("../../services/vehiculos/vehiculoService");

// --- CREAR VEHÍCULO (Solo Admin) ---
exports.crearVehiculo = async (req, res) => {
  try {
    const result = await vehiculoService.crearVehiculo(
      req.body,
      req.usuario,
      req.ip,
    );

    // Notificar vía socket
    if (req.io) req.io.emit("vehiculo:creado", result.vehiculo);

    res.status(201).json({
      msg: "Vehículo registrado exitosamente",
      vehiculo: result.vehiculo,
      ...(result.placaGenerada && { placaGenerada: result.placaGenerada }),
    });
  } catch (error) {
    console.error(error);
    if (
      error.message.includes("ya está registrada") ||
      error.message.includes("no pertenece") ||
      error.message.includes("no es válido")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al registrar vehículo" });
    }
  }
};

// --- OBTENER VEHÍCULOS (Paginado + Filtros) ---
exports.obtenerVehiculos = async (req, res) => {
  try {
    const result = await vehiculoService.obtenerVehiculos(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener vehículos" });
  }
};

// --- ACTUALIZAR VEHÍCULO ---
exports.actualizarVehiculo = async (req, res) => {
  const { id } = req.params;

  try {
    const vehiculo = await vehiculoService.actualizarVehiculo(
      id,
      req.body,
      req.ip,
    );

    if (req.io) req.io.emit("vehiculo:actualizado", vehiculo);
    res.json({ msg: "Vehículo actualizado correctamente", vehiculo });
  } catch (error) {
    console.error(error);
    if (error.message === "Vehículo no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("ya está registrada") ||
      error.message.includes("no coincide") ||
      error.message.includes("inválido")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar vehículo" });
    }
  }
};

// --- DESACTIVAR VEHÍCULO (Solo Admin) ---
exports.desactivarVehiculo = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await vehiculoService.desactivarVehiculo(id, req.ip);

    if (req.io)
      req.io.emit("vehiculo:actualizado", {
        id_vehiculo: id,
        estado: "INACTIVO",
      });
    res.json({ msg: "Vehículo desactivado exitosamente" });
  } catch (error) {
    console.error(error);
    if (error.message === "Vehículo no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al desactivar" });
  }
};

// --- LISTA SIMPLE (Para selectores) ---
exports.obtenerListaVehiculos = async (req, res) => {
  try {
    const vehiculos = await vehiculoService.obtenerListaVehiculos(req.query);
    res.json(vehiculos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al listar vehículos" });
  }
};

// --- MODELOS POR MARCA ---
exports.obtenerModelosPorMarca = async (req, res) => {
  const { id_marca } = req.params;
  try {
    const modelos = await vehiculoService.obtenerModelosPorMarca(id_marca);
    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener modelos" });
  }
};
