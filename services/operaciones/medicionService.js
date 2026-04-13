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

  const pagedResult = await paginate(MedicionTanque, query, {
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

  // Injectar can_revert
  if (pagedResult && pagedResult.data && pagedResult.data.length > 0) {
    const idsTanques = [...new Set(pagedResult.data.map(m => m.id_tanque))];
    const tanksLastMovement = {};
    
    // Obtener el último movimiento para cada tanque involucrado en la página
    for (const id_tanque of idsTanques) {
      const lastMov = await MovimientoInventario.findOne({
        where: { id_tanque },
        order: [["id_movimiento", "DESC"]],
        attributes: ["id_referencia", "tabla_referencia"]
      });
      tanksLastMovement[id_tanque] = lastMov;
    }

    // Inyectar bandera
    pagedResult.data = pagedResult.data.map(medicion => {
      const item = medicion.toJSON ? medicion.toJSON() : medicion;
      // Una medición se puede revertir si este es el ÚLTIMO movimiento de SU tanque
      const isLast = tanksLastMovement[item.id_tanque] &&
                     tanksLastMovement[item.id_tanque].tabla_referencia === "mediciones_tanque" &&
                     tanksLastMovement[item.id_tanque].id_referencia === item.id_medicion;
      return { ...item, can_revert: !!isLast };
    });
  }

  return pagedResult;
};

/**
 * Revertir Medición Ordinaria
 *
 * Regla de Oro: Solo se puede revertir si este movimiento es el ÚLTIMO
 * que afectó al tanque en la tabla movimientos_inventario.
 *
 * Acción atómica:
 *  1. Cambia estado de MedicionTanque → "ANULADO"
 *  2. Restaura Tanque.nivel_actual al valor previo a la medición
 *  3. Elimina el registro de MovimientoInventario asociado
 */
exports.revertirMedicion = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    // 1. Cargar la medición
    const medicion = await MedicionTanque.findByPk(id, { transaction: t });
    if (!medicion) throw new Error("Medición no encontrada.");
    if (medicion.estado === "ANULADO") {
      throw new Error("La medición ya se encuentra anulada.");
    }
    if (medicion.tipo_medicion === "CIERRE") {
      const err = new Error(
        "Las mediciones de tipo CIERRE deben revertirse desde el módulo de Cierre de Turno."
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Validar: debe ser el último movimiento del tanque (Regla de Oro)
    const ultimoMovimiento = await MovimientoInventario.findOne({
      where: { id_tanque: medicion.id_tanque },
      order: [["id_movimiento", "DESC"]],
      transaction: t,
    });

    if (
      !ultimoMovimiento ||
      ultimoMovimiento.id_referencia !== medicion.id_medicion ||
      ultimoMovimiento.tabla_referencia !== "mediciones_tanque"
    ) {
      const err = new Error(
        "No se puede revertir. Existen movimientos de inventario posteriores en este tanque. " +
          "Debe revertir el último movimiento primero."
      );
      err.statusCode = 409;
      throw err;
    }

    // 3. Restaurar nivel_actual del tanque al valor previo
    const tanque = await Tanque.findByPk(medicion.id_tanque, {
      transaction: t,
      lock: true,
    });
    const nivelRestaurado = parseFloat(ultimoMovimiento.volumen_antes);
    await tanque.update({ nivel_actual: nivelRestaurado }, { transaction: t });

    // 4. Marcar medición como ANULADA
    await medicion.update({ estado: "ANULADO" }, { transaction: t });

    // 5. Eliminar el registro del ledger de inventario
    await ultimoMovimiento.destroy({ transaction: t });

    return { medicion, nivelRestaurado, id_tanque: medicion.id_tanque };
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
