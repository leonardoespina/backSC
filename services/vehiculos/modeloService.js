const Modelo = require("../../models/Modelo");
const Marca = require("../../models/Marca");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Modelo
 */
exports.crearModelo = async (data, clientIp) => {
  const { nombre, id_marca } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Validar que la Marca exista
    const marcaExiste = await Marca.findByPk(id_marca, { transaction: t });
    if (!marcaExiste) {
      const error = new Error("La marca seleccionada no existe.");
      error.status = 404;
      throw error;
    }

    // 2. Validar duplicado (Mismo nombre en la misma marca)
    const modeloExiste = await Modelo.findOne({
      where: { nombre, id_marca },
      transaction: t,
    });
    if (modeloExiste) {
      const error = new Error(`El modelo '${nombre}' ya existe en esta marca.`);
      error.status = 400;
      throw error;
    }

    // 3. Crear
    const nuevoModelo = await Modelo.create(
      {
        nombre,
        id_marca,
        estado: "ACTIVO",
      },
      { transaction: t },
    );

    return nuevoModelo;
  });
};

/**
 * Obtener Modelos (Paginado)
 */
exports.obtenerModelos = async (query, user) => {
  const searchableFields = ["nombre"];
  const where = {};

  // Si no es admin, filtramos por activos
  if (user && user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  return await paginate(Modelo, query, {
    where,
    searchableFields,
    include: [
      {
        model: Marca,
        attributes: ["nombre"],
      },
    ],
  });
};

/**
 * Actualizar Modelo
 */
exports.actualizarModelo = async (id, data, clientIp) => {
  const { nombre, id_marca, estado } = data;

  return await executeTransaction(clientIp, async (t) => {
    const modelo = await Modelo.findByPk(id, { transaction: t });
    if (!modelo) {
      const error = new Error("Modelo no encontrado");
      error.status = 404;
      throw error;
    }

    // Validar si cambia la marca
    if (id_marca && id_marca !== modelo.id_marca) {
      const marcaExiste = await Marca.findByPk(id_marca, { transaction: t });
      if (!marcaExiste) {
        const error = new Error("La nueva marca no existe");
        error.status = 404;
        throw error;
      }
      modelo.id_marca = id_marca;
    }

    // Validar duplicado si cambia nombre o marca
    if (nombre || id_marca) {
      const checkNombre = nombre || modelo.nombre;
      const checkMarca = id_marca || modelo.id_marca;

      const existe = await Modelo.findOne({
        where: {
          nombre: checkNombre,
          id_marca: checkMarca,
          id_modelo: { [Op.ne]: id },
        },
        transaction: t,
      });

      if (existe) {
        const error = new Error(
          "Ya existe un modelo con ese nombre en esa marca",
        );
        error.status = 400;
        throw error;
      }
    }

    if (nombre) modelo.nombre = nombre;
    if (estado) modelo.estado = estado;

    modelo.fecha_modificacion = new Date();
    await modelo.save({ transaction: t });

    return modelo;
  });
};

/**
 * Desactivar Modelo
 */
exports.desactivarModelo = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const modelo = await Modelo.findByPk(id, { transaction: t });
    if (!modelo) {
      const error = new Error("Modelo no encontrado");
      error.status = 404;
      throw error;
    }

    await modelo.update(
      {
        estado: "INACTIVO",
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return { id_modelo: id, estado: "INACTIVO" };
  });
};
