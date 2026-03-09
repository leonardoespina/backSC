const solicitudService = require("../../services/despachos/solicitudService");

/**
 * crearSolicitud
 */
exports.crearSolicitud = async (req, res) => {
  console.log(
    "BODY RECIBIDO EN crearSolicitud:",
    JSON.stringify(req.body, null, 2),
  );
  try {
    const result = await solicitudService.createSolicitud(
      req.body,
      req.usuario,
      req.ip, // Pasar IP para auditoría
    );

    if (req.io) req.io.emit("solicitud:creada", result.solicitud);

    res.status(201).json({
      msg: "Solicitud enviada exitosamente. Ticket generado.",
      data: result.solicitud,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error(error);
    // Manejo de errores básicos, se podría mejorar con un middleware de errores
    if (
      error.message.includes("requerida") ||
      error.message.includes("activa") ||
      error.message.includes("insuficiente") ||
      error.message.includes("configurado") ||
      error.message.includes("venta")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al crear solicitud" });
  }
};

exports.aprobarSolicitud = async (req, res) => {
  const { id } = req.params;

  try {
    const solicitud = await solicitudService.aprobarSolicitud(
      id,
      req.usuario.id_usuario,
      req.ip, // Pasar IP para auditoría
    );

    if (req.io) req.io.emit("solicitud:actualizada", solicitud);

    res.json({ msg: "Solicitud Aprobada", data: solicitud });
  } catch (error) {
    console.error(error);
    if (error.message === "Solicitud no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message === "La solicitud no está en estado Pendiente") {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al aprobar solicitud" });
  }
};

/**
 * obtenerSubdependenciasAutorizadas
 */
exports.obtenerSubdependenciasAutorizadas = async (req, res) => {
  try {
    const subdependencias =
      await solicitudService.obtenerSubdependenciasAutorizadas(req.usuario);
    res.json(subdependencias);
  } catch (error) {
    console.error("Error en obtenerSubdependenciasAutorizadas:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener subdependencias autorizadas" });
  }
};

exports.listarSolicitudes = async (req, res) => {
  try {
    const result = await solicitudService.listarSolicitudes(
      req.query,
      req.usuario,
    );
    res.json(result);
  } catch (error) {
    console.error("Error en listarSolicitudes:", error);
    res.status(500).json({ msg: "Error listando solicitudes" });
  }
};

/**
 * Rechazar (Anular) Solicitud
 * Libera el cupo reintegrándolo al periodo original de la solicitud
 */
exports.rechazarSolicitud = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const result = await solicitudService.rechazarSolicitud(
      id,
      motivo,
      req.ip, // Pasar IP para auditoría
    );
    if (req.io) req.io.emit("solicitud:rechazada", result);
    res.json(result);
  } catch (error) {
    console.error("Error en rechazarSolicitud:", error);
    if (error.message === "Solicitud no encontrada") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("No se puede rechazar")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al procesar el rechazo" });
  }
};

exports.obtenerLlenaderosPorCombustible = async (req, res) => {
  try {
    const { id_tipo_combustible } = req.query;

    if (!id_tipo_combustible) {
      return res
        .status(400)
        .json({ msg: "ID de tipo de combustible requerido" });
    }

    const llenaderos =
      await solicitudService.obtenerLlenaderosPorCombustible(
        id_tipo_combustible,
      );

    res.json(llenaderos);
  } catch (error) {
    console.error("Error en obtenerLlenaderosPorCombustible:", error);
    res.status(500).json({ msg: "Error al obtener llenaderos" });
  }
};
