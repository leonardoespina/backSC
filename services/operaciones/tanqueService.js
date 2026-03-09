const { Tanque, Llenadero, TipoCombustible } = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Validar límites de capacidad y niveles de alarma de un tanque
 */
const MARGEN_TOLERANCIA = 0.001; // 1% de tolerancia para errores de medición (vara)

const validarLimitesTanque = (data, tanqueExistente = null) => {
  const capMax = parseFloat(data.capacidad_maxima !== undefined ? data.capacidad_maxima : (tanqueExistente?.capacidad_maxima || 0));
  const nivAct = parseFloat(data.nivel_actual !== undefined ? data.nivel_actual : (tanqueExistente?.nivel_actual || 0));
  const nivAlarmaAlto = parseFloat(data.nivel_alarma_alto !== undefined ? data.nivel_alarma_alto : (tanqueExistente?.nivel_alarma_alto || 0));
  const nivAlarmaBajo = parseFloat(data.nivel_alarma_bajo !== undefined ? data.nivel_alarma_bajo : (tanqueExistente?.nivel_alarma_bajo || 0));

  if (capMax <= 0) {
    throw Object.assign(new Error("La capacidad máxima debe ser mayor a 0"), { status: 400 });
  }

  // Aplicar margen de tolerancia sobre la capacidad física
  const limiteConMargen = capMax * (1 + MARGEN_TOLERANCIA);

  if (nivAct > limiteConMargen) {
    throw Object.assign(new Error(`El nivel actual (${nivAct}L) supera el límite físico permitido con margen de error (${limiteConMargen.toFixed(2)}L)`), { status: 400 });
  }

  if (nivAlarmaAlto > limiteConMargen) {
    throw Object.assign(new Error(`El nivel de alarma alto (${nivAlarmaAlto}L) no puede superar el límite físico permitido con margen de error (${limiteConMargen.toFixed(2)}L)`), { status: 400 });
  }

  if (nivAlarmaAlto > 0 && nivAlarmaBajo >= nivAlarmaAlto) {
    throw Object.assign(new Error(`El nivel de alarma bajo (${nivAlarmaBajo}L) debe ser menor al nivel de alarma alto (${nivAlarmaAlto}L)`), { status: 400 });
  }

  if (nivAct < 0) {
    throw Object.assign(new Error("El nivel actual no puede ser negativo"), { status: 400 });
  }
};

/**
 * Crear Tanque
 */
exports.crearTanque = async (data, clientIp) => {
  const {
    id_llenadero,
    codigo,
    nombre,
    id_tipo_combustible,
    tipo_tanque,
    capacidad_maxima,
    nivel_alarma_bajo,
    nivel_alarma_alto,
    unidad_medida,
    alto,
    radio,
    largo,
    ancho,
    con_aforo,
    aforo,
    activo_para_despacho,
    nivel_actual,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Validaciones de Integridad
    const [llenadero, combustible] = await Promise.all([
      Llenadero.findByPk(id_llenadero, { transaction: t }),
      TipoCombustible.findByPk(id_tipo_combustible, { transaction: t }),
    ]);

    if (!llenadero) {
      const error = new Error("El llenadero especificado no existe");
      error.status = 404;
      throw error;
    }
    if (!combustible) {
      const error = new Error("El tipo de combustible no es válido");
      error.status = 404;
      throw error;
    }

    // 2. Validar duplicado de código
    const tanqueExistente = await Tanque.findOne({
      where: { codigo },
      transaction: t,
    });
    if (tanqueExistente) {
      const error = new Error(`El código ${codigo} ya está registrado.`);
      error.status = 400;
      throw error;
    }

    // 3. Validar Límites y Capacidad
    validarLimitesTanque(data);

    // 4. Regla de Negocio: Solo un tanque activo para despacho por tipo de combustible en el Llenadero
    if (activo_para_despacho) {
      // Buscar si ya existe otro tanque activo para este combustible en este llenadero
      const tanqueActivoPrevio = await Tanque.findOne({
        where: {
          id_llenadero,
          id_tipo_combustible,
          activo_para_despacho: true
        },
        transaction: t
      });

      if (tanqueActivoPrevio) {
        // Desactivar el anterior
        await tanqueActivoPrevio.update({ activo_para_despacho: false }, { transaction: t });
      }
    }

    // 5. Crear registro
    const tanque = await Tanque.create(
      {
        id_llenadero,
        codigo,
        nombre,
        id_tipo_combustible,
        tipo_tanque,
        capacidad_maxima: capMax,
        nivel_actual: nivAct,
        nivel_alarma_bajo,
        nivel_alarma_alto,
        unidad_medida: unidad_medida || "CM",
        alto,
        radio,
        largo,
        ancho,
        estado: "ACTIVO",
        activo_para_despacho: !!activo_para_despacho,
        con_aforo: !!con_aforo,
        aforo: aforo || [],
      },
      { transaction: t },
    );

    return tanque;
  });
};

/**
 * Obtener Tanques (Paginado)
 */
exports.obtenerTanques = async (query) => {
  const { id_llenadero, id_tipo_combustible, estado, tipo_tanque, con_aforo } =
    query;

  const searchableFields = ["codigo", "nombre"];
  const where = {};

  if (id_llenadero) where.id_llenadero = id_llenadero;
  if (id_tipo_combustible) where.id_tipo_combustible = id_tipo_combustible;
  if (estado) where.estado = estado;
  if (tipo_tanque) where.tipo_tanque = tipo_tanque;
  if (con_aforo !== undefined) where.con_aforo = con_aforo === "true";

  return await paginate(Tanque, query, {
    where,
    searchableFields,
    include: [
      { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
    ],
    order: [["id_tanque", "DESC"]],
  });
};

/**
 * Actualizar Tanque
 */
exports.actualizarTanque = async (id, data, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const tanque = await Tanque.findByPk(id, { transaction: t });
    if (!tanque) {
      const error = new Error("Tanque no encontrado");
      error.status = 404;
      throw error;
    }

    // 1. Validar código duplicado
    if (data.codigo && data.codigo !== tanque.codigo) {
      const existe = await Tanque.findOne({
        where: { codigo: data.codigo, id_tanque: { [Op.ne]: id } },
        transaction: t,
      });
      if (existe) {
        const error = new Error("El nuevo código ya está en uso");
        error.status = 400;
        throw error;
      }
    }

    // 2. Validar Relaciones si cambian
    if (data.id_llenadero) {
      const existeLlenadero = await Llenadero.findByPk(data.id_llenadero, {
        transaction: t,
      });
      if (!existeLlenadero) {
        const error = new Error("Llenadero no válido");
        error.status = 404;
        throw error;
      }
    }
    if (data.id_tipo_combustible) {
      const existeCombustible = await TipoCombustible.findByPk(
        data.id_tipo_combustible,
        { transaction: t },
      );
      if (!existeCombustible) {
        const error = new Error("Tipo de combustible no válido");
        error.status = 404;
        throw error;
      }
    }

    // 3. Validar Límites y Capacidad
    validarLimitesTanque(data, tanque);

    // 4. Regla de Negocio: Solo un tanque activo para despacho
    // Si la actualización incluye activar este tanque para despacho
    if (data.activo_para_despacho === true) {
      const targetLlenadero = data.id_llenadero || tanque.id_llenadero;
      const targetCombustible = data.id_tipo_combustible || tanque.id_tipo_combustible;

      const tanqueActivoPrevio = await Tanque.findOne({
        where: {
          id_llenadero: targetLlenadero,
          id_tipo_combustible: targetCombustible,
          activo_para_despacho: true,
          id_tanque: { [Op.ne]: id } // Excluir el tanque actual
        },
        transaction: t
      });

      if (tanqueActivoPrevio) {
        await tanqueActivoPrevio.update({ activo_para_despacho: false }, { transaction: t });
      }
    }

    // 5. Actualizar registro
    await tanque.update(data, { transaction: t });

    return tanque;
  });
};

/**
 * Obtener Tanque por ID
 */
exports.obtenerTanquePorId = async (id) => {
  const tanque = await Tanque.findByPk(id, {
    include: [
      { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
    ],
  });

  if (!tanque) {
    const error = new Error("Tanque no encontrado");
    error.status = 404;
    throw error;
  }

  return tanque;
};

/**
 * Desactivar Tanque
 */
exports.eliminarTanque = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const tanque = await Tanque.findByPk(id, { transaction: t });
    if (!tanque) {
      const error = new Error("Tanque no encontrado");
      error.status = 404;
      throw error;
    }

    await tanque.update({ estado: "INACTIVO" }, { transaction: t });

    return { id_tanque: id, estado: "INACTIVO" };
  });
};

/**
 * Lista Simple (Para selectores)
 */
exports.obtenerListaTanques = async (query) => {
  const { id_llenadero, id_tipo_combustible } = query;
  const where = { estado: "ACTIVO" };

  if (id_llenadero) where.id_llenadero = id_llenadero;
  if (id_tipo_combustible) where.id_tipo_combustible = id_tipo_combustible;

  return await Tanque.findAll({
    where,
    attributes: [
      "id_tanque",
      "id_llenadero",
      "codigo",
      "nombre",
      "capacidad_maxima",
      "nivel_actual",
      "tipo_tanque",
      "con_aforo",
      "id_tipo_combustible",
    ],
    include: [
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
      { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
    ],
    order: [["nombre", "ASC"]],
  });
};
