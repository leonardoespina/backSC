const {
  TransferenciaInterna,
  MovimientoInventario,
  Tanque,
  Usuario,
  Llenadero,
} = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Transferencia Interna
 */
exports.crearTransferencia = async (data, user, clientIp) => {
  const { id_usuario } = user;
  const {
    fecha_transferencia,
    id_tanque_origen,
    id_tanque_destino,
    cantidad_transferida,
    medida_vara_destino,
    observacion,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const [tanqueOrigen, tanqueDestino] = await Promise.all([
      Tanque.findByPk(id_tanque_origen, { transaction: t, lock: true }),
      Tanque.findByPk(id_tanque_destino, { transaction: t, lock: true }),
    ]);

    if (!tanqueOrigen || !tanqueDestino) {
      throw new Error("Uno o ambos tanques no fueron encontrados.");
    }

    const v_transferido = parseFloat(cantidad_transferida);
    const nivel_origen_antes = parseFloat(tanqueOrigen.nivel_actual);
    const nivel_destino_antes = parseFloat(tanqueDestino.nivel_actual);

    if (nivel_origen_antes < v_transferido) {
      throw new Error("Inventario insuficiente en el tanque de origen.");
    }

    const nivel_origen_despues = nivel_origen_antes - v_transferido;
    const nivel_destino_despues = nivel_destino_antes + v_transferido;

    const nuevaTransferencia = await TransferenciaInterna.create(
      {
        fecha_transferencia,
        id_tanque_origen,
        id_tanque_destino,
        cantidad_transferida: v_transferido,
        nivel_origen_antes,
        nivel_origen_despues,
        nivel_destino_antes,
        nivel_destino_despues,
        id_almacenista: id_usuario,
        medida_vara_destino,
        observacion,
        estado: "PROCESADO",
      },
      { transaction: t },
    );

    await tanqueOrigen.update(
      { nivel_actual: nivel_origen_despues },
      { transaction: t },
    );
    await tanqueDestino.update(
      { nivel_actual: nivel_destino_despues },
      { transaction: t },
    );

    // Registrar trazabilidad en el ledger central de inventario
    await MovimientoInventario.create(
      {
        id_tanque: id_tanque_origen,
        id_cierre_turno: null,
        tipo_movimiento: "TRANSFERENCIA_SALIDA",
        id_referencia: nuevaTransferencia.id_transferencia,
        tabla_referencia: "transferencias_internas",
        volumen_antes: nivel_origen_antes,
        volumen_despues: nivel_origen_despues,
        variacion: parseFloat((-v_transferido).toFixed(2)),
        fecha_movimiento: new Date(),
        id_usuario,
        observaciones: `Transferencia hacia Tanque ID: ${id_tanque_destino}`,
      },
      { transaction: t },
    );

    await MovimientoInventario.create(
      {
        id_tanque: id_tanque_destino,
        id_cierre_turno: null,
        tipo_movimiento: "TRANSFERENCIA_ENTRADA",
        id_referencia: nuevaTransferencia.id_transferencia,
        tabla_referencia: "transferencias_internas",
        volumen_antes: nivel_destino_antes,
        volumen_despues: nivel_destino_despues,
        variacion: parseFloat(v_transferido.toFixed(2)),
        fecha_movimiento: new Date(),
        id_usuario,
        observaciones: `Transferencia desde Tanque ID: ${id_tanque_origen}`,
      },
      { transaction: t },
    );

    return {
      nuevaTransferencia,
      nivel_origen_despues,
      nivel_destino_despues,
      id_tanque_origen,
      id_tanque_destino,
    };
  });
};

/**
 * Listar Transferencias
 */
exports.listarTransferencias = async (query) => {
  const { id_tanque, fecha_inicio, fecha_fin } = query;
  const where = {};

  if (id_tanque) {
    where[Op.or] = [
      { id_tanque_origen: id_tanque },
      { id_tanque_destino: id_tanque },
    ];
  }

  if (fecha_inicio && fecha_fin) {
    where.fecha_transferencia = { [Op.between]: [fecha_inicio, fecha_fin] };
  }

  const searchableFields = ["observacion"];

  const pagedResult = await paginate(TransferenciaInterna, query, {
    where,
    searchableFields,
    include: [
      {
        model: Tanque,
        as: "TanqueOrigen",
        attributes: ["id_tanque", "codigo", "nombre", "id_llenadero"],
        include: [
          {
            model: Llenadero,
            as: "Llenadero",
            attributes: ["nombre_llenadero"],
          },
        ],
      },
      {
        model: Tanque,
        as: "TanqueDestino",
        attributes: ["id_tanque", "codigo", "nombre", "id_llenadero"],
        include: [
          {
            model: Llenadero,
            as: "Llenadero",
            attributes: ["nombre_llenadero"],
          },
        ],
      },
      {
        model: Usuario,
        as: "Almacenista",
        attributes: ["id_usuario", "nombre", "apellido"],
      },
    ],
    order: [["fecha_transferencia", "DESC"]],
  });

  // Injectar can_revert
  if (pagedResult && pagedResult.data && pagedResult.data.length > 0) {
    const idsTanquesSet = new Set();
    pagedResult.data.forEach(t => {
      if (t.id_tanque_origen) idsTanquesSet.add(t.id_tanque_origen);
      if (t.id_tanque_destino) idsTanquesSet.add(t.id_tanque_destino);
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

    pagedResult.data = pagedResult.data.map(transferencia => {
      const item = transferencia.toJSON ? transferencia.toJSON() : transferencia;
      
      const lastMovOrigen = tanksLastMovement[item.id_tanque_origen];
      const lastMovDestino = tanksLastMovement[item.id_tanque_destino];

      const isLastOrigen = lastMovOrigen && 
                           lastMovOrigen.tabla_referencia === "transferencias_internas" && 
                           lastMovOrigen.id_referencia === item.id_transferencia;
                           
      const isLastDestino = lastMovDestino && 
                            lastMovDestino.tabla_referencia === "transferencias_internas" && 
                            lastMovDestino.id_referencia === item.id_transferencia;

      // Debe ser el último movimiento en AMBOS tanques
      const isLast = isLastOrigen && isLastDestino;

      return { ...item, can_revert: !!isLast };
    });
  }

  return pagedResult;
};

/**
 * Actualizar Transferencia (Solo observaciones)
 */
exports.actualizarTransferencia = async (id, data, clientIp) => {
  const { observacion } = data;

  return await executeTransaction(clientIp, async (t) => {
    const transferencia = await TransferenciaInterna.findByPk(id, {
      transaction: t,
    });
    if (!transferencia) {
      throw new Error("Transferencia no encontrada.");
    }

    await transferencia.update(
      { observacion, estado: "MODIFICADO" },
      { transaction: t },
    );

    return transferencia;
  });
};

/**
 * Obtener Transferencia por ID
 */
exports.obtenerTransferenciaPorId = async (id) => {
  const transferencia = await TransferenciaInterna.findByPk(id, {
    include: [
      {
        model: Tanque,
        as: "TanqueOrigen",
        attributes: ["id_tanque", "codigo", "nombre", "id_llenadero"],
        include: [
          {
            model: Llenadero,
            as: "Llenadero",
            attributes: ["nombre_llenadero"],
          },
        ],
      },
      {
        model: Tanque,
        as: "TanqueDestino",
        attributes: ["id_tanque", "codigo", "nombre", "id_llenadero"],
        include: [
          {
            model: Llenadero,
            as: "Llenadero",
            attributes: ["nombre_llenadero"],
          },
        ],
      },
      {
        model: Usuario,
        as: "Almacenista",
        attributes: ["id_usuario", "nombre", "apellido"],
      },
    ],
  });

  if (!transferencia) {
    throw new Error("Transferencia no encontrada.");
  }

  return transferencia;
};

/**
 * Revertir Transferencia Interna
 *
 * Regla de Oro: El último movimiento de inventario de AMBOS tanques
 * (origen y destino) debe corresponder a esta transferencia.
 * Si uno solo tiene movimientos posteriores, se rechaza la operación completa.
 *
 * Acción atómica:
 *  1. Cambia estado de TransferenciaInterna → "ANULADA"
 *  2. Restaura nivel_actual de tanque origen (suma lo que salió)
 *  3. Restaura nivel_actual de tanque destino (resta lo que entró)
 *  4. Elimina los dos registros de MovimientoInventario
 */
exports.revertirTransferencia = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    // 1. Cargar la transferencia
    const transferencia = await TransferenciaInterna.findByPk(id, {
      transaction: t,
    });

    if (!transferencia) {
      const err = new Error("Transferencia no encontrada.");
      err.statusCode = 404;
      throw err;
    }
    if (transferencia.estado === "ANULADA") {
      const err = new Error("La transferencia ya se encuentra anulada.");
      err.statusCode = 400;
      throw err;
    }

    // 2. Buscar el último movimiento de cada tanque (Regla de Oro)
    const [ultimoOrigen, ultimoDestino] = await Promise.all([
      MovimientoInventario.findOne({
        where: { id_tanque: transferencia.id_tanque_origen },
        order: [["id_movimiento", "DESC"]],
        transaction: t,
      }),
      MovimientoInventario.findOne({
        where: { id_tanque: transferencia.id_tanque_destino },
        order: [["id_movimiento", "DESC"]],
        transaction: t,
      }),
    ]);

    const esMismaTransferencia = (mov) =>
      mov &&
      mov.id_referencia === transferencia.id_transferencia &&
      mov.tabla_referencia === "transferencias_internas";

    if (!esMismaTransferencia(ultimoOrigen)) {
      const err = new Error(
        `No se puede revertir. El Tanque origen (ID ${transferencia.id_tanque_origen}) tiene ` +
          `movimientos de inventario posteriores a esta transferencia.`
      );
      err.statusCode = 409;
      throw err;
    }
    if (!esMismaTransferencia(ultimoDestino)) {
      const err = new Error(
        `No se puede revertir. El Tanque destino (ID ${transferencia.id_tanque_destino}) tiene ` +
          `movimientos de inventario posteriores a esta transferencia.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 3. Restaurar niveles de ambos tanques
    const [tanqueOrigen, tanqueDestino] = await Promise.all([
      Tanque.findByPk(transferencia.id_tanque_origen, { transaction: t, lock: true }),
      Tanque.findByPk(transferencia.id_tanque_destino, { transaction: t, lock: true }),
    ]);

    const nivelOrigenRestaurado = parseFloat(ultimoOrigen.volumen_antes);
    const nivelDestinoRestaurado = parseFloat(ultimoDestino.volumen_antes);

    await tanqueOrigen.update({ nivel_actual: nivelOrigenRestaurado }, { transaction: t });
    await tanqueDestino.update({ nivel_actual: nivelDestinoRestaurado }, { transaction: t });

    // 4. Marcar la transferencia como ANULADA y limpiar el ledger
    await transferencia.update({ estado: "ANULADA" }, { transaction: t });
    await ultimoOrigen.destroy({ transaction: t });
    await ultimoDestino.destroy({ transaction: t });

    return {
      transferencia,
      id_tanque_origen: transferencia.id_tanque_origen,
      id_tanque_destino: transferencia.id_tanque_destino,
      nivelOrigenRestaurado,
      nivelDestinoRestaurado,
    };
  });
};

