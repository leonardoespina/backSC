const {
  TransferenciaInterna,
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

  return await paginate(TransferenciaInterna, query, {
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
