const biometriaService = require("../../services/despachos/biometriaService");

/**
 * Servicio de Biometría (Controller Refactorizado)
 * Delega la lógica de negocio al servicio biometriaService.js
 */

// --- REGISTRAR BIOMETRÍA (CREAR O ACTUALIZAR) ---
exports.registrarBiometria = async (req, res) => {
  try {
    // Pasamos req.ip para auditoría
    const result = await biometriaService.registrarBiometria(req.body, req.ip);

    // Emitir evento Socket.IO (responsabilidad del controlador/capa web)
    if (req.io) req.io.emit("biometria:actualizado", result.registro);

    res.status(201).json(result);
  } catch (error) {
    console.error("Error en registrarBiometria:", error);
    // Manejo básico de errores de negocio vs servidor
    if (
      error.message.includes("no encontrado") ||
      error.message.includes("no registrada")
    ) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("ya posee") ||
      error.message.includes("ya está registrada") ||
      error.message.includes("requieren")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al procesar registro biométrico" });
  }
};

// --- COMPARAR DOS HUELLAS (PARA VALIDACIÓN EN REGISTRO) ---
exports.compararHuellas = async (req, res) => {
  const { muestra1, muestra2 } = req.body;

  try {
    const result = await biometriaService.compararHuellas(muestra1, muestra2);
    res.json(result);
  } catch (error) {
    console.error("Error en compararHuellas:", error.message);
    if (error.message.includes("requieren")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({
      msg: "Error en el servicio biométrico",
      detalle: error.message,
    });
  }
};

// --- VERIFICAR IDENTIDAD (MATCHING 1:1 CONTRA BD) ---
exports.verificarIdentidad = async (req, res) => {
  const { cedula, muestraActual } = req.body;

  try {
    const result = await biometriaService.verificarIdentidad(
      cedula,
      muestraActual,
    );

    // Si no hubo match, el servicio devuelve un objeto con match: false pero sin lanzar error
    if (result.match === false && result.msg === "Persona no registrada") {
      return res.status(404).json(result);
    }

    // Si no hubo match pero la persona existe
    if (result.match === false) {
      return res.status(200).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Error en verificarIdentidad:", error);
    if (error.message === "Persona no registrada") {
      return res.status(404).json({ match: false, msg: error.message });
    }
    if (error.message.includes("requeridas")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({
      msg: "Error durante la verificación biométrica",
      detalle: error.message,
    });
  }
};

// --- OBTENER REGISTROS (CRUD) ---
exports.obtenerRegistros = async (req, res) => {
  try {
    const results = await biometriaService.obtenerRegistros(req.query, req.usuario);
    res.json(results);
  } catch (error) {
    console.error("Error en obtenerRegistros:", error);
    res.status(500).json({ msg: "Error al obtener listado biométrico" });
  }
};

// --- ELIMINAR REGISTRO ---
exports.eliminarRegistro = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await biometriaService.eliminarRegistro(id);

    if (req.io)
      req.io.emit("biometria:actualizado", {
        id_biometria: id,
        estado: result.estado,
      });

    res.json({ msg: result.msg, estado: result.estado });
  } catch (error) {
    console.error("Error en eliminarRegistro:", error);
    if (error.message === "Registro no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al cambiar estado del registro" });
  }
};

// --- FUNCIÓN PARA VERIFICAR CONEXIÓN (ÚTIL PARA DEBUG) ---
exports.verificarConexionMicroservicio = async (req, res) => {
  try {
    const result = await biometriaService.verificarConexionMicroservicio();
    res.json(result);
  } catch (error) {
    res.status(503).json(error);
  }
};
