const CupoBase = require("../../models/CupoBase");
const CupoActual = require("../../models/CupoActual");
const RecargaCupo = require("../../models/RecargaCupo");
const ConsumoCupo = require("../../models/ConsumoCupo");
const HistorialCupoMensual = require("../../models/HistorialCupoMensual");
const Categoria = require("../../models/Categoria");
const Dependencia = require("../../models/Dependencia");
const Subdependencia = require("../../models/Subdependencia");
const TipoCombustible = require("../../models/TipoCombustible");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");
const moment = require("moment");

/**
 * Obtener cupos base
 */
exports.obtenerCuposBase = async (query) => {
  const searchableFields = [
    "$Categoria.nombre$",
    "$Dependencia.nombre_dependencia$",
    "$Subdependencia.nombre$",
  ];

  const include = [
    { model: Categoria, as: "Categoria", attributes: ["nombre"] },
    {
      model: Dependencia,
      as: "Dependencia",
      attributes: ["nombre_dependencia"],
    },
    { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
    { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
  ];

  return await paginate(CupoBase, query, {
    searchableFields,
    include,
  });
};

/**
 * Crear cupo base
 */
exports.crearCupoBase = async (data, clientIp) => {
  const {
    id_categoria,
    id_dependencia,
    id_subdependencia,
    id_tipo_combustible,
    cantidad_mensual,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // Verificar existencia
    const existing = await CupoBase.findOne({
      where: {
        id_categoria,
        id_dependencia,
        id_subdependencia: id_subdependencia || null,
        id_tipo_combustible,
      },
      transaction: t,
    });

    if (existing) {
      throw new Error(
        "Ya existe un cupo para esta combinación de categoría, dependencia, subdependencia y combustible",
      );
    }

    const nuevoCupo = await CupoBase.create(
      {
        id_categoria,
        id_dependencia,
        id_subdependencia: id_subdependencia || null,
        id_tipo_combustible,
        cantidad_mensual,
      },
      { transaction: t },
    );

    // Crear cupo actual para el mes en curso
    const periodoActual = moment().format("YYYY-MM");
    const fechaInicio = moment().startOf("month").toDate();
    const fechaFin = moment().endOf("month").toDate();

    await CupoActual.create(
      {
        id_cupo_base: nuevoCupo.id_cupo_base,
        periodo: periodoActual,
        cantidad_asignada: cantidad_mensual,
        cantidad_disponible: cantidad_mensual,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: "ACTIVO",
      },
      { transaction: t },
    );

    return nuevoCupo;
  });
};

/**
 * Actualizar cupo base
 */
exports.actualizarCupoBase = async (id, data, clientIp) => {
  const { cantidad_mensual, activo } = data;

  return await executeTransaction(clientIp, async (t) => {
    const cupo = await CupoBase.findByPk(id, { transaction: t });
    if (!cupo) {
      throw new Error("Cupo base no encontrado");
    }

    await cupo.update(
      {
        cantidad_mensual:
          cantidad_mensual !== undefined
            ? cantidad_mensual
            : cupo.cantidad_mensual,
        activo: activo !== undefined ? activo : cupo.activo,
        updated_at: new Date(),
      },
      { transaction: t },
    );

    // Actualizar cupo actual si cambia la cantidad mensual
    if (cantidad_mensual !== undefined) {
      const periodoActual = moment().format("YYYY-MM");
      const cupoActual = await CupoActual.findOne({
        where: {
          id_cupo_base: id,
          periodo: periodoActual,
        },
        transaction: t,
        lock: true, // Bloqueo para evitar inconsistencias
      });

      if (cupoActual) {
        const nuevaCantidadAsignada = parseFloat(cantidad_mensual);
        const consumida = parseFloat(cupoActual.cantidad_consumida || 0);
        const recargada = parseFloat(cupoActual.cantidad_recargada || 0);

        // Recalcular Disponible = Asignada + Recargada - Consumida
        let nuevaDisponible = nuevaCantidadAsignada + recargada - consumida;
        if (nuevaDisponible < 0) {
          nuevaDisponible = 0;
        }

        await CupoActual.update(
          {
            cantidad_asignada: nuevaCantidadAsignada,
            cantidad_disponible: nuevaDisponible,
            estado: nuevaDisponible <= 0 ? "AGOTADO" : "ACTIVO",
          },
          { where: { id_cupo_base: id }, transaction: t },
        );
      }
    }

    return cupo;
  });
};

/**
 * Reiniciar Cupos Mensuales (Proceso Batch)
 */
exports.reiniciarCuposMensuales = async (clientIp = "SYSTEM") => {
  console.log("=== INICIANDO REINICIO MENSUAL DE CUPOS ===");

  return await executeTransaction(clientIp, async (t) => {
    const mesAnterior = moment().subtract(1, "month").format("YYYY-MM");
    const mesNuevo = moment().format("YYYY-MM");
    const fechaInicio = moment().startOf("month").toDate();
    const fechaFin = moment().endOf("month").toDate();

    // 1. Cerrar cupos del mes anterior
    // Usamos LOCK UPDATE para asegurar que solo un proceso los toque
    const cuposAnteriores = await CupoActual.findAll({
      where: { periodo: mesAnterior, estado: { [Op.ne]: "CERRADO" } },
      transaction: t,
      lock: true,
      skipLocked: true, // Si otro proceso ya los bloqueó, saltamos (idempotencia)
    });

    for (const cupo of cuposAnteriores) {
      await HistorialCupoMensual.create(
        {
          id_cupo_base: cupo.id_cupo_base,
          periodo: cupo.periodo,
          cantidad_asignada: cupo.cantidad_asignada,
          cantidad_consumida: cupo.cantidad_consumida,
          cantidad_recargada: cupo.cantidad_recargada,
          cantidad_no_utilizada: cupo.cantidad_disponible,
          fecha_cierre: new Date(),
        },
        { transaction: t },
      );

      await cupo.update({ estado: "CERRADO" }, { transaction: t });
    }

    // 2. Crear nuevos cupos para el mes actual
    const cuposBaseActivos = await CupoBase.findAll({
      where: { activo: true },
      transaction: t,
    });

    for (const base of cuposBaseActivos) {
      // findOrCreate maneja la concurrencia mejor que findOne + create
      await CupoActual.findOrCreate({
        where: { id_cupo_base: base.id_cupo_base, periodo: mesNuevo },
        defaults: {
          id_cupo_base: base.id_cupo_base,
          periodo: mesNuevo,
          cantidad_asignada: base.cantidad_mensual,
          cantidad_disponible: base.cantidad_mensual,
          cantidad_consumida: 0,
          cantidad_recargada: 0,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: "ACTIVO",
        },
        transaction: t,
      });
    }

    return { success: true, msg: "Reinicio mensual completado" };
  });
};

/**
 * Obtener Cupo Específico (Lazy Init)
 */
exports.obtenerCupoEspecifico = async (query) => {
  const { id_subdependencia, id_tipo_combustible } = query;
  const periodoActual = moment().format("YYYY-MM");

  if (!id_subdependencia || !id_tipo_combustible) {
    throw new Error(
      "Faltan parámetros: id_subdependencia e id_tipo_combustible son obligatorios.",
    );
  }

  let cupo = await CupoActual.findOne({
    where: { periodo: periodoActual },
    include: [
      {
        model: CupoBase,
        as: "CupoBase",
        where: {
          id_subdependencia: id_subdependencia || null,
          id_tipo_combustible: id_tipo_combustible || null,
        },
      },
    ],
  });

  if (!cupo) {
    // Lazy Initialization
    const countMes = await CupoActual.count({
      where: { periodo: periodoActual },
    });
    if (countMes === 0) {
      console.log(
        `[LazyInit] No hay cupos para ${periodoActual}. Inicializando...`,
      );
      await exports.reiniciarCuposMensuales();

      cupo = await CupoActual.findOne({
        where: { periodo: periodoActual },
        include: [
          {
            model: CupoBase,
            as: "CupoBase",
            where: {
              id_subdependencia: id_subdependencia || null,
              id_tipo_combustible: id_tipo_combustible || null,
            },
          },
        ],
      });
    }
  }

  if (!cupo) {
    throw new Error("No se encontró cupo para los criterios especificados.");
  }

  return cupo;
};

/**
 * Obtener Cupos Actuales (Lazy Init)
 */
exports.obtenerCuposActuales = async (query) => {
  const periodoActual = moment().format("YYYY-MM");

  const searchableFields = [
    "$CupoBase.Categoria.nombre$",
    "$CupoBase.Dependencia.nombre_dependencia$",
    "$CupoBase.Subdependencia.nombre$",
  ];
  const include = [
    {
      model: CupoBase,
      as: "CupoBase",
      include: [
        { model: Categoria, as: "Categoria", attributes: ["nombre"] },
        {
          model: Dependencia,
          as: "Dependencia",
          attributes: ["nombre_dependencia"],
        },
        {
          model: Subdependencia,
          as: "Subdependencia",
          attributes: ["nombre"],
        },
        {
          model: TipoCombustible,
          as: "TipoCombustible",
          attributes: ["nombre"],
        },
      ],
    },
  ];
  const where = { periodo: periodoActual };

  let paginatedResults = await paginate(CupoActual, query, {
    searchableFields,
    include,
    where,
  });

  if (paginatedResults.data.length === 0 && !query.search) {
    const countTotal = await CupoActual.count({
      where: { periodo: periodoActual },
    });
    if (countTotal === 0) {
      console.log(
        `[LazyInit] Lista vacía para ${periodoActual}. Inicializando mes...`,
      );
      await exports.reiniciarCuposMensuales();

      paginatedResults = await paginate(CupoActual, query, {
        searchableFields,
        include,
        where,
      });
    }
  }

  return paginatedResults;
};

/**
 * Consumir Cupo
 */
exports.consumirCupo = async (data, clientIp) => {
  const { id_cupo_base, cantidad, descripcion } = data;
  const periodoActual = moment().format("YYYY-MM");

  return await executeTransaction(clientIp, async (t) => {
    const cupoActual = await CupoActual.findOne({
      where: {
        id_cupo_base,
        periodo: periodoActual,
      },
      transaction: t,
      lock: true,
    });

    if (!cupoActual) {
      throw new Error("No existe un cupo activo para este periodo");
    }

    if (cupoActual.estado !== "ACTIVO") {
      throw new Error(`El cupo está ${cupoActual.estado}`);
    }

    if (parseFloat(cupoActual.cantidad_disponible) < parseFloat(cantidad)) {
      throw new Error(
        `Saldo insuficiente. Disponible: ${cupoActual.cantidad_disponible}`,
      );
    }

    await ConsumoCupo.create(
      {
        id_cupo_actual: cupoActual.id_cupo_actual,
        cantidad,
        descripcion,
        fecha_consumo: new Date(),
      },
      { transaction: t },
    );

    const nuevaDisponibilidad =
      parseFloat(cupoActual.cantidad_disponible) - parseFloat(cantidad);
    const nuevoConsumo =
      parseFloat(cupoActual.cantidad_consumida) + parseFloat(cantidad);

    let nuevoEstado = "ACTIVO";
    if (nuevaDisponibilidad <= 0) {
      nuevoEstado = "AGOTADO";
    }

    await cupoActual.update(
      {
        cantidad_disponible: nuevaDisponibilidad,
        cantidad_consumida: nuevoConsumo,
        estado: nuevoEstado,
      },
      { transaction: t },
    );

    return {
      exito: true,
      msg: "Consumo registrado correctamente",
      saldo_anterior:
        parseFloat(cupoActual.cantidad_disponible) + parseFloat(cantidad),
      saldo_actual: nuevaDisponibilidad,
      estado: nuevoEstado,
      id_cupo_actual: cupoActual.id_cupo_actual,
    };
  });
};

/**
 * Recargar Cupo
 */
exports.recargarCupo = async (data, userId, clientIp) => {
  const { id_cupo_base, cantidad, motivo } = data;
  const periodoActual = moment().format("YYYY-MM");

  return await executeTransaction(clientIp, async (t) => {
    const cupoActual = await CupoActual.findOne({
      where: { id_cupo_base, periodo: periodoActual },
      transaction: t,
      lock: true,
    });

    if (!cupoActual) {
      throw new Error("No se encontró cupo activo para recargar");
    }

    const nuevaDisponibilidadEstimada =
      parseFloat(cupoActual.cantidad_disponible) + parseFloat(cantidad);
    if (
      nuevaDisponibilidadEstimada > parseFloat(cupoActual.cantidad_asignada)
    ) {
      const maxRecarga =
        parseFloat(cupoActual.cantidad_asignada) -
        parseFloat(cupoActual.cantidad_disponible);
      throw new Error(
        `La recarga excede el cupo mensual asignado. Máximo a recargar: ${maxRecarga}`,
      );
    }

    await RecargaCupo.create(
      {
        id_cupo_actual: cupoActual.id_cupo_actual,
        cantidad_recargada: cantidad,
        motivo,
        autorizado_por: userId,
        fecha_recarga: new Date(),
      },
      { transaction: t },
    );

    const nuevaDisponibilidad =
      parseFloat(cupoActual.cantidad_disponible) + parseFloat(cantidad);
    const nuevoTotalRecargado =
      parseFloat(cupoActual.cantidad_recargada) + parseFloat(cantidad);

    let nuevoEstado = cupoActual.estado;
    if (cupoActual.estado === "AGOTADO" && nuevaDisponibilidad > 0) {
      nuevoEstado = "ACTIVO";
    }

    await cupoActual.update(
      {
        cantidad_disponible: nuevaDisponibilidad,
        cantidad_recargada: nuevoTotalRecargado,
        estado: nuevoEstado,
      },
      { transaction: t },
    );

    return {
      exito: true,
      msg: "Recarga exitosa",
      saldo_anterior: parseFloat(cupoActual.cantidad_disponible),
      saldo_nuevo: nuevaDisponibilidad,
      id_cupo_actual: cupoActual.id_cupo_actual,
    };
  });
};
