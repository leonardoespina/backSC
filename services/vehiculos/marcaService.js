const Marca = require("../../models/Marca");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Marca
 */
exports.crearMarca = async (data, user, clientIp) => {
  const { nombre } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Validar duplicados
    const existe = await Marca.findOne({
      where: { nombre },
      transaction: t,
    });
    if (existe) {
      const error = new Error(`La marca '${nombre}' ya existe.`);
      error.status = 400;
      throw error;
    }

    // 2. Crear registro
    const nuevaMarca = await Marca.create(
      {
        nombre,
        estado: "ACTIVO",
        registrado_por: user.id_usuario,
        fecha_registro: new Date(),
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return nuevaMarca;
  });
};

/**
 * Obtener Marcas (Paginado)
 */
exports.obtenerMarcas = async (query, user) => {
  const searchableFields = ["nombre"];
  const where = {};

  // Si no es admin, filtramos por activos
  if (user && user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  return await paginate(Marca, query, {
    where,
    searchableFields,
  });
};

/**
 * Actualizar Marca
 */
exports.actualizarMarca = async (id, data, clientIp) => {
  const { nombre, estado } = data;

  return await executeTransaction(clientIp, async (t) => {
    const marca = await Marca.findByPk(id, { transaction: t });

    if (!marca) {
      const error = new Error("Marca no encontrada");
      error.status = 404;
      throw error;
    }

    // 1. Validar nombre duplicado
    if (nombre && nombre !== marca.nombre) {
      const existe = await Marca.findOne({
        where: {
          nombre,
          id_marca: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (existe) {
        const error = new Error(`La marca '${nombre}' ya existe.`);
        error.status = 400;
        throw error;
      }
      marca.nombre = nombre;
    }

    if (estado) marca.estado = estado;

    marca.fecha_modificacion = new Date();
    await marca.save({ transaction: t });

    return marca;
  });
};

/**
 * Desactivar Marca
 */
exports.desactivarMarca = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const marca = await Marca.findByPk(id, { transaction: t });

    if (!marca) {
      const error = new Error("Marca no encontrada");
      error.status = 404;
      throw error;
    }

    await marca.update(
      {
        estado: "INACTIVO",
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return { id_marca: id, estado: "INACTIVO" };
  });
};

/**
 * Lista Simple para selectores
 */
exports.obtenerListaMarcas = async () => {
  return await Marca.findAll({
    where: { estado: "ACTIVO" },
    attributes: ["id_marca", "nombre"],
    order: [["nombre", "ASC"]],
  });
};
