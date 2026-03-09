const {
  MovimientoLlenadero,
  Llenadero,
  Usuario,
  TipoCombustible,
} = require("../../models");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { paginate } = require("../../helpers/paginationHelper");
const { Op } = require("sequelize");

/**
 * Registrar una nueva evaporación
 */
exports.registrarEvaporacion = async (data, user, clientIp) => {
  const { id_usuario } = user;
  const { id_llenadero, cantidad, observacion, fecha_movimiento } = data;

  const cantidadDecimal = parseFloat(cantidad);
  if (isNaN(cantidadDecimal) || cantidadDecimal <= 0) {
    const error = new Error("La cantidad debe ser un número positivo.");
    error.status = 400;
    throw error;
  }

  return await executeTransaction(clientIp, async (t) => {
    // 1. Buscar y Bloquear Llenadero
    const llenadero = await Llenadero.findByPk(id_llenadero, {
      transaction: t,
      lock: true,
    });

    if (!llenadero) {
      const error = new Error("Llenadero no encontrado.");
      error.status = 404;
      throw error;
    }
    if (llenadero.estado !== "ACTIVO") {
      const error = new Error("El llenadero no está activo.");
      error.status = 400;
      throw error;
    }

    // 2. Validación de Regla de Negocio: Solo Gasolina
    let nombreCombustible = "";
    if (llenadero.id_combustible) {
      const tipo = await TipoCombustible.findByPk(llenadero.id_combustible, {
        transaction: t,
      });
      if (tipo) nombreCombustible = tipo.nombre.toUpperCase();
    }

    if (!nombreCombustible.includes("GASOLINA")) {
      const error = new Error(
        `La evaporación solo aplica para GASOLINA. Este llenadero contiene: ${
          nombreCombustible || "Desconocido"
        }`,
      );
      error.status = 400;
      throw error;
    }

    const saldo_anterior = parseFloat(llenadero.disponibilidadActual);
    const capacidad = parseFloat(llenadero.capacidad || 0);

    if (saldo_anterior < cantidadDecimal) {
      const error = new Error(
        `No hay suficiente disponibilidad para registrar esa evaporación. Disponible: ${saldo_anterior}`,
      );
      error.status = 400;
      throw error;
    }

    const saldo_nuevo = saldo_anterior - cantidadDecimal;

    // 3. Actualizar Llenadero
    await llenadero.update(
      { disponibilidadActual: saldo_nuevo },
      { transaction: t },
    );

    // 4. Calcular Porcentajes para el histórico
    const porcentaje_anterior =
      capacidad > 0 ? (saldo_anterior / capacidad) * 100 : 0;
    const porcentaje_nuevo =
      capacidad > 0 ? (saldo_nuevo / capacidad) * 100 : 0;

    // 5. Crear Registro Histórico
    const nuevoMovimiento = await MovimientoLlenadero.create(
      {
        id_llenadero,
        id_usuario,
        tipo_movimiento: "EVAPORACION",
        cantidad: cantidadDecimal,
        saldo_anterior,
        saldo_nuevo,
        porcentaje_anterior,
        porcentaje_nuevo,
        observacion,
        fecha_movimiento: fecha_movimiento || new Date(),
      },
      { transaction: t },
    );

    return { nuevoMovimiento, saldo_nuevo };
  });
};

/**
 * Listar solo Evaporaciones
 */
exports.listarEvaporaciones = async (query) => {
  const { id_llenadero, fecha_inicio, fecha_fin } = query;
  const where = { tipo_movimiento: "EVAPORACION" };

  if (id_llenadero) where.id_llenadero = id_llenadero;

  if (fecha_inicio && fecha_fin) {
    const start = new Date(fecha_inicio);
    const end = new Date(fecha_fin);
    end.setHours(23, 59, 59, 999);
    where.fecha_movimiento = { [Op.between]: [start, end] };
  }

  const searchableFields = ["observacion"];

  return await paginate(MovimientoLlenadero, query, {
    where,
    searchableFields,
    include: [
      { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
      {
        model: Usuario,
        as: "Usuario",
        attributes: ["nombre", "apellido", "cedula"],
      },
    ],
    order: [["fecha_movimiento", "DESC"]],
  });
};
