const cupoService = require("../../services/despachos/cupoService");

// --- CONTROLADOR DE CUPOS ---

/**
 * Obtener todos los cupos base (Paginado y Filtrado)
 */
exports.obtenerCuposBase = async (req, res) => {
  try {
    const paginatedResults = await cupoService.obtenerCuposBase(req.query);
    res.json(paginatedResults);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener cupos base" });
  }
};

/**
 * Crear un nuevo cupo base
 */
exports.crearCupoBase = async (req, res) => {
  try {
    const nuevoCupo = await cupoService.crearCupoBase(req.body, req.ip);

    // Notificar via socket
    if (req.io) req.io.emit("cupo:creado", nuevoCupo);

    res
      .status(201)
      .json({ msg: "Cupo base creado exitosamente", data: nuevoCupo });
  } catch (error) {
    console.error(error);
    if (error.message.includes("Ya existe")) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        msg: "Ya existe un cupo para esta combinación de categoría, dependencia, subdependencia y combustible",
      });
    }
    res.status(500).json({ msg: "Error al crear cupo base" });
  }
};

/**
 * Actualizar cupo base (cambia la asignación mensual para futuros meses)
 */
exports.actualizarCupoBase = async (req, res) => {
  const { id } = req.params;

  try {
    const cupo = await cupoService.actualizarCupoBase(id, req.body, req.ip);

    if (req.io) req.io.emit("cupo:actualizado", cupo);

    res.json({ msg: "Cupo base actualizado", data: cupo });
  } catch (error) {
    console.error(error);
    if (error.message === "Cupo base no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al actualizar cupo base" });
  }
};

/**
 * Obtener estado de cupos actuales (Vista Principal - Paginada)
 */
exports.obtenerCupoEspecifico = async (req, res) => {
  try {
    const cupo = await cupoService.obtenerCupoEspecifico(req.query);
    res.json({ data: cupo });
  } catch (error) {
    console.error(error);
    if (error.message.includes("Faltan parámetros")) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.message.includes("No se encontró cupo")) {
      return res.status(404).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al obtener el cupo específico" });
  }
};

exports.obtenerCuposActuales = async (req, res) => {
  try {
    const paginatedResults = await cupoService.obtenerCuposActuales(req.query);
    res.json(paginatedResults);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener cupos actuales" });
  }
};

/**
 * Consumir Cupo (Función Principal 1)
 */
exports.consumirCupo = async (req, res) => {
  try {
    const result = await cupoService.consumirCupo(req.body, req.ip);

    // Emitir evento de actualización de saldo
    if (req.io)
      req.io.emit("cupo:consumo", {
        id_cupo_actual: result.id_cupo_actual,
        nuevo_saldo: result.saldo_actual,
      });

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("No existe")) {
      return res.status(404).json({ msg: error.message });
    }
    if (
      error.message.includes("está") ||
      error.message.includes("insuficiente")
    ) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al procesar el consumo" });
  }
};

/**
 * Recargar Cupo (Función Principal 2)
 */
exports.recargarCupo = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;

  try {
    const result = await cupoService.recargarCupo(req.body, id_usuario, req.ip);

    if (req.io)
      req.io.emit("cupo:recarga", {
        id_cupo_actual: result.id_cupo_actual,
        nuevo_saldo: result.saldo_nuevo,
      });

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("No se encontró")) {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("excede")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al procesar la recarga" });
  }
};

/**
 * Reiniciar Cupos Mensuales (Función Principal 3 - Automatizada)
 * Esta función se debe llamar desde un CRON JOB el día 1 de cada mes.
 */
exports.reiniciarCuposMensuales = async (req, res) => {
  try {
    // Si se llama desde HTTP, tenemos req.ip. Si es Cron, usamos SYSTEM.
    const clientIp = req ? req.ip : "SYSTEM";

    const result = await cupoService.reiniciarCuposMensuales(clientIp);

    // Si hay respuesta HTTP, la enviamos
    if (res) {
      return res.json(result);
    }

    // Si no hay res (Cron), retornamos el objeto para que el script lo use
    return result;
  } catch (error) {
    console.error("Error crítico en reinicio mensual:", error);
    if (res) {
      return res.status(500).json({ success: false, error: error.message });
    }
    // Para Cron
    return { success: false, error: error.message };
  }
};
