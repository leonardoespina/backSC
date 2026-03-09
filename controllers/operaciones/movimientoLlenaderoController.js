const movimientoLlenaderoService = require("../../services/operaciones/movimientoLlenaderoService");

/**
 * Crear un nuevo movimiento (Carga o Evaporación)
 * Utiliza withTransaction para garantizar integridad y auditoría DB.
 */
exports.crearMovimiento = async (req, res) => {
  try {
    const result = await movimientoLlenaderoService.crearMovimiento(
      req.body,
      req.usuario,
      req.ip,
    );

    // Éxito - Notificar socket
    if (req.io) {
      req.io.emit("llenadero:actualizado", {
        id_llenadero: req.body.id_llenadero,
        disponibilidadActual: result.saldo_nuevo,
      });
    }

    res.status(201).json({
      msg: "Movimiento registrado exitosamente.",
      data: result.nuevoMovimiento,
    });
  } catch (error) {
    console.error("Error en crearMovimiento:", error);
    const status = error.status || 500;
    const msg = error.msg || error.message || "Error al registrar movimiento.";
    res.status(status).json({ msg });
  }
};

/**
 * Listar Movimientos con paginación y filtros
 */
exports.listarMovimientos = async (req, res) => {
  try {
    const result = await movimientoLlenaderoService.listarMovimientos(
      req.query,
    );
    res.json(result);
  } catch (error) {
    console.error("Error en listarMovimientos:", error);
    res.status(500).json({ msg: "Error al listar movimientos." });
  }
};
