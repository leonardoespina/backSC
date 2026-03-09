const Dependencia = require("../../models/Dependencia");
const Categoria = require("../../models/Categoria");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Dependencia
 */
exports.crearDependencia = async (data, clientIp) => {
  const {
    id_categoria,
    nombre_dependencia,
    codigo,
    tipo_venta,
    estatus,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // Validar que exista la Categoría
    const categoria = await Categoria.findByPk(id_categoria, {
      transaction: t,
    });
    if (!categoria) {
      throw new Error("Categoría no encontrada");
    }

    // Verificar si ya existe una dependencia con el mismo nombre
    const existe = await Dependencia.findOne({
      where: { nombre_dependencia },
      transaction: t,
    });
    if (existe) {
      throw new Error("La dependencia ya existe con ese nombre");
    }

    const dependencia = await Dependencia.create(
      {
        id_categoria,
        nombre_dependencia,
        codigo,
        tipo_venta: tipo_venta || "INSTITUCIONAL",
        estatus: estatus || "ACTIVO",
        fecha_registro: new Date(),
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return {
      msg: "Dependencia creada exitosamente",
      dependencia,
    };
  });
};

/**
 * Obtener Dependencias Paginadas
 */
exports.obtenerDependencias = async (query, user) => {
  const searchableFields = ["nombre_dependencia", "codigo"];

  // Incluir datos de la Categoría
  const include = [
    { model: Categoria, as: "Categoria", attributes: ["nombre"] },
  ];

  const where = {};
  // Si NO es admin, forzamos que solo vea los activos.
  if (!user || user.tipo_usuario !== "ADMIN") {
    where.estatus = "ACTIVO";
  }

  return await paginate(Dependencia, query, {
    searchableFields,
    include,
    where,
  });
};

/**
 * Actualizar Dependencia
 */
exports.actualizarDependencia = async (id, data, clientIp) => {
  const {
    id_categoria,
    nombre_dependencia,
    codigo,
    tipo_venta,
    estatus,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const dependencia = await Dependencia.findByPk(id, { transaction: t });
    if (!dependencia) {
      throw new Error("Dependencia no encontrada");
    }

    if (id_categoria) {
      const categoria = await Categoria.findByPk(id_categoria, {
        transaction: t,
      });
      if (!categoria) {
        throw new Error("Categoría no encontrada");
      }
      dependencia.id_categoria = id_categoria;
    }

    // Validar que el nombre no se repita
    if (
      nombre_dependencia &&
      nombre_dependencia !== dependencia.nombre_dependencia
    ) {
      const existe = await Dependencia.findOne({
        where: {
          nombre_dependencia,
          id_dependencia: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (existe) {
        throw new Error("La dependencia ya existe con ese nombre");
      }
      dependencia.nombre_dependencia = nombre_dependencia;
    }

    if (codigo) dependencia.codigo = codigo;
    if (tipo_venta) dependencia.tipo_venta = tipo_venta;
    if (estatus) dependencia.estatus = estatus;

    dependencia.fecha_modificacion = new Date();

    await dependencia.save({ transaction: t });

    return {
      msg: "Dependencia actualizada",
      dependencia,
    };
  });
};

/**
 * Desactivar Dependencia
 */
exports.desactivarDependencia = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const dependencia = await Dependencia.findByPk(id, { transaction: t });
    if (!dependencia) {
      throw new Error("Dependencia no encontrada");
    }

    await dependencia.update(
      { estatus: "INACTIVO", fecha_modificacion: new Date() },
      { transaction: t },
    );

    return {
      msg: "Dependencia desactivada",
      dependencia,
    };
  });
};

/**
 * Listar Todas (Selector)
 */
exports.listarTodas = async () => {
  const dependencias = await Dependencia.findAll({
    where: { estatus: "ACTIVO" },
    attributes: ["id_dependencia", "nombre_dependencia", "id_categoria"],
    order: [["nombre_dependencia", "ASC"]],
  });
  return { data: dependencias };
};
