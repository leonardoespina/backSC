const { MedicionTanque, MovimientoInventario, Tanque, Usuario, Llenadero } = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Medición Física
 *
 * tipo_medicion:
 *   INICIAL   → solo fotografía, NO modifica nivel_actual del tanque
 *   CIERRE    → recalibra nivel_actual + crea MovimientoInventario AJUSTE_MEDICION
 *   ORDINARIA → comportamiento clásico (recalibra + movimiento)
 */
exports.crearMedicion = async (data, user, clientIp) => {
  const { id_usuario } = user;
  const {
    id_tanque,
    fecha_medicion,
    hora_medicion,
    medida_vara,
    volumen_real,
    merma_evaporacion,
    observaciones,
    tipo_medicion = "ORDINARIA",
    id_cierre_turno = null,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Buscar y Bloquear Tanque
    const tanque = await Tanque.findByPk(id_tanque, {
      transaction: t,
      lock: true,
    });

    if (!tanque) {
      throw new Error("Tanque no encontrado.");
    }

    const volumen_teorico = parseFloat(tanque.nivel_actual);
    const v_real = parseFloat(volumen_real);
    const v_merma = parseFloat(merma_evaporacion || 0);
    const diferencia = parseFloat((volumen_teorico - v_real).toFixed(2));

    // 2. Crear Registro de Medición
    const nuevaMedicion = await MedicionTanque.create(
      {
        id_tanque,
        id_usuario,
        fecha_medicion,
        hora_medicion,
        medida_vara,
        volumen_real: v_real,
        volumen_teorico,
        diferencia,
        merma_evaporacion: v_merma,
        observaciones,
        tipo_medicion,
        id_cierre_turno,
        estado: "PROCESADO",
      },
      { transaction: t }
    );

    // 3. Solo recalibrar nivel_actual si NO es una medición INICIAL
    //    INICIAL = solo fotografía de referencia, no modifica el inventario
    if (tipo_medicion !== "INICIAL") {
      await tanque.update({ nivel_actual: v_real }, { transaction: t });

      // 4. Registrar en MovimientoInventario
      await MovimientoInventario.create(
        {
          id_tanque,
          id_cierre_turno,
          tipo_movimiento: "AJUSTE_MEDICION",
          id_referencia: nuevaMedicion.id_medicion,
          tabla_referencia: "mediciones_tanque",
          volumen_antes: volumen_teorico,
          volumen_despues: v_real,
          variacion: parseFloat((v_real - volumen_teorico).toFixed(2)),
          fecha_movimiento: new Date(),
          id_usuario,
          observaciones: `Medición física ${tipo_medicion}`,
        },
        { transaction: t }
      );
    }

    return {
      nuevaMedicion,
      v_real,
      id_tanque,
      recalibrado: tipo_medicion !== "INICIAL",
      resumen: { teorico: volumen_teorico, real: v_real, diferencia },
    };
  });
};


/**
 * Listar Mediciones
 */
exports.listarMediciones = async (query) => {
  const { id_tanque, fecha_inicio, fecha_fin } = query;
  const where = {};

  if (id_tanque) where.id_tanque = id_tanque;

  if (fecha_inicio && fecha_fin) {
    where.fecha_medicion = { [Op.between]: [fecha_inicio, fecha_fin] };
  }

  const searchableFields = ["observaciones"];

  return await paginate(MedicionTanque, query, {
    where,
    searchableFields,
    include: [
      {
        model: Tanque,
        as: "Tanque",
        attributes: ["codigo", "nombre"],
        include: [
          {
            model: Llenadero,
            as: "Llenadero",
            attributes: ["nombre_llenadero"],
          },
        ],
      },
      { model: Usuario, as: "Usuario", attributes: ["nombre", "apellido"] },
    ],
    order: [
      ["fecha_medicion", "DESC"],
      ["hora_medicion", "DESC"],
    ],
  });
};

/**
 * Anular Medición
 */
exports.anularMedicion = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const medicion = await MedicionTanque.findByPk(id, { transaction: t });
    if (!medicion) throw new Error("Medición no encontrada.");

    if (medicion.estado === "ANULADO") {
      throw new Error("La medición ya se encuentra anulada.");
    }

    await medicion.update({ estado: "ANULADO" }, { transaction: t });

    return medicion;
  });
};

/**
 * Actualizar Medición
 */
exports.actualizarMedicion = async (id, data, clientIp) => {
  const {
    fecha_medicion,
    hora_medicion,
    medida_vara,
    volumen_real,
    merma_evaporacion,
    observaciones,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const medicion = await MedicionTanque.findByPk(id, { transaction: t });
    if (!medicion) throw new Error("Medición no encontrada.");

    if (medicion.estado === "ANULADO") {
      throw new Error("No se puede modificar una medición anulada.");
    }

    const v_real = parseFloat(volumen_real);
    const v_teorico = parseFloat(medicion.volumen_teorico);
    const diferencia = parseFloat((v_teorico - v_real).toFixed(2));

    await medicion.update(
      {
        fecha_medicion,
        hora_medicion,
        medida_vara,
        volumen_real: v_real,
        diferencia,
        merma_evaporacion,
        observaciones,
      },
      { transaction: t },
    );

    // Ajustar nivel del tanque
    const tanque = await Tanque.findByPk(medicion.id_tanque, {
      transaction: t,
      lock: true,
    });
    if (tanque) {
      await tanque.update({ nivel_actual: v_real }, { transaction: t });
    }

    return { medicion, v_real, id_tanque: medicion.id_tanque };
  });
};
