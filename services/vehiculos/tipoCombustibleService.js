const TipoCombustible = require("../../models/TipoCombustible");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Tipo de Combustible
 */
exports.crearTipoCombustible = async (data, clientIp) => {
  const { nombre, descripcion, activo } = data;

  return await executeTransaction(clientIp, async (t) => {
    // Verificar si ya existe con el mismo nombre
    const existe = await TipoCombustible.findOne({
      where: { nombre },
      transaction: t,
    });
    if (existe) {
      throw new Error("El tipo de combustible ya existe");
    }

    const tipo = await TipoCombustible.create(
      {
        nombre,
        descripcion,
        activo: activo !== undefined ? activo : true,
      },
      { transaction: t },
    );

    return tipo;
  });
};

/**
 * Obtener Tipos de Combustible (Paginado)
 */
exports.obtenerTiposCombustible = async (query, user) => {
  const searchableFields = ["nombre", "descripcion"];
  const where = {};

  // Solo ADMIN puede ver desactivados
  if (!user || user.tipo_usuario !== "ADMIN") {
    where.activo = true;
  }

  return await paginate(TipoCombustible, query, {
    searchableFields,
    where,
  });
};

/**
 * Listar Todos (Selector)
 */
exports.listarTodos = async () => {
  return await TipoCombustible.findAll({
    where: { activo: true },
    attributes: ["id_tipo_combustible", "nombre"],
    order: [["nombre", "ASC"]],
  });
};

/**
 * Actualizar Tipo de Combustible
 */
exports.actualizarTipoCombustible = async (id, data, clientIp) => {
  const { nombre, descripcion, activo } = data;

  return await executeTransaction(clientIp, async (t) => {
    const tipo = await TipoCombustible.findByPk(id, { transaction: t });
    if (!tipo) {
      throw new Error("Tipo de combustible no encontrado");
    }

    if (nombre && nombre !== tipo.nombre) {
      const existe = await TipoCombustible.findOne({
        where: { nombre, id_tipo_combustible: { [Op.ne]: id } },
        transaction: t,
      });
      if (existe) {
        throw new Error("Ya existe otro tipo de combustible con ese nombre");
      }
      tipo.nombre = nombre;
    }

    if (descripcion !== undefined) tipo.descripcion = descripcion;
    if (activo !== undefined) tipo.activo = activo;

    await tipo.save({ transaction: t });

    return tipo;
  });
};

/**
 * Eliminar (Desactivar) Tipo de Combustible
 */
exports.eliminarTipoCombustible = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const tipo = await TipoCombustible.findByPk(id, { transaction: t });
    if (!tipo) {
      throw new Error("Tipo de combustible no encontrado");
    }

    await tipo.update({ activo: false }, { transaction: t });

    return tipo;
  });
};
