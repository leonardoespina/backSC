const {
  Solicitud,
  MovimientoInventario,
  CupoActual,
  Llenadero,
  Subdependencia,
  Usuario,
  CupoBase,
  Dependencia,
  TipoCombustible,
  Tanque,
  CierreTurno,
} = require("../../models");
const { executeTransaction } = require("../../helpers/transactionHelper");
const moment = require("moment");
const { Op } = require("sequelize");
const { validateLlenaderoOrigin } = require("../../middlewares/originMiddleware");
const requestContext = require("../../helpers/requestContext");

/**
 * Consultar datos de un Ticket para validación
 */
exports.consultarTicket = async (codigo, clientIp) => {
  const solicitud = await Solicitud.findOne({
    where: { codigo_ticket: codigo },
    include: [
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["nombre_dependencia", "codigo"],
      },
      { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
      { model: TipoCombustible, attributes: ["nombre"], where: { activo: true }, required: false },
      { model: Llenadero, attributes: ["nombre_llenadero", "direccion_ip"], required: false },
      {
        model: Usuario,
        as: "Solicitante",
        attributes: ["nombre", "apellido", "cedula"],
      },
      { model: Usuario, as: "Validador", attributes: ["nombre", "apellido"] },
    ],
  });

  if (!solicitud) {
    const error = new Error("Ticket no encontrado");
    error.status = 404;
    throw error;
  }

  // =========================================================
  // VALIDACIÓN DE RED: Verificar que la terminal que escanea
  // pertenece al segmento de red del llenadero del ticket.
  // =========================================================
  const context = requestContext.get();
  validateLlenaderoOrigin(solicitud.Llenadero, clientIp, context?.gateway || 'UNKNOWN');

  // Validar estado
  if (solicitud.estado === "FINALIZADA") {
    return {
      msg: "Este ticket ya fue validado y finalizado anteriormente.",
      ticket: solicitud,
      status: "ALREADY_FINALIZED",
    };
  }

  if (!["DESPACHADA", "IMPRESA"].includes(solicitud.estado)) {
    const error = new Error(
      `El ticket no está en estado válido para validación (Estado actual: ${solicitud.estado}). Debe estar IMPRESA o DESPACHADA.`,
    );
    error.status = 400;
    error.statusCode = "INVALID_STATE";
    throw error;
  }

  return {
    msg: "Ticket listo para validación",
    ticket: solicitud,
    status: "READY",
  };
};

/**
 * Finalizar Ticket
 */
exports.finalizarTicket = async (data, user, clientIp) => {
  const { codigo_ticket, cantidad_real_cargada, observaciones } = data;
  const id_validador = user.id_usuario;

  if (!codigo_ticket) throw new Error("Código de ticket requerido");

  return await executeTransaction(clientIp, async (t) => {
    const solicitud = await Solicitud.findOne({
      where: { codigo_ticket },
      include: [{ model: Llenadero }],
      transaction: t,
    });

    if (!solicitud) {
      throw new Error(`Ticket no encontrado para finalizar el despacho (Código: ${codigo_ticket})`);
    }

    if (!["DESPACHADA", "IMPRESA"].includes(solicitud.estado)) {
      throw new Error(
        `El ticket debe estar IMPRESA o DESPACHADA para finalizar (Estado: ${solicitud.estado})`,
      );
    }

    // Validar configuración de red (IP) del Llenadero A/B
    const context = requestContext.get();
    validateLlenaderoOrigin(solicitud.Llenadero, clientIp, context?.gateway || 'UNKNOWN');

    const cantidadAprobada = parseFloat(solicitud.cantidad_litros);
    const cantidadReal = parseFloat(cantidad_real_cargada);

    if (cantidadReal > cantidadAprobada) {
      throw new Error("La cantidad real no puede ser mayor a la aprobada.");
    }

    const excedente = cantidadAprobada - cantidadReal;
    let mensajeExcedente = "";

    // LOGICA DE INVENTARIO (TANQUE ACTIVO)
    const tanqueActivo = await Tanque.findOne({
      where: {
        id_llenadero: solicitud.id_llenadero,
        id_tipo_combustible: solicitud.id_tipo_combustible,
        estado: 'ACTIVO',
        activo_para_despacho: true
      },
      transaction: t,
    });

    if (tanqueActivo) {
      if (solicitud.estado === "IMPRESA") {
        if (parseFloat(tanqueActivo.nivel_actual) < cantidadReal) {
          throw new Error(
            `Stock insuficiente en el tanque activo del Llenadero. Nivel actual: ${tanqueActivo.nivel_actual} L, requerido: ${cantidadReal} L.`
          );
        }

        await tanqueActivo.decrement("nivel_actual", {
          by: cantidadReal,
          transaction: t,
        });
      } else if (solicitud.estado === "DESPACHADA") {
        if (excedente > 0) {
          await tanqueActivo.increment("nivel_actual", {
            by: excedente,
            transaction: t,
          });
        }
      }
    }

    // PROCESAR EXCEDENTE (Reintegro de CUPO)
    let updatedCupoId = null;
    if (excedente > 0) {
      const fechaSolicitud = moment(solicitud.fecha_solicitud);
      const periodoSolicitud = fechaSolicitud.format("YYYY-MM");

      const cupoBase = await CupoBase.findOne({
        where: {
          id_subdependencia: solicitud.id_subdependencia,
          id_tipo_combustible: solicitud.id_tipo_combustible,
        },
        transaction: t,
      });

      if (cupoBase) {
        const cupoActual = await CupoActual.findOne({
          where: {
            id_cupo_base: cupoBase.id_cupo_base,
            periodo: periodoSolicitud,
          },
          transaction: t,
        });

        if (cupoActual) {
          await cupoActual.decrement("cantidad_consumida", {
            by: excedente,
            transaction: t,
          });
          await cupoActual.increment("cantidad_disponible", {
            by: excedente,
            transaction: t,
          });

          if (cupoActual.estado === "AGOTADO") {
            await cupoActual.update({ estado: "ACTIVO" }, { transaction: t });
          }
          mensajeExcedente = `Se reintegraron ${excedente} Lts al cupo de ${periodoSolicitud} y al llenadero.`;
          updatedCupoId = cupoActual.id_cupo_actual;
        } else {
          mensajeExcedente = `Se reintegraron ${excedente} Lts al llenadero. Cupo del periodo ${periodoSolicitud} no encontrado/cerrado.`;
        }
      }
    }

    // FINALIZAR TICKET
    await solicitud.update(
      {
        estado: "FINALIZADA",
        fecha_validacion: new Date(),
        id_validador: id_validador,
        observaciones_validacion: observaciones,
        cantidad_despachada: cantidadReal,
      },
      { transaction: t },
    );

    // Registrar MovimientoInventario al momento de FINALIZAR
    // Se reutiliza tanqueActivo ya buscado arriba en la misma transacción.
    if (tanqueActivo) {
      const volumen_despues_final = parseFloat(tanqueActivo.nivel_actual);
      const volumen_antes_final = parseFloat(
        (volumen_despues_final + cantidadReal).toFixed(2)
      );

      await MovimientoInventario.create(
        {
          id_tanque: tanqueActivo.id_tanque,
          id_cierre_turno: null,   // null = pendiente de asignar al próximo lote
          tipo_movimiento: "DESPACHO",
          id_referencia: solicitud.id_solicitud,
          tabla_referencia: "solicitudes",
          volumen_antes: volumen_antes_final,
          volumen_despues: volumen_despues_final,
          variacion: parseFloat((-cantidadReal).toFixed(2)),
          fecha_movimiento: new Date(),
          id_usuario: id_validador,
          observaciones: `Finalización ticket ${solicitud.codigo_ticket}`,
        },
        { transaction: t }
      );
    }

    return {
      msg: "Ticket finalizado correctamente.",
      detalle: mensajeExcedente || "Sin diferencias (Carga completa).",
      ticket: solicitud,
      updatedCupoId,
    };
  });
};

/**
 * Finalizar Ticket Vencido (Extemporáneo por Admin ROOT)
 */
exports.finalizarTicketVencido = async (data, user, clientIp) => {
  const { id_solicitud, cantidad_real_cargada, observaciones } = data;
  const id_validador = user.id_usuario;

  if (user.nombre !== 'root' && user.cedula !== 'root') {
    throw new Error("Solo el usuario root puede realizar esta operación extemporánea.");
  }

  if (!id_solicitud) throw new Error("ID de solicitud requerido");
  if (!cantidad_real_cargada || parseFloat(cantidad_real_cargada) <= 0) {
    throw new Error("Cantidad real cargada inválida");
  }

  return await executeTransaction(clientIp, async (t) => {
    const solicitud = await Solicitud.findByPk(id_solicitud, {
      transaction: t,
      lock: true
    });

    if (!solicitud) {
      throw new Error(`Ticket no encontrado (ID: ${id_solicitud})`);
    }

    if (solicitud.estado !== "VENCIDA") {
      throw new Error(
        `El ticket debe estar VENCIDA para aplicar esta operación (Estado actual: ${solicitud.estado})`
      );
    }

    if (!solicitud.fecha_impresion) {
      throw new Error("El ticket nunca fue impreso. No se puede forzar el despacho físico.");
    }

    const cantidadReal = parseFloat(cantidad_real_cargada);
    const cantidadAprobada = parseFloat(solicitud.cantidad_litros);

    if (cantidadReal > cantidadAprobada) {
      throw new Error("La cantidad real no puede ser mayor a la aprobada inicialmente.");
    }

    // 1. RE-DESCONTAR CUPO
    let updatedCupoId = null;
    const fechaSolicitud = moment(solicitud.fecha_solicitud);
    const periodoSolicitud = fechaSolicitud.format("YYYY-MM");

    const cupoBase = await CupoBase.findOne({
      where: {
        id_subdependencia: solicitud.id_subdependencia,
        id_tipo_combustible: solicitud.id_tipo_combustible,
      },
      transaction: t,
    });

    if (cupoBase) {
      const cupoActual = await CupoActual.findOne({
        where: {
          id_cupo_base: cupoBase.id_cupo_base,
          periodo: periodoSolicitud,
        },
        transaction: t,
        lock: true
      });

      if (cupoActual) {
        await cupoActual.decrement("cantidad_disponible", {
          by: cantidadReal,
          transaction: t,
        });
        await cupoActual.increment("cantidad_consumida", {
          by: cantidadReal,
          transaction: t,
        });

        // Actualizar estado si quedó negativo (se permite sobregiro en estos casos)
        // o si llegó exactamente a cero.
        const saldo_final = parseFloat(cupoActual.cantidad_disponible) - cantidadReal;
        if (saldo_final <= 0 && cupoActual.estado !== "AGOTADO") {
          await cupoActual.update({ estado: "AGOTADO" }, { transaction: t });
        }

        updatedCupoId = cupoActual.id_cupo_actual;
      } else {
        throw new Error(`No se encontró el cupo para el periodo original ${periodoSolicitud}. No se puede re-descontar.`);
      }
    }

    // 2. DESCONTAR INVENTARIO
    const tanqueActivo = await Tanque.findOne({
      where: {
        id_llenadero: solicitud.id_llenadero,
        id_tipo_combustible: solicitud.id_tipo_combustible,
        estado: 'ACTIVO',
        activo_para_despacho: true
      },
      transaction: t,
      lock: true
    });

    if (!tanqueActivo) {
      throw new Error("No se encontró un tanque activo configurado para este llenadero y combustible.");
    }

    // Verificar si el turno ya fue cerrado desde que se imprimió el ticket
    const shiftClosed = await CierreTurno.findOne({
      where: {
        id_llenadero: solicitud.id_llenadero,
        estado: "CERRADO",
        fecha_registro: { [Op.gt]: solicitud.fecha_impresion }
      },
      transaction: t
    });

    const volumen_antes_final = parseFloat(tanqueActivo.nivel_actual);
    const volumen_despues_final = volumen_antes_final - cantidadReal;

    if (!shiftClosed) {
      // 2A. Turno abierto: Descontamos físicamente del nivel_actual del tanque
      await tanqueActivo.decrement("nivel_actual", {
        by: cantidadReal,
        transaction: t,
      });

      await MovimientoInventario.create(
        {
          id_tanque: tanqueActivo.id_tanque,
          id_cierre_turno: null,
          tipo_movimiento: "DESPACHO",
          id_referencia: solicitud.id_solicitud,
          tabla_referencia: "solicitudes",
          volumen_antes: volumen_antes_final,
          volumen_despues: volumen_despues_final,
          variacion: parseFloat((-cantidadReal).toFixed(2)),
          fecha_movimiento: solicitud.fecha_impresion,
          id_usuario: id_validador,
          observaciones: `Finalización EXTEMPORÁNEA ticket ${solicitud.codigo_ticket}. Justificación: ${observaciones}`,
        },
        { transaction: t }
      );
    } else {
      // 2B. Turno cerrado: El combustible ya fue descontado físicamente en la vara (como "faltante").
      // Para evitar doble descuento lógico en el nivel del tanque:
      // - Registramos el DESPACHO (para que sume en los reportes de ayer).
      // - Registramos una ANULACIÓN compensatoria (para retornar el nivel del tanque al valor actual y evitar doble resta).
      
      // Movimiento 1: Despacho retrospectivo
      await MovimientoInventario.create(
        {
          id_tanque: tanqueActivo.id_tanque,
          id_cierre_turno: null,
          tipo_movimiento: "DESPACHO",
          id_referencia: solicitud.id_solicitud,
          tabla_referencia: "solicitudes",
          volumen_antes: volumen_antes_final,
          volumen_despues: volumen_despues_final,
          variacion: parseFloat((-cantidadReal).toFixed(2)),
          fecha_movimiento: solicitud.fecha_impresion,
          id_usuario: id_validador,
          observaciones: `Finalización EXTEMPORÁNEA ticket ${solicitud.codigo_ticket} (Turno Cerrado). Justificación: ${observaciones}`,
        },
        { transaction: t }
      );

      // Movimiento 2: Compensación (Evita doble descuento)
      await MovimientoInventario.create(
        {
          id_tanque: tanqueActivo.id_tanque,
          id_cierre_turno: null,
          tipo_movimiento: "ANULACION",
          id_referencia: solicitud.id_solicitud,
          tabla_referencia: "solicitudes",
          volumen_antes: volumen_despues_final,
          volumen_despues: volumen_antes_final,
          variacion: parseFloat(cantidadReal.toFixed(2)),
          fecha_movimiento: solicitud.fecha_impresion,
          id_usuario: id_validador,
          observaciones: `Compensación lógica: Evita doble descuento del ticket ${solicitud.codigo_ticket} ya absorbido como faltante en medición de cierre previo.`,
        },
        { transaction: t }
      );
    }

    // 3. FINALIZAR TICKET
    await solicitud.update(
      {
        estado: "FINALIZADA",
        fecha_validacion: solicitud.fecha_impresion, // Retroactivo a cuando se imprimió físicamente
        id_validador: id_validador,
        observaciones_validacion: `Finalizado administrativamente tras vencimiento. ${observaciones || ''}`,
        cantidad_despachada: cantidadReal,
      },
      { transaction: t }
    );

    return {
      msg: "Ticket finalizado extemporáneamente de forma exitosa. Cupo e inventario actualizados.",
      ticket: solicitud,
      updatedCupoId,
    };
  });
};

