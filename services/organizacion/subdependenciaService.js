const Subdependencia = require("../../models/Subdependencia");
const Dependencia = require("../../models/Dependencia");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Validar campos según tipo de venta
 * @param {Object} dependencia - Objeto dependencia
 * @param {Object} campos - Campos a validar
 */
const validarCamposSegunTipoVenta = (dependencia, campos) => {
  const { ubicacion, responsable, cedula_rif } = campos;

  const mensajesError = {
    ubicacion: "La ubicación",
    responsable: "El responsable",
    cedula_rif: "La cédula/RIF",
  };

  const reglasValidacion = {
    VENTA: { obligatorios: true, opcionales: false },
    AMBOS: { obligatorios: false, opcionales: true },
    INSTITUCIONAL: { obligatorios: false, opcionales: false },
  };

  const regla =
    reglasValidacion[dependencia.tipo_venta] || reglasValidacion.INSTITUCIONAL;

  const errores = [];

  for (const [campo, valor] of Object.entries({
    ubicacion,
    responsable,
    cedula_rif,
  })) {
    const esCampoVacio = !valor || valor.trim() === "";

    if (regla.obligatorios && esCampoVacio) {
      errores.push(
        `${mensajesError[campo]} es obligatorio para tipo de venta ${dependencia.tipo_venta}`,
      );
    }

    if (regla.opcionales && valor && esCampoVacio) {
      errores.push(`${mensajesError[campo]} no puede estar vacío`);
    }
  }

  if (errores.length > 0) {
    throw new Error(errores[0]); // Retornamos el primer error encontrado
  }
};

/**
 * Crear Subdependencia
 */
exports.crearSubdependencia = async (data, clientIp) => {
  const {
    nombre,
    estatus,
    id_dependencia,
    ubicacion,
    responsable,
    cedula_rif,
    cobra_venta,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const dependencia = await Dependencia.findByPk(id_dependencia, {
      transaction: t,
    });
    if (!dependencia) {
      throw new Error("Dependencia no encontrada");
    }

    // Validar campos adicionales
    validarCamposSegunTipoVenta(dependencia, {
      ubicacion,
      responsable,
      cedula_rif,
    });

    // Verificar nombre duplicado
    const existe = await Subdependencia.findOne({
      where: { nombre },
      transaction: t,
    });
    if (existe) {
      throw new Error("La subdependencia ya existe con ese nombre");
    }

    // Determinar si cobra venta
    let debeCobrar = false;
    if (dependencia.tipo_venta === "VENTA") {
      debeCobrar = true;
    } else if (dependencia.tipo_venta === "AMBOS") {
      debeCobrar = cobra_venta === true;
    }

    const subdependencia = await Subdependencia.create(
      {
        nombre,
        estatus: estatus || "ACTIVO",
        id_dependencia,
        ubicacion: ubicacion || null,
        responsable: responsable || null,
        cedula_rif: cedula_rif || null,
        cobra_venta: debeCobrar,
        fecha_registro: new Date(),
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return {
      msg: "Subdependencia creada exitosamente",
      subdependencia,
    };
  });
};

/**
 * Obtener Subdependencias
 */
exports.obtenerSubdependencias = async (query, user) => {
  const searchableFields = ["nombre"];
  const include = [
    {
      model: Dependencia,
      as: "Dependencia",
      attributes: ["nombre_dependencia"],
    },
  ];

  const where = {};
  console.log(`[DEBUG subdep] tipo_usuario="${user?.tipo_usuario}" → where:`, JSON.stringify(where));
  if (!user || user.tipo_usuario !== "ADMIN") {
    where.estatus = "ACTIVO";
  }

  // Si se pide una dependencia específica, filtrar por ella (vital para que cada usuario vea solo lo suyo)
  if (query.id_dependencia) {
    where.id_dependencia = query.id_dependencia;
  }

  console.log(`[DEBUG subdep] where final:`, JSON.stringify(where));

  return await paginate(Subdependencia, query, {
    searchableFields,
    include,
    where,
  });
};

/**
 * Actualizar Subdependencia
 */
exports.actualizarSubdependencia = async (id, data, clientIp) => {
  const {
    nombre,
    estatus,
    id_dependencia,
    ubicacion,
    responsable,
    cedula_rif,
    cobra_venta,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const subdependencia = await Subdependencia.findByPk(id, {
      transaction: t,
    });
    if (!subdependencia) {
      throw new Error("Subdependencia no encontrada");
    }

    // Si cambia de dependencia o campos relacionados, re-validar
    if (id_dependencia) {
      const dependencia = await Dependencia.findByPk(id_dependencia, {
        transaction: t,
      });
      if (!dependencia) {
        throw new Error("Dependencia no encontrada");
      }
      subdependencia.id_dependencia = id_dependencia;

      validarCamposSegunTipoVenta(dependencia, {
        ubicacion,
        responsable,
        cedula_rif,
      });

      if (dependencia.tipo_venta === "VENTA") {
        subdependencia.cobra_venta = true;
      } else if (dependencia.tipo_venta === "AMBOS") {
        subdependencia.cobra_venta = cobra_venta === true;
      } else {
        subdependencia.cobra_venta = false;
      }
    }

    // Validar nombre duplicado
    if (nombre && nombre !== subdependencia.nombre) {
      const existe = await Subdependencia.findOne({
        where: {
          nombre,
          id_subdependencia: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (existe) {
        throw new Error("La subdependencia ya existe con ese nombre");
      }
      subdependencia.nombre = nombre;
    }

    if (ubicacion !== undefined) subdependencia.ubicacion = ubicacion;
    if (responsable !== undefined) subdependencia.responsable = responsable;
    if (cedula_rif !== undefined) subdependencia.cedula_rif = cedula_rif;
    if (estatus) subdependencia.estatus = estatus;

    subdependencia.fecha_modificacion = new Date();

    await subdependencia.save({ transaction: t });

    return {
      msg: "Subdependencia actualizada",
      subdependencia,
    };
  });
};

/**
 * Desactivar Subdependencia
 */
exports.desactivarSubdependencia = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const subdependencia = await Subdependencia.findByPk(id, { transaction: t });
    if (!subdependencia) throw new Error("Subdependencia no encontrada");

    // Toggle: ACTIVO → INACTIVO / INACTIVO → ACTIVO
    const nuevoEstatus = subdependencia.estatus === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    await subdependencia.update(
      { estatus: nuevoEstatus, fecha_modificacion: new Date() },
      { transaction: t },
    );

    return {
      msg: nuevoEstatus === "INACTIVO" ? "Subdependencia desactivada" : "Subdependencia reactivada",
      subdependencia,
      estatus: nuevoEstatus,
    };
  });
};
