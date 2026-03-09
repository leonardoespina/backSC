const Categoria = require("../../models/Categoria");
const Dependencia = require("../../models/Dependencia");
const Subdependencia = require("../../models/Subdependencia");
const { paginate } = require("../../helpers/paginationHelper");
const { getHierarchy } = require("../../helpers/hierarchyHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Categoría
 */
exports.crearCategoria = async (data, userId, clientIp) => {
  const { nombre } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Verificar si ya existe
    const existe = await Categoria.findOne({
      where: { nombre },
      transaction: t,
    });
    if (existe) {
      throw new Error("La categoría ya existe con ese nombre");
    }

    // 2. Crear
    const categoria = await Categoria.create(
      {
        nombre,
        registrado_por: userId,
        fecha_registro: new Date(),
        estado: "ACTIVO",
      },
      { transaction: t },
    );

    return {
      msg: "Categoría creada exitosamente",
      categoria,
    };
  });
};

/**
 * Obtener Jerarquía
 */
exports.obtenerJerarquia = async (query) => {
  // Definición de la estructura jerárquica
  const levels = [
    {
      model: Categoria,
      type: "categoria",
      searchFields: ["nombre"],
      where: { estado: "ACTIVO" },
    },
    {
      model: Dependencia,
      alias: "Dependencias",
      foreignKey: "id_categoria",
      type: "dependencia",
      where: { estatus: "ACTIVO" },
    },
    {
      model: Subdependencia,
      alias: "Subdependencias",
      foreignKey: "id_dependencia",
      type: "subdependencia",
      where: { estatus: "ACTIVO" },
    },
  ];

  const rootWhere = { estado: "ACTIVO" };

  return await getHierarchy(levels, query, { rootWhere });
};

/**
 * Obtener Categorías Paginadas
 */
exports.obtenerCategorias = async (query, user) => {
  const searchableFields = ["nombre"];
  const where = {};

  // Si NO es admin, forzamos que solo vea los activos.
  if (!user || user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  return await paginate(Categoria, query, {
    where,
    searchableFields,
  });
};

/**
 * Actualizar Categoría
 */
exports.actualizarCategoria = async (id, data, clientIp) => {
  const { nombre, estado } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Verificar existencia
    let categoria = await Categoria.findByPk(id, { transaction: t });
    if (!categoria) {
      throw new Error("Categoría no encontrada");
    }

    // Validar que el nombre no se repita en otra categoría
    if (nombre && nombre !== categoria.nombre) {
      const existe = await Categoria.findOne({
        where: {
          nombre,
          id_categoria: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (existe) {
        throw new Error("La categoría ya existe con ese nombre");
      }
      categoria.nombre = nombre;
    }

    if (estado) categoria.estado = estado;

    categoria.fecha_modificacion = new Date();

    await categoria.save({ transaction: t });

    return {
      msg: "Categoría actualizada correctamente",
      categoria,
    };
  });
};

/**
 * Desactivar Categoría
 */
exports.desactivarCategoria = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const categoria = await Categoria.findByPk(id, { transaction: t });

    if (!categoria) {
      throw new Error("Categoría no encontrada");
    }

    // Verificar si hay dependencias activas asociadas
    const dependenciasActivas = await Dependencia.count({
      where: {
        id_categoria: id,
        estatus: "ACTIVO",
      },
      transaction: t,
    });

    if (dependenciasActivas > 0) {
      throw new Error(
        "No se puede desactivar la categoría porque tiene dependencias activas asociadas. Desactive las dependencias primero.",
      );
    }

    // Soft Delete
    await categoria.update(
      {
        estado: "INACTIVO",
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return {
      msg: "Categoría desactivada exitosamente",
      categoria,
    };
  });
};
