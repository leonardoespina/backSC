const despachoService = require("../../services/despachos/despachoService");

/**
 * Lista todas las solicitudes aprobadas listas para despacho
 */
exports.listarSolicitudesParaDespacho = async (req, res) => {
  try {
    const result = await despachoService.listarSolicitudesParaDespacho(
      req.query,
    );
    res.json(result);
  } catch (error) {
    console.error("Error en listarSolicitudesParaDespacho:", error);
    res.status(500).json({ msg: "Error listando solicitudes para despacho" });
  }
};

/**
 * Validar Firma Biométrica
 */
exports.validarFirma = async (req, res) => {
  const { cedula, huella, id_solicitud, validar_pertenencia } = req.body;

  try {
    const result = await despachoService.validarFirma(
      cedula,
      huella,
      id_solicitud,
      validar_pertenencia === true,
    );
    res.json(result);
  } catch (error) {
    console.error("Error en validarFirma:", error);
    if (
      error.message.includes("Faltan datos") ||
      error.message.includes("no coincide")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.message === "Solicitud no encontrada.") {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("no coincide con el usuario") ||
      error.message.includes("no pertenece a la dependencia") ||
      error.message.includes("no pertenece a la subdependencia")
    ) {
      return res.status(403).json({ msg: error.message });
    }
    if (error.message.includes("no tiene roles")) {
      return res.status(403).json({ msg: error.message });
    }
    res.status(500).json({
      msg: "Error interno al validar firma biométrica.",
      details: error.message,
    });
  }
};

/**
 * Imprimir Ticket (Genera Código y marca como IMPRESA)
 */
exports.imprimirTicket = async (req, res) => {
  const { id } = req.params;

  // Agregar id_solicitud al body para el servicio
  const data = { ...req.body, id_solicitud: id };

  try {
    const result = await despachoService.imprimirTicket(
      data,
      req.usuario,
      req.ip,
    );
    res.json(result);
  } catch (error) {
    console.error("CRITICAL ERROR in imprimirTicket:", error);
    if (
      error.message.includes("Faltan datos") ||
      error.message.includes("debe estar Aprobada")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.message.includes("no encontrada")) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("Sesión") ||
      error.message.includes("No coincide")
    ) {
      return res.status(401).json({ msg: error.message });
    }
    if (error.message.includes("no tiene rol")) {
      return res.status(403).json({ msg: error.message });
    }
    res.status(500).json({
      msg: "Error generando ticket",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

/**
 * Reimprimir Ticket
 */
exports.reimprimirTicket = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await despachoService.reimprimirTicket(id);
    res.json(result);
  } catch (error) {
    console.error("CRITICAL ERROR in reimprimirTicket:", error);
    if (error.message.includes("Solo se pueden reimprimir")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({
      msg: "Error al reimprimir",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

/**
 * Despachar Solicitud (Escaneo QR y descuento de inventario)
 */
exports.despacharSolicitud = async (req, res) => {
  try {
    const result = await despachoService.despacharSolicitud(req.body, req.ip);

    if (req.io) req.io.emit("solicitud:despachada", result.solicitud);

    res.json({ msg: result.msg });
  } catch (error) {
    console.error(error);
    if (error.message.includes("requerido")) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.message === "Ticket no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("no puede ser despachado") ||
      error.message.includes("insuficiente") ||
      error.message.includes("más de lo aprobado")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al registrar despacho" });
  }
};
