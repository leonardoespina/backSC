const Llenadero = require("../../models/Llenadero");
const TipoCombustible = require("../../models/TipoCombustible");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Llenadero
 */
exports.crearLlenadero = async (data, clientIp) => {
  const { nombre_llenadero } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Validar duplicados
    const existe = await Llenadero.findOne({
      where: { nombre_llenadero },
      transaction: t,
    });
    if (existe) {
      const error = new Error(`El llenadero '${nombre_llenadero}' ya existe.`);
      error.status = 400;
      throw error;
    }

    // 2. Crear registro
    const nuevoLlenadero = await Llenadero.create(
      {
        nombre_llenadero,
        estado: "ACTIVO",
      },
      { transaction: t },
    );

    return nuevoLlenadero;
  });
};

/**
 * Obtener Llenaderos (Paginado)
 */
exports.obtenerLlenaderos = async (query, user) => {
  const searchableFields = ["nombre_llenadero"];
  const where = {};

  // Si no es admin, filtramos por activos
  if (user && user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  const reqPath = require('path');
  const Tanque = require(reqPath.join(__dirname, '../../models/Tanque.js'));
  const TipoCombustible = require(reqPath.join(__dirname, '../../models/TipoCombustible.js'));

  const result = await paginate(Llenadero, query, {
    where,
    searchableFields,
    include: [
      {
        model: Tanque,
        as: "Tanques",
        attributes: ["id_tipo_combustible", "capacidad_maxima", "nivel_actual", "activo_para_despacho", "nombre"],
        include: [
          {
            model: TipoCombustible,
            as: "TipoCombustible",
            attributes: ["nombre"]
          }
        ]
      },
    ],
  });
  // Transform results to aggregate capabilities per fuel type
  if (result && result.data) {

    result.data = result.data.map(llenadero => {
      const jsonLlenadero = llenadero.toJSON();
      const totalesPorCombustible = {};

      if (jsonLlenadero.Tanques && jsonLlenadero.Tanques.length > 0) {
        jsonLlenadero.Tanques.forEach(tanque => {
          const tipoId = tanque.id_tipo_combustible;
          const tipoNombre = tanque.TipoCombustible ? tanque.TipoCombustible.nombre : 'Desconocido';

          if (!totalesPorCombustible[tipoId]) {
            totalesPorCombustible[tipoId] = {
              id_tipo_combustible: tipoId,
              nombre_combustible: tipoNombre,
              capacidad_total: 0,
              disponibilidad_total: 0,
              tanques_activos: []
            };
          }

          totalesPorCombustible[tipoId].capacidad_total += parseFloat(tanque.capacidad_maxima || 0);
          totalesPorCombustible[tipoId].disponibilidad_total += parseFloat(tanque.nivel_actual || 0);

          if (tanque.activo_para_despacho) {
            totalesPorCombustible[tipoId].tanques_activos.push(tanque.nombre);
          }
        });
      }

      jsonLlenadero.estadisticas = Object.values(totalesPorCombustible);
      return jsonLlenadero;
    });
  }

  return result;
};

/**
 * Actualizar Llenadero
 */
exports.actualizarLlenadero = async (id, data, clientIp) => {
  const {
    nombre_llenadero,
    estado,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const llenadero = await Llenadero.findByPk(id, { transaction: t });

    if (!llenadero) {
      const error = new Error("Llenadero no encontrado");
      error.status = 404;
      throw error;
    }

    // 1. Validar nombre duplicado
    if (nombre_llenadero && nombre_llenadero !== llenadero.nombre_llenadero) {
      const existe = await Llenadero.findOne({
        where: {
          nombre_llenadero,
          id_llenadero: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (existe) {
        const error = new Error(
          `El llenadero '${nombre_llenadero}' ya existe.`,
        );
        error.status = 400;
        throw error;
      }
      llenadero.nombre_llenadero = nombre_llenadero;
    }

    if (estado) llenadero.estado = estado;

    llenadero.fecha_modificacion = new Date();
    await llenadero.save({ transaction: t });

    return llenadero;
  });
};

/**
 * Desactivar Llenadero
 */
exports.desactivarLlenadero = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const llenadero = await Llenadero.findByPk(id, { transaction: t });

    if (!llenadero) {
      const error = new Error("Llenadero no encontrado");
      error.status = 404;
      throw error;
    }

    await llenadero.update(
      {
        estado: "INACTIVO",
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return { id_llenadero: id, estado: "INACTIVO" };
  });
};

/**
 * Lista Simple (Para selectores)
 */
exports.obtenerListaLlenaderos = async () => {
  const reqPath = require('path');
  const Tanque = require(reqPath.join(__dirname, '../../models/Tanque.js'));

  return await Llenadero.findAll({
    where: { estado: "ACTIVO" },
    include: [
      {
        model: Tanque,
        as: "Tanques",
        attributes: ["id_tipo_combustible", "nombre", "activo_para_despacho"],
        where: { estado: 'ACTIVO' },
        required: false
      },
    ],
    order: [["nombre_llenadero", "ASC"]],
  });
};
