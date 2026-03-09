const {
  Solicitud,
  CupoActual,
  Subdependencia,
  Llenadero,
  TipoCombustible,
  Vehiculo,
  Usuario,
  Dependencia,
  Categoria,
  CupoBase,
  PrecioCombustible,
} = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");
const moment = require("moment");
const {
  ESTADOS_SOLICITUD,
  TIPOS_SUMINISTRO,
  TIPOS_SOLICITUD,
  PREFIJOS_TICKET,
} = require("../../constants/solicitudConstants");

/**
 * Crear una nueva solicitud de combustible
 * @param {Object} data - Datos del formulario
 * @param {Object} user - Usuario que realiza la solicitud
 * @param {string} clientIp - IP del cliente para auditoría
 */
exports.createSolicitud = async (data, user, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const { id_usuario } = user;
    const {
      id_vehiculo,
      placa,
      marca,
      modelo,
      flota,
      id_llenadero,
      id_tipo_combustible,
      cantidad_litros,
      tipo_suministro,
      tipo_solicitud,
      id_precio,
      id_subdependencia,
      id_dependencia,
      id_categoria,
    } = data;

    // Validación de cantidad positiva
    if (!cantidad_litros || parseFloat(cantidad_litros) <= 0) {
      throw new Error("La cantidad de litros debe ser mayor a cero");
    }

    // --- Normalizar datos según tipo de suministro ---
    const esBidon = tipo_suministro === TIPOS_SUMINISTRO.BIDON;

    const placaFinal = esBidon ? "NO APLICA" : placa;
    const marcaFinal = esBidon ? "NO APLICA" : marca;
    const modeloFinal = esBidon ? "NO APLICA" : modelo;
    const idVehiculoFinal = esBidon ? null : id_vehiculo;

    // Validar placa presente para solicitudes REGULAR
    if (!esBidon && !placa) {
      throw new Error("La placa del vehículo es requerida");
    }

    // Validar Bloqueo de Placa (RF-05) — Solo aplica a solicitudes REGULAR
    if (!esBidon) {
      const solicitudActiva = await Solicitud.findOne({
        where: {
          placa: placaFinal,
          estado: {
            [Op.in]: [
              ESTADOS_SOLICITUD.PENDIENTE,
              ESTADOS_SOLICITUD.APROBADA,
              ESTADOS_SOLICITUD.IMPRESA,
            ],
          },
        },
        transaction: t,
      });

      if (solicitudActiva) {
        throw new Error(
          `El vehículo ${placaFinal} ya tiene una solicitud activa (Ticket: ${solicitudActiva.codigo_ticket || "Pendiente"
          }).`,
        );
      }
    }

    // Validar Cupo y Reservar (RF-04, RF-06)
    const periodoActual = moment().format("YYYY-MM");

    const cupoBase = await CupoBase.findOne({
      where: {
        id_subdependencia: id_subdependencia || null,
        id_tipo_combustible: id_tipo_combustible || null,
      },
      transaction: t,
    });

    if (!cupoBase) {
      throw new Error(
        "No existe cupo base configurado para esta subdependencia y tipo de combustible.",
      );
    }

    // Buscar o crear cupo actual (Evitar Race Condition con findOrCreate)
    const inicioMes = moment(periodoActual, "YYYY-MM")
      .startOf("month")
      .toDate();
    const finMes = moment(periodoActual, "YYYY-MM").endOf("month").toDate();

    let [cupoActual] = await CupoActual.findOrCreate({
      where: {
        periodo: periodoActual,
        id_cupo_base: cupoBase.id_cupo_base,
      },
      defaults: {
        id_cupo_base: cupoBase.id_cupo_base,
        periodo: periodoActual,
        cantidad_asignada: cupoBase.cantidad_mensual,
        cantidad_disponible: cupoBase.cantidad_mensual,
        cantidad_consumida: 0,
        cantidad_recargada: 0,
        fecha_inicio: inicioMes,
        fecha_fin: finMes,
        estado: "ACTIVO",
      },
      transaction: t,
      lock: true,
    });

    if (
      parseFloat(cupoActual.cantidad_disponible) < parseFloat(cantidad_litros)
    ) {
      throw new Error(
        `Cupo insuficiente. Disponible: ${cupoActual.cantidad_disponible} Lts. Solicitado: ${cantidad_litros} Lts.`,
      );
    }

    await cupoActual.decrement("cantidad_disponible", {
      by: cantidad_litros,
      transaction: t,
    });
    await cupoActual.increment("cantidad_consumida", {
      by: cantidad_litros,
      transaction: t,
    });

    // Cálculos de Venta (RF-03)
    let precio_unitario = 0;
    let monto_total = 0;

    if (tipo_solicitud === TIPOS_SOLICITUD.VENTA) {
      const sub = await Subdependencia.findByPk(id_subdependencia);
      if (!sub || !sub.cobra_venta) {
        throw new Error(
          "Esta subdependencia no tiene habilitada la modalidad de venta.",
        );
      }

      if (id_precio) {
        const precioObj = await PrecioCombustible.findByPk(id_precio);
        if (precioObj) {
          precio_unitario = parseFloat(precioObj.precio);
          monto_total = parseFloat(
            (parseFloat(cantidad_litros) * precio_unitario).toFixed(4),
          );
        }
      } else {
        throw new Error(
          "El ID de precio es obligatorio para solicitudes de tipo VENTA.",
        );
      }
    }

    // Obtener Código de Dependencia
    const depObj = await Dependencia.findByPk(id_dependencia, {
      transaction: t,
    });
    if (!depObj) {
      throw new Error("Dependencia no encontrada para generar ticket.");
    }

    // Crear Solicitud
    const nuevaSolicitud = await Solicitud.create(
      {
        id_usuario,
        id_dependencia,
        id_subdependencia,
        id_categoria,
        id_vehiculo: idVehiculoFinal,
        placa: placaFinal,
        marca: marcaFinal,
        modelo: modeloFinal,
        flota: esBidon ? null : flota,
        id_llenadero,
        id_tipo_combustible,
        cantidad_litros: parseFloat(cantidad_litros),
        cantidad_despachada: null,
        tipo_suministro,
        tipo_solicitud,
        id_precio,
        precio_unitario,
        monto_total,
        estado: ESTADOS_SOLICITUD.PENDIENTE,
        fecha_solicitud: new Date(),
      },
      { transaction: t },
    );

    // Generar Ticket
    const prefijo =
      tipo_suministro === TIPOS_SUMINISTRO.BIDON
        ? PREFIJOS_TICKET.BIDON
        : PREFIJOS_TICKET.REGULAR;
    const codDep = (depObj.codigo || "000").padStart(3, "0");
    const correlativo = nuevaSolicitud.id_solicitud.toString().padStart(6, "0");
    const codigo_ticket = `${prefijo}${codDep}${correlativo}`;

    await nuevaSolicitud.update({ codigo_ticket }, { transaction: t });
    nuevaSolicitud.codigo_ticket = codigo_ticket;

    // Retornamos el objeto con la data creada
    return { solicitud: nuevaSolicitud, ticket: codigo_ticket };
  });
};

exports.aprobarSolicitud = async (id, aprobadorId, clientIp) => {
  // Nota: Aunque aprobar es una operación simple, la envolvemos en executeTransaction
  // para auditar la IP y potencialmente agregar bloqueos si se requiere en el futuro.
  return await executeTransaction(clientIp, async (t) => {
    // Para evitar Race Condition en aprobación, usamos lock
    const solicitud = await Solicitud.findByPk(id, {
      transaction: t,
      lock: true,
    });

    if (!solicitud) throw new Error("Solicitud no encontrada");

    if (solicitud.estado !== ESTADOS_SOLICITUD.PENDIENTE) {
      throw new Error("La solicitud no está en estado Pendiente");
    }

    await solicitud.update(
      {
        estado: ESTADOS_SOLICITUD.APROBADA,
        fecha_aprobacion: new Date(),
        id_aprobador: aprobadorId,
      },
      { transaction: t },
    );

    return solicitud;
  });
};

exports.obtenerSubdependenciasAutorizadas = async (user) => {
  const { id_usuario, tipo_usuario } = user;

  if (tipo_usuario === "ADMIN") {
    return await Subdependencia.findAll({
      where: { estatus: "ACTIVO" },
      attributes: [
        "id_subdependencia",
        "nombre",
        ["nombre", "nombre_subdependencia"],
        "id_dependencia",
        "cobra_venta",
      ],
      order: [["nombre", "ASC"]],
    });
  }

  const usuarioConSubs = await Usuario.findByPk(id_usuario, {
    attributes: ["id_dependencia"],
    include: [
      {
        model: Dependencia,
        as: "Dependencia",
        required: true,
        include: [
          {
            model: Subdependencia,
            as: "Subdependencia",
            attributes: [
              "id_subdependencia",
              "nombre",
              ["nombre", "nombre_subdependencia"],
              "id_dependencia",
              "cobra_venta",
            ],
            where: { estatus: "ACTIVO" },
            required: false,
          },
        ],
      },
    ],
  });

  let subdependencias = [];
  if (usuarioConSubs?.Dependencia?.Subdependencia) {
    subdependencias = Array.isArray(usuarioConSubs.Dependencia.Subdependencia)
      ? usuarioConSubs.Dependencia.Subdependencia
      : [usuarioConSubs.Dependencia.Subdependencia];
  }

  return subdependencias;
};

exports.listarSolicitudes = async (query, user) => {
  let {
    tipo_usuario,
    id_usuario,
    id_dependencia,
    id_categoria,
    id_subdependencia,
  } = user;

  if (
    !id_categoria &&
    !id_dependencia &&
    !id_subdependencia &&
    tipo_usuario !== "ADMIN"
  ) {
    const usuarioFull = await Usuario.findByPk(id_usuario);
    if (usuarioFull) {
      id_categoria = usuarioFull.id_categoria;
      id_dependencia = usuarioFull.id_dependencia;
      id_subdependencia = usuarioFull.id_subdependencia;
    }
  }

  const where = {};

  if (tipo_usuario === "SOLICITANTE") {
    where.id_usuario = id_usuario;
  }

  // Todos los roles (excepto ADMIN y SOLICITANTE) filtran por su dependencia
  const ROLES_FILTRAN_POR_DEPENDENCIA = [
    "GERENTE",
    "JEFE DIVISION",
    "ALMACENISTA",
    "SUPERVISOR",
    "COORDINADOR",
    "INSPECTOR",
  ];

  if (ROLES_FILTRAN_POR_DEPENDENCIA.includes(tipo_usuario)) {
    if (id_dependencia) {
      where.id_dependencia = id_dependencia;
    }
  }

  if (query.estado) where.estado = query.estado;
  if (query.fecha_inicio && query.fecha_fin) {
    where.fecha_solicitud = {
      [Op.between]: [query.fecha_inicio, query.fecha_fin],
    };
  }

  const searchableFields = ["codigo_ticket", "placa", "flota"];

  return await paginate(Solicitud, query, {
    where,
    searchableFields,
    include: [
      {
        model: Usuario,
        as: "Solicitante",
        attributes: ["nombre", "apellido", "cedula"],
      },
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["nombre_dependencia", "codigo"],
      },
      { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
      { model: TipoCombustible, attributes: ["nombre"], where: { activo: true }, required: false },
      { model: Llenadero, attributes: ["nombre_llenadero"] },
    ],
    order: [["fecha_solicitud", "DESC"]],
  });
};

exports.rechazarSolicitud = async (id, motivo, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const solicitud = await Solicitud.findByPk(id, { transaction: t });

    if (!solicitud) {
      throw new Error("Solicitud no encontrada");
    }

    if (
      [
        ESTADOS_SOLICITUD.DESPACHADA,
        ESTADOS_SOLICITUD.VENCIDA,
        ESTADOS_SOLICITUD.ANULADA,
      ].includes(solicitud.estado)
    ) {
      throw new Error(
        `No se puede rechazar una solicitud en estado ${solicitud.estado}`,
      );
    }

    const periodoOriginal = moment(solicitud.fecha_solicitud).format("YYYY-MM");
    const cupo = await CupoActual.findOne({
      where: {
        periodo: periodoOriginal,
        estado: { [Op.ne]: "CERRADO" },
      },
      include: [
        {
          model: CupoBase,
          as: "CupoBase",
          where: {
            id_subdependencia: solicitud.id_subdependencia,
            id_tipo_combustible: solicitud.id_tipo_combustible,
          },
        },
      ],
      transaction: t,
    });

    if (cupo) {
      await cupo.increment("cantidad_disponible", {
        by: solicitud.cantidad_litros,
        transaction: t,
      });
      await cupo.decrement("cantidad_consumida", {
        by: solicitud.cantidad_litros,
        transaction: t,
      });
    }

    await solicitud.update(
      {
        estado: ESTADOS_SOLICITUD.ANULADA,
        observaciones: motivo ? `RECHAZO: ${motivo}` : "RECHAZO SIN MOTIVO",
      },
      { transaction: t },
    );

    // Retornar la solicitud actualizada para emitir evento socket
    return {
      msg: "Solicitud rechazada y cupo reintegrado exitosamente",
      solicitud,
    };
  });
};

exports.obtenerLlenaderosPorCombustible = async (id_tipo_combustible) => {
  const reqPath = require('path');
  const Tanque = require(reqPath.join(__dirname, '../../models/Tanque.js'));

  return await Llenadero.findAll({
    where: {
      estado: "ACTIVO",
    },
    include: [
      {
        model: Tanque,
        as: "Tanques",
        where: {
          id_tipo_combustible: id_tipo_combustible,
          estado: 'ACTIVO',
          nivel_actual: { [Op.gt]: 0 }
        },
        attributes: ["id_tipo_combustible", "nivel_actual", "activo_para_despacho"],
        include: [
          {
            model: TipoCombustible,
            as: "TipoCombustible",
            attributes: ["nombre"]
          }
        ]
      }
    ],
    order: [["nombre_llenadero", "ASC"]],
  });
};
