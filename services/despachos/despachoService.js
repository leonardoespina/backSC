const {
  Solicitud,
  Usuario,
  Dependencia,
  Subdependencia,
  TipoCombustible,
  Llenadero,
  PrecioCombustible,
  Moneda,
  Biometria,
  Tanque,
} = require("../../models");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const biometriaService = require("./biometriaService");
const { Op } = require("sequelize");
const moment = require("moment");

/**
 * Listar solicitudes para despacho
 */
exports.listarSolicitudesParaDespacho = async (query) => {
  const { fecha_inicio, fecha_fin, sort, estado } = query;

  const where = {};

  if (estado === "TODAS") {
    where.estado = { [Op.in]: ["APROBADA", "IMPRESA"] };
  } else if (estado) {
    where.estado = estado;
  } else {
    where.estado = "APROBADA";
  }

  if (fecha_inicio && fecha_fin) {
    const startOfDay = moment(fecha_inicio).startOf("day").toDate();
    const endOfDay = moment(fecha_fin).endOf("day").toDate();
    where.fecha_solicitud = { [Op.between]: [startOfDay, endOfDay] };
  } else if (fecha_inicio) {
    const startOfDay = moment(fecha_inicio).startOf("day").toDate();
    const endOfDay = moment(fecha_inicio).endOf("day").toDate();
    where.fecha_solicitud = { [Op.between]: [startOfDay, endOfDay] };
  }

  let order = [["fecha_solicitud", "DESC"]];
  if (sort) {
    const [field, direction] = sort.split(":");
    const validFields = ["fecha_solicitud", "codigo_ticket", "placa"];
    if (validFields.includes(field)) {
      order = [[field, direction === "DESC" ? "DESC" : "ASC"]];
    }
  }

  const searchableFields = ["codigo_ticket", "placa"];

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
    order,
  });
};

/**
 * Validar Firma Biométrica
 */
exports.validarFirma = async (cedula, huella, id_solicitud, validar_pertenencia = false) => {
  if (!cedula || !huella || !id_solicitud) {
    throw new Error("Faltan datos requeridos (cédula, huella, id_solicitud).");
  }

  const solicitud = await Solicitud.findByPk(id_solicitud);
  if (!solicitud) {
    throw new Error("Solicitud no encontrada.");
  }

  // Usamos el servicio de biometría existente
  const matchResult = await biometriaService.verificarIdentidad(cedula, huella);

  if (!matchResult.match) {
    throw new Error(
      "La huella no coincide con la cédula proporcionada o no está registrado.",
    );
  }

  const registro = matchResult.persona;

  const rolesDetectados = [];
  if (registro.rol === "RETIRO" || registro.rol === "AMBOS") {
    rolesDetectados.push("SOLICITANTE");
  }
  if (registro.rol === "ALMACEN" || registro.rol === "AMBOS") {
    rolesDetectados.push("ALMACENISTA");
  }

  if (rolesDetectados.length === 0) {
    throw new Error(
      "El registro biométrico no tiene roles asignados para esta operación.",
    );
  }

  // Validar Pertenencia estricta (dependencia + subdependencia) — solo para el Solicitante
  if (validar_pertenencia && (registro.rol === "RETIRO" || registro.rol === "AMBOS")) {
    if (registro.id_dependencia !== solicitud.id_dependencia) {
      throw new Error(
        "El receptor no pertenece a la dependencia de la solicitud.",
      );
    }
    if (registro.id_subdependencia !== solicitud.id_subdependencia) {
      throw new Error(
        "El receptor no pertenece a la subdependencia de la solicitud.",
      );
    }
  }

  return {
    valid: true,
    usuario: {
      id_usuario: registro.id_biometria,
      nombre: registro.nombre,
      cedula: registro.cedula,
      rol_biometrico: registro.rol,
    },
    roles: rolesDetectados,
    id_biometria: registro.id_biometria,
  };
};

/**
 * Imprimir Ticket
 */
exports.imprimirTicket = async (data, user, clientIp) => {
  const { id_solicitud, huella_almacenista, huella_receptor, cedula_receptor } =
    data;

  if (!huella_almacenista || !huella_receptor || !cedula_receptor) {
    throw new Error("Faltan datos (huellas y cédula del receptor).");
  }

  return await executeTransaction(clientIp, async (t) => {
    const solicitud = await Solicitud.findByPk(id_solicitud, {
      include: [{ model: Dependencia, as: "Dependencia" }],
      transaction: t,
    });

    if (!solicitud) {
      throw new Error("Solicitud no encontrada");
    }

    if (solicitud.estado !== "APROBADA") {
      throw new Error("La solicitud debe estar Aprobada para imprimirse.");
    }

    // Validar Almacenista (Usuario en Sesión)
    const almacenistaSesion = await Usuario.findByPk(user.id_usuario, {
      transaction: t,
    });
    if (!almacenistaSesion) {
      throw new Error("Sesión de Almacenista no válida.");
    }

    // Verificar huella del almacenista contra su cédula de usuario
    const matchAlmacenista = await biometriaService.verificarIdentidad(
      almacenistaSesion.cedula,
      huella_almacenista,
    );

    if (!matchAlmacenista.match) {
      throw new Error("Almacenista No coincide con la Sesion");
    }

    if (
      matchAlmacenista.persona.rol !== "ALMACEN" &&
      matchAlmacenista.persona.rol !== "AMBOS"
    ) {
      throw new Error(
        "La huella capturada no tiene rol de Almacenista autorizado.",
      );
    }

    // Validar Receptor
    const matchReceptor = await biometriaService.verificarIdentidad(
      cedula_receptor,
      huella_receptor,
    );

    if (!matchReceptor.match) {
      throw new Error(
        "Huella del Receptor no coincide con la cédula proporcionada.",
      );
    }

    if (
      matchReceptor.persona.rol !== "RETIRO" &&
      matchReceptor.persona.rol !== "AMBOS"
    ) {
      throw new Error(
        "El receptor no tiene rol de Retiro (Solicitante) autorizado.",
      );
    }

    // Generar Ticket
    const prefijo = solicitud.tipo_suministro === "BIDON" ? "B" : "R";
    const codDep = (solicitud.Dependencia?.codigo || "000").padStart(3, "0");
    const correlativo = id_solicitud.toString().padStart(6, "0");
    const codigo_ticket = `${prefijo}${codDep}${correlativo}`;

    await solicitud.update(
      {
        estado: "IMPRESA",
        codigo_ticket,
        fecha_impresion: new Date(),
        numero_impresiones: 1,
        id_almacenista: user.id_usuario,
        id_receptor: matchReceptor.persona.id_biometria,
      },
      { transaction: t },
    );

    // Recuperar objeto completo para respuesta
    const solicitudFull = await Solicitud.findByPk(id_solicitud, {
      include: [
        { model: Dependencia, as: "Dependencia" },
        { model: Subdependencia, as: "Subdependencia" },
        {
          model: Usuario,
          as: "Solicitante",
          attributes: ["nombre", "apellido"],
        },
        { model: Usuario, as: "Aprobador", attributes: ["nombre", "apellido"] },
        { model: TipoCombustible, attributes: ["nombre"], where: { activo: true }, required: false },
        { model: Llenadero, attributes: ["nombre_llenadero"] },
        {
          model: PrecioCombustible,
          include: [{ model: Moneda, as: "Moneda" }],
        },
      ],
      transaction: t,
    });

    return {
      msg: "Ticket generado correctamente",
      ticket: {
        codigo: codigo_ticket,
        solicitud: solicitudFull,
        receptor: matchReceptor.persona,
        almacenista: {
          nombre: `${almacenistaSesion.nombre} ${almacenistaSesion.apellido}`,
        },
      },
    };
  });
};

/**
 * Reimprimir Ticket
 */
exports.reimprimirTicket = async (id_solicitud) => {
  const solicitudFull = await Solicitud.findByPk(id_solicitud, {
    include: [
      { model: Dependencia, as: "Dependencia" },
      { model: Subdependencia, as: "Subdependencia" },
      { model: Usuario, as: "Solicitante", attributes: ["nombre", "apellido"] },
      { model: Usuario, as: "Aprobador", attributes: ["nombre", "apellido"] },
      {
        model: Usuario,
        as: "Almacenista",
        attributes: ["nombre", "apellido"],
      },
      { model: Biometria, as: "Receptor" },
      { model: TipoCombustible, attributes: ["nombre"], where: { activo: true }, required: false },
      { model: Llenadero, attributes: ["nombre_llenadero"] },
      {
        model: PrecioCombustible,
        include: [{ model: Moneda, as: "Moneda" }],
      },
    ],
  });

  if (
    !solicitudFull ||
    !["IMPRESA", "DESPACHADA", "FINALIZADA"].includes(solicitudFull.estado)
  ) {
    throw new Error(
      "Solo se pueden reimprimir tickets Impresos, Despachados o Finalizados.",
    );
  }

  await solicitudFull.increment("numero_impresiones");

  return {
    msg: "Copia generada",
    es_copia: true,
    ticket: {
      codigo: solicitudFull.codigo_ticket,
      solicitud: solicitudFull,
      receptor: solicitudFull.Receptor,
      almacenista: {
        nombre: solicitudFull.Almacenista
          ? `${solicitudFull.Almacenista.nombre} ${solicitudFull.Almacenista.apellido}`
          : "S/I",
      },
    },
  };
};

/**
 * Despachar Solicitud
 */
exports.despacharSolicitud = async (data, clientIp) => {
  const { codigo_ticket, cantidad_despachada_real } = data;

  if (!codigo_ticket) throw new Error("Código de ticket requerido");

  return await executeTransaction(clientIp, async (t) => {
    const solicitud = await Solicitud.findOne({
      where: { codigo_ticket },
      include: [{ model: Llenadero }],
      transaction: t,
    });

    if (!solicitud) {
      throw new Error("Ticket no encontrado");
    }

    if (solicitud.estado !== "IMPRESA") {
      throw new Error(
        `El ticket está en estado ${solicitud.estado} y no puede ser despachado.`,
      );
    }

    const tanqueActivo = await Tanque.findOne({
      where: {
        id_llenadero: solicitud.id_llenadero,
        id_tipo_combustible: solicitud.id_tipo_combustible,
        estado: 'ACTIVO',
        activo_para_despacho: true
      },
      transaction: t,
      lock: true,
    });

    const cantidadFinal = cantidad_despachada_real
      ? parseFloat(cantidad_despachada_real)
      : parseFloat(solicitud.cantidad_litros);

    if (cantidadFinal > parseFloat(solicitud.cantidad_litros)) {
      throw new Error("No se puede despachar más de lo aprobado.");
    }

    if (!tanqueActivo) {
      throw new Error("No hay un tanque activo para despacho configurado de este combustible en el Llenadero.");
    }

    if (parseFloat(tanqueActivo.nivel_actual) < cantidadFinal) {
      throw new Error("Stock insuficiente en el Tanque activo del Llenadero.");
    }

    await tanqueActivo.decrement("nivel_actual", {
      by: cantidadFinal,
      transaction: t,
    });

    await solicitud.update(
      {
        estado: "DESPACHADA",
        fecha_despacho: new Date(),
        cantidad_despachada: cantidadFinal,
      },
      { transaction: t },
    );

    return {
      msg: "Despacho registrado exitosamente. Inventario actualizado.",
      solicitud,
    };
  });
};
