const { Moneda, PrecioCombustible, TipoCombustible } = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * === GESTIÓN DE MONEDAS ===
 */

/**
 * Obtener Monedas (Paginado)
 */
exports.obtenerMonedas = async (query) => {
  const searchableFields = ["nombre", "simbolo"];
  const where = { activo: true };

  return await paginate(Moneda, query, {
    where,
    searchableFields,
  });
};

/**
 * Crear Moneda
 */
exports.crearMoneda = async (data, clientIp) => {
  const { nombre, simbolo } = data;

  return await executeTransaction(clientIp, async (t) => {
    // Verificar si ya existe
    const existe = await Moneda.findOne({ where: { nombre }, transaction: t });
    if (existe) {
      throw new Error("La moneda ya existe con ese nombre");
    }

    const nuevaMoneda = await Moneda.create(
      { nombre, simbolo, activo: true },
      { transaction: t },
    );

    return nuevaMoneda;
  });
};

/**
 * Actualizar Moneda
 */
exports.actualizarMoneda = async (id, data, clientIp) => {
  const { nombre, simbolo } = data;

  return await executeTransaction(clientIp, async (t) => {
    let moneda = await Moneda.findByPk(id, { transaction: t });
    if (!moneda) {
      throw new Error("Moneda no encontrada");
    }

    if (nombre && nombre !== moneda.nombre) {
      const existe = await Moneda.findOne({
        where: { nombre, id_moneda: { [Op.ne]: id } },
        transaction: t,
      });
      if (existe) {
        throw new Error("Ya existe una moneda con ese nombre");
      }
      moneda.nombre = nombre;
    }

    if (simbolo) moneda.simbolo = simbolo;

    await moneda.save({ transaction: t });

    return moneda;
  });
};

/**
 * Desactivar Moneda
 */
exports.desactivarMoneda = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const moneda = await Moneda.findByPk(id, { transaction: t });
    if (!moneda) {
      throw new Error("Moneda no encontrada");
    }

    // Verificar si hay precios activos con esta moneda
    const preciosActivos = await PrecioCombustible.count({
      where: { id_moneda: id, activo: true },
      transaction: t,
    });

    if (preciosActivos > 0) {
      throw new Error(
        "No se puede desactivar la moneda porque tiene precios activos asociados",
      );
    }

    await moneda.update({ activo: false }, { transaction: t });

    return moneda;
  });
};

/**
 * === GESTIÓN DE PRECIOS ===
 */

/**
 * Obtener Precios Actuales (Formateado para UI)
 */
exports.obtenerPreciosActuales = async () => {
  const tipos = await TipoCombustible.findAll({
    include: [
      {
        model: PrecioCombustible,
        as: "Precios",
        where: { activo: true },
        required: false,
        include: [{ model: Moneda, as: "Moneda", where: { activo: true } }],
      },
    ],
  });

  return tipos.map((t) => {
    const fila = {
      id_tipo_combustible: t.id_tipo_combustible,
      nombre: t.nombre,
      precios: {},
    };

    t.Precios.forEach((p) => {
      fila.precios[p.Moneda.simbolo] = parseFloat(p.precio);
    });

    return fila;
  });
};

/**
 * Obtener precios por combustible
 */
exports.obtenerPreciosPorCombustible = async (id_tipo_combustible) => {
  return await PrecioCombustible.findAll({
    where: { id_tipo_combustible, activo: true },
    include: [{ model: Moneda, as: "Moneda", where: { activo: true } }],
  });
};

/**
 * Actualizar Precios masivamente para un combustible
 */
exports.actualizarPrecios = async (data, clientIp) => {
  const { id_tipo_combustible, precios } = data;

  return await executeTransaction(clientIp, async (t) => {
    const combustible = await TipoCombustible.findByPk(id_tipo_combustible, {
      transaction: t,
    });
    if (!combustible) {
      throw new Error("Tipo de combustible no encontrado");
    }

    const monedas = await Moneda.findAll({
      where: { activo: true },
      transaction: t,
    });

    for (const moneda of monedas) {
      const nuevoValor = precios[moneda.simbolo];

      if (nuevoValor !== undefined && nuevoValor !== null) {
        await PrecioCombustible.update(
          { activo: false },
          {
            where: {
              id_tipo_combustible,
              id_moneda: moneda.id_moneda,
              activo: true,
            },
            transaction: t,
          },
        );

        await PrecioCombustible.create(
          {
            id_tipo_combustible,
            id_moneda: moneda.id_moneda,
            precio: nuevoValor,
            activo: true,
            fecha_vigencia: new Date(),
          },
          { transaction: t },
        );
      }
    }

    return { id_tipo_combustible };
  });
};
