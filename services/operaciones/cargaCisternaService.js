const {
  CargaCisterna,
  CargaCisternaTanque,
  Tanque,
  Usuario,
  TipoCombustible,
  MovimientoInventario
} = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Carga de Cisterna Múltiples Tanques
 */
exports.crearCargaCisterna = async (data, user, clientIp) => {
  const { id_usuario } = user;
  const {
    numero_guia,
    fecha_emision,
    fecha_recepcion,
    fecha,
    hora,
    placa_cisterna,
    nombre_chofer,
    litros_segun_guia,
    diferencia_guia,
    litros_flujometro,
    peso_entrada,
    peso_salida,
    hora_inicio_descarga,
    hora_fin_descarga,
    tiempo_descarga,
    aforo_compartimiento,
    observacion,
    tanques_descarga, // Array de tanques
    // Mantenemos por si el front envía los scalars temporalmente
    id_tanque, medida_inicial, medida_final, litros_iniciales, litros_finales, litros_recibidos
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Manejo de retrocompatibilidad y normalización a Array
    let tanquesArray = [];
    if (tanques_descarga && Array.isArray(tanques_descarga) && tanques_descarga.length > 0) {
      tanquesArray = tanques_descarga;
    } else if (id_tanque) {
      // Legacy support temporal
      tanquesArray = [{
        id_tanque, medida_inicial, medida_final, litros_iniciales, litros_finales,
        litros_recibidos: (litros_recibidos || 0)
      }];
    }

    if (tanquesArray.length === 0) {
      throw new Error("Debe especificar al menos un tanque de destino para la descarga.");
    }

    // 2. Extraer el primer tanque para el combustible
    const primerTanque = await Tanque.findByPk(tanquesArray[0].id_tanque, { transaction: t });
    if (!primerTanque) throw new Error("Tanque receptor inicial no encontrado.");

    // Calcular el total de litros recibidos global sumando cada iteración
    const totalLitrosRecibidosFinal = tanquesArray.reduce((acc, tk) => acc + parseFloat(tk.litros_recibidos || 0), 0);

    // 3. Crear cabecera CargaCisterna
    const nuevaCarga = await CargaCisterna.create(
      {
        numero_guia,
        fecha_emision,
        fecha_recepcion,
        fecha_llegada: `${fecha}T${hora}`,
        placa_cisterna,
        nombre_chofer,
        id_almacenista: id_usuario,
        id_tipo_combustible: primerTanque.id_tipo_combustible,
        litros_segun_guia,
        // Variables legacy pero globales
        id_tanque: tanquesArray.length === 1 ? tanquesArray[0].id_tanque : null,
        litros_recibidos: totalLitrosRecibidosFinal,
        diferencia_guia,
        litros_flujometro,
        peso_entrada,
        peso_salida,
        hora_inicio_descarga,
        hora_fin_descarga,
        tiempo_descarga,
        aforo_compartimiento,
        observacion,
        id_usuario_registro: id_usuario,
        estado: "PROCESADO",
      },
      { transaction: t }
    );

    // 4. Iterar y guardar los Detalles y Actualizar niveles de Tank
    for (const tk of tanquesArray) {
      const tanqueActual = await Tanque.findByPk(tk.id_tanque, { transaction: t, lock: true });
      if (!tanqueActual) throw new Error(`Tanque receptor con ID ${tk.id_tanque} no encontrado.`);

      await CargaCisternaTanque.create({
        id_carga: nuevaCarga.id_carga,
        id_tanque: tk.id_tanque,
        medida_inicial: tk.medida_inicial,
        medida_final: tk.medida_final,
        litros_iniciales: tk.litros_iniciales,
        litros_finales: tk.litros_finales,
        litros_recibidos: tk.litros_recibidos
      }, { transaction: t });

      const volumenAntes = parseFloat(tanqueActual.nivel_actual || 0);

      let volumenDespues;
      const { fuente_actualizacion } = data;
      const valorFlujometro = parseFloat(litros_flujometro || 0);

      if (fuente_actualizacion === "FLUJOMETRO" && valorFlujometro > 0) {
        const litrosRealesRecibidos = tanquesArray.length > 1 ? parseFloat(tk.litros_recibidos || 0) : valorFlujometro;
        volumenDespues = volumenAntes + litrosRealesRecibidos;
      } else {
        volumenDespues = parseFloat(tk.litros_finales || 0);
      }

      await MovimientoInventario.create({
        id_tanque: tk.id_tanque,
        id_cierre_turno: null,
        tipo_movimiento: "RECEPCION_CISTERNA",
        id_referencia: nuevaCarga.id_carga,
        tabla_referencia: "cargas_cisternas",
        volumen_antes: volumenAntes,
        volumen_despues: volumenDespues,
        variacion: volumenDespues - volumenAntes,
        id_usuario: id_usuario,
        observaciones: `Recepción Cisterna Placa: ${placa_cisterna} (Origen: ${fuente_actualizacion})`
      }, { transaction: t });

      // Actualizar el inventario físico con la decisión del usuario
      await tanqueActual.update({ nivel_actual: volumenDespues }, { transaction: t });
    }

    return { nuevaCarga, tanquesProcesados: tanquesArray.length };
  });
};

/**
 * Listar Cargas de Cisterna
 */
exports.listarCargasCisterna = async (query) => {
  const { id_tanque, fecha_inicio, fecha_fin } = query;
  const where = {};

  if (id_tanque) {
    where.id_tanque = id_tanque; // Nota: Si hay filtro estricto requeriria join en CargaCisternaTanque en el futuro.
  }

  if (fecha_inicio && fecha_fin) {
    where.fecha_llegada = { [Op.between]: [fecha_inicio, fecha_fin] };
  }

  const searchableFields = ["numero_guia", "placa_cisterna", "observacion"];

  const pagedResult = await paginate(CargaCisterna, query, {
    where,
    searchableFields,
    include: [
      { model: Tanque, as: "Tanque", attributes: ["codigo", "nombre"] }, // Legacy
      {
        model: CargaCisternaTanque,
        as: "tanques_descarga",
        include: [{ model: Tanque, as: "Tanque", attributes: ["codigo", "nombre"] }]
      },
      {
        model: Usuario,
        as: "Almacenista",
        attributes: ["nombre", "apellido"],
      },
    ],
    order: [["fecha_llegada", "DESC"]],
  });

  // Injectar can_revert
  if (pagedResult && pagedResult.data && pagedResult.data.length > 0) {
    // Extraer todos los id_tanque únicos de las cargas en esta página
    const idsTanquesSet = new Set();
    pagedResult.data.forEach(carga => {
      if (carga.id_tanque) idsTanquesSet.add(carga.id_tanque);
      if (carga.tanques_descarga && carga.tanques_descarga.length > 0) {
        carga.tanques_descarga.forEach(td => idsTanquesSet.add(td.id_tanque));
      }
    });

    const tanksLastMovement = {};
    for (const id_tanque of idsTanquesSet) {
      const lastMov = await MovimientoInventario.findOne({
        where: { id_tanque },
        order: [["id_movimiento", "DESC"]],
        attributes: ["id_referencia", "tabla_referencia"]
      });
      tanksLastMovement[id_tanque] = lastMov;
    }

    pagedResult.data = pagedResult.data.map(carga => {
      const item = carga.toJSON ? carga.toJSON() : carga;
      let isLast = true;
      const tanquesInvolucrados = item.tanques_descarga && item.tanques_descarga.length > 0
        ? item.tanques_descarga.map(td => td.id_tanque)
        : [item.id_tanque].filter(Boolean);

      // Debe ser el último movimiento en TODOS los tanques involucrados en la descarga
      for (const id_tanque of tanquesInvolucrados) {
        const lastMov = tanksLastMovement[id_tanque];
        if (!lastMov || lastMov.tabla_referencia !== "cargas_cisternas" || lastMov.id_referencia !== item.id_carga) {
          isLast = false;
          break;
        }
      }
      return { ...item, can_revert: !!isLast };
    });
  }

  return pagedResult;
};

/**
 * Actualizar Carga (Reducido a solo métricas de la cabecera por seguridad)
 */
exports.actualizarCarga = async (id, data, clientIp) => {
  const {
    numero_guia,
    fecha_emision,
    fecha_recepcion,
    fecha,
    hora,
    placa_cisterna,
    nombre_chofer,
    tiempo_descarga,
    aforo_compartimiento,
    observacion,
    // (Por seguridad no actualizaremos tanques en Update para evitar romper logs de inventario,
    // a menos que sea necesario revertir y re-aplicar).
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const carga = await CargaCisterna.findByPk(id, { transaction: t, lock: true });
    if (!carga) throw new Error("Carga no encontrada.");

    await carga.update(
      {
        numero_guia,
        fecha_emision,
        fecha_recepcion,
        fecha_llegada: `${fecha}T${hora}`,
        placa_cisterna,
        nombre_chofer,
        tiempo_descarga,
        aforo_compartimiento,
        observacion,
      },
      { transaction: t },
    );

    return { carga };
  });
};

/**
 * Revertir Carga de Cisterna
 *
 * Regla de Oro: Para cada tanque afectado por la carga, el último
 * movimiento de inventario debe ser el de esta carga. Si algún tanque
 * tiene movimientos posteriores, se rechaza la operación completa.
 *
 * Acción atómica:
 *  1. Cambia estado de CargaCisterna → "ANULADA"
 *  2. Por cada tanque: restaura nivel_actual al valor previo a la recepción
 *  3. Elimina todos los registros de MovimientoInventario de esta carga
 */
exports.revertirCarga = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    // 1. Cargar cabecera + detalle de tanques
    const carga = await CargaCisterna.findByPk(id, {
      include: [
        {
          model: CargaCisternaTanque,
          as: "tanques_descarga",
        },
      ],
      transaction: t,
    });

    if (!carga) {
      const err = new Error("Carga de cisterna no encontrada.");
      err.statusCode = 404;
      throw err;
    }
    if (carga.estado === "ANULADA") {
      const err = new Error("La carga de cisterna ya se encuentra anulada.");
      err.statusCode = 400;
      throw err;
    }

    // 2. Validar la Regla de Oro por cada tanque involucrado
    const movimientosACancelar = [];
    for (const detalle of carga.tanques_descarga) {
      const ultimoMovimiento = await MovimientoInventario.findOne({
        where: { id_tanque: detalle.id_tanque },
        order: [["id_movimiento", "DESC"]],
        transaction: t,
      });

      if (
        !ultimoMovimiento ||
        ultimoMovimiento.id_referencia !== carga.id_carga ||
        ultimoMovimiento.tabla_referencia !== "cargas_cisternas"
      ) {
        const err = new Error(
          `No se puede revertir. El Tanque ID ${detalle.id_tanque} tiene movimientos de inventario ` +
            `posteriores a esta carga. Revierte esos movimientos primero.`
        );
        err.statusCode = 409;
        throw err;
      }
      movimientosACancelar.push({ detalle, movimiento: ultimoMovimiento });
    }

    // 3. Aplicar reversión atómica para cada tanque
    const tanquesAfectados = [];
    for (const { detalle, movimiento } of movimientosACancelar) {
      const tanque = await Tanque.findByPk(detalle.id_tanque, {
        transaction: t,
        lock: true,
      });
      const nivelRestaurado = parseFloat(movimiento.volumen_antes);
      await tanque.update({ nivel_actual: nivelRestaurado }, { transaction: t });
      await movimiento.destroy({ transaction: t });
      tanquesAfectados.push({ id_tanque: detalle.id_tanque, nivelRestaurado });
    }

    // 4. Marcar la carga como ANULADA
    await carga.update({ estado: "ANULADA" }, { transaction: t });

    return { carga, tanquesAfectados };
  });
};

