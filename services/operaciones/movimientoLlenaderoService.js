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
 * Crear un nuevo movimiento (Carga o Evaporación)
 */
exports.crearMovimiento = async (data, user, clientIp) => {
  const { id_usuario } = user;
  const {
    id_llenadero,
    tipo_movimiento,
    cantidad,
    observacion,
    fecha_movimiento,
    numero_factura,
    litros_factura,
    datos_gandola,
    nombre_conductor,
    cedula_conductor,
  } = data;

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

    const saldo_anterior = parseFloat(llenadero.disponibilidadActual);
    const capacidad = parseFloat(llenadero.capacidad || 0);
    let saldo_nuevo = 0;

    // 2. Validaciones y Cálculos según Tipo
    if (tipo_movimiento === "CARGA") {
      if (llenadero.capacidad) {
        if (saldo_anterior + cantidadDecimal > capacidad) {
          const error = new Error(
            `La carga excede la capacidad del tanque. Capacidad: ${capacidad}, Actual: ${saldo_anterior}, Intento: ${cantidadDecimal}`,
          );
          error.status = 400;
          throw error;
        }
      }
      saldo_nuevo = saldo_anterior + cantidadDecimal;

      if (
        !numero_factura ||
        !datos_gandola ||
        !nombre_conductor ||
        !cedula_conductor
      ) {
        const error = new Error(
          "Todos los datos son obligatorios para la Carga: Factura, Placa, Nombre y Cédula del Conductor.",
        );
        error.status = 400;
        throw error;
      }
    } else if (tipo_movimiento === "EVAPORACION") {
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

      if (saldo_anterior < cantidadDecimal) {
        const error = new Error(
          `No hay suficiente disponibilidad para registrar esa evaporación. Disponible: ${saldo_anterior}`,
        );
        error.status = 400;
        throw error;
      }
      saldo_nuevo = saldo_anterior - cantidadDecimal;
    } else {
      const error = new Error("Tipo de movimiento inválido.");
      error.status = 400;
      throw error;
    }

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
        tipo_movimiento,
        cantidad: cantidadDecimal,
        saldo_anterior,
        saldo_nuevo,
        porcentaje_anterior,
        porcentaje_nuevo,
        observacion,
        numero_factura: tipo_movimiento === "CARGA" ? numero_factura : null,
        litros_factura: tipo_movimiento === "CARGA" ? litros_factura : null,
        datos_gandola: tipo_movimiento === "CARGA" ? datos_gandola : null,
        nombre_conductor: tipo_movimiento === "CARGA" ? nombre_conductor : null,
        cedula_conductor: tipo_movimiento === "CARGA" ? cedula_conductor : null,
        fecha_movimiento: fecha_movimiento || new Date(),
      },
      { transaction: t },
    );

    return { nuevoMovimiento, saldo_nuevo };
  });
};

/**
 * Listar Movimientos
 */
exports.listarMovimientos = async (query) => {
  const { id_llenadero, tipo_movimiento, fecha_inicio, fecha_fin } = query;
  const where = {};

  if (id_llenadero) where.id_llenadero = id_llenadero;
  if (tipo_movimiento) where.tipo_movimiento = tipo_movimiento;

  if (fecha_inicio && fecha_fin) {
    const start = new Date(fecha_inicio);
    const end = new Date(fecha_fin);
    end.setHours(23, 59, 59, 999);
    where.fecha_movimiento = { [Op.between]: [start, end] };
  }

  const searchableFields = ["numero_factura", "observacion", "datos_gandola"];

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
