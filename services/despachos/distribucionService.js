const {
  Solicitud,
  SolicitudDistribucion,
  Vehiculo,
  Marca,
  Modelo,
  Usuario,
  Dependencia,
  Subdependencia,
} = require("../../models");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Obtener el balance y detalle de distribuciones de una solicitud nodriza
 */
exports.obtenerDistribucionPorSolicitud = async (id_solicitud, user) => {
  const solicitud = await Solicitud.findByPk(id_solicitud, {
    include: [
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["id_dependencia", "nombre_dependencia", "codigo"],
      },
      {
        model: Subdependencia,
        as: "Subdependencia",
        attributes: ["id_subdependencia", "nombre"],
      },
      {
        model: Usuario,
        as: "Solicitante",
        attributes: ["id_usuario", "nombre", "apellido"],
      },
      {
        model: SolicitudDistribucion,
        as: "Distribuciones",
        include: [
          {
            model: Vehiculo,
            as: "Vehiculo",
            include: [
              { model: Marca, as: "Marca", attributes: ["nombre"] },
              { model: Modelo, as: "Modelo", attributes: ["nombre"] },
            ],
          },
          {
            model: Usuario,
            as: "Registrador",
            attributes: ["id_usuario", "nombre", "apellido"],
          },
        ],
      },
    ],
    order: [
      [{ model: SolicitudDistribucion, as: "Distribuciones" }, "fecha_distribucion", "ASC"],
      [{ model: SolicitudDistribucion, as: "Distribuciones" }, "id_distribucion", "ASC"],
    ],
  });

  if (!solicitud) {
    throw new Error("Solicitud no encontrada.");
  }

  // Validación de acceso por dependencia (salvo ADMIN e INSPECTOR)
  if (
    user.tipo_usuario !== "ADMIN" &&
    user.tipo_usuario !== "INSPECTOR" &&
    solicitud.id_dependencia !== user.id_dependencia
  ) {
    throw new Error("No tienes permiso para ver la distribución de esta solicitud.");
  }

  const litros_despachados = parseFloat(solicitud.cantidad_despachada || solicitud.cantidad_litros || 0);
  const total_distribuido = (solicitud.Distribuciones || []).reduce(
    (acc, curr) => acc + parseFloat(curr.cantidad_litros || 0),
    0
  );
  const litros_pendientes = Math.max(0, parseFloat((litros_despachados - total_distribuido).toFixed(2)));
  const porcentaje_distribuido =
    litros_despachados > 0
      ? parseFloat(((total_distribuido / litros_despachados) * 100).toFixed(2))
      : 0;

  let estado_rendicion = "PENDIENTE";
  if (total_distribuido >= litros_despachados && litros_despachados > 0) {
    estado_rendicion = "COMPLETO";
  } else if (total_distribuido > 0) {
    estado_rendicion = "EN_REPARTO";
  }

  return {
    solicitud: {
      id_solicitud: solicitud.id_solicitud,
      codigo_ticket: solicitud.codigo_ticket,
      tipo_suministro: solicitud.tipo_suministro,
      es_nodriza: solicitud.es_nodriza,
      estado: solicitud.estado,
      cantidad_litros: parseFloat(solicitud.cantidad_litros || 0),
      cantidad_despachada: parseFloat(solicitud.cantidad_despachada || 0),
      fecha_solicitud: solicitud.fecha_solicitud,
      fecha_despacho: solicitud.fecha_despacho,
      Dependencia: solicitud.Dependencia,
      Subdependencia: solicitud.Subdependencia,
      Solicitante: solicitud.Solicitante,
    },
    resumen: {
      litros_despachados,
      total_distribuido: parseFloat(total_distribuido.toFixed(2)),
      litros_pendientes,
      porcentaje_distribuido,
      estado_rendicion,
    },
    distribuciones: (solicitud.Distribuciones || []).map((d) => ({
      id_distribucion: d.id_distribucion,
      id_solicitud: d.id_solicitud,
      id_vehiculo: d.id_vehiculo,
      cantidad_litros: parseFloat(d.cantidad_litros),
      fecha_distribucion: d.fecha_distribucion,
      observaciones: d.observaciones,
      Vehiculo: d.Vehiculo
        ? {
            id_vehiculo: d.Vehiculo.id_vehiculo,
            placa: d.Vehiculo.placa,
            es_generador: d.Vehiculo.es_generador,
            es_planta: d.Vehiculo.es_planta,
            marca: d.Vehiculo.Marca?.nombre || "",
            modelo: d.Vehiculo.Modelo?.nombre || "",
          }
        : null,
      Registrador: d.Registrador
        ? {
            id_usuario: d.Registrador.id_usuario,
            nombre: `${d.Registrador.nombre} ${d.Registrador.apellido}`.trim(),
          }
        : null,
    })),
  };
};

/**
 * Obtener vehículos activos candidatos para distribuir (filtrados por la gerencia de la solicitud)
 */
exports.obtenerVehiculosParaDistribucion = async (id_solicitud, user) => {
  const solicitud = await Solicitud.findByPk(id_solicitud);
  if (!solicitud) {
    throw new Error("Solicitud no encontrada.");
  }

  const whereVehiculo = {
    estado: "ACTIVO",
    id_tipo_combustible: solicitud.id_tipo_combustible,
  };

  // Filtrar vehículos de la misma subdependencia (o dependencia como fallback)
  if (solicitud.id_subdependencia) {
    whereVehiculo.id_subdependencia = solicitud.id_subdependencia;
  } else if (solicitud.id_dependencia) {
    whereVehiculo.id_dependencia = solicitud.id_dependencia;
  }

  const vehiculos = await Vehiculo.findAll({
    where: whereVehiculo,
    include: [
      { model: Marca, as: "Marca", attributes: ["nombre"] },
      { model: Modelo, as: "Modelo", attributes: ["nombre"] },
      { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
    ],
    order: [["placa", "ASC"]],
  });

  return vehiculos.map((v) => ({
    id_vehiculo: v.id_vehiculo,
    placa: v.placa,
    es_generador: v.es_generador,
    es_planta: v.es_planta,
    marca: v.Marca?.nombre || "",
    modelo: v.Modelo?.nombre || "",
    subdependencia: v.Subdependencia?.nombre || "",
    etiqueta: `${v.placa} - ${v.Marca?.nombre || ""} ${v.Modelo?.nombre || ""} ${
      v.es_generador ? "(GENERADOR)" : v.es_planta ? "(PLANTA)" : ""
    }`.trim(),
  }));
};

/**
 * Registrar una o más entregas de combustible para una solicitud nodriza
 * Control de concurrencia ACID con SELECT ... FOR UPDATE (lock: true)
 */
exports.registrarDistribucion = async (id_solicitud, items, user, clientIp) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Debe proporcionar al menos un equipo y cantidad de litros para distribuir.");
  }

  return await executeTransaction(clientIp, async (t) => {
    // 1. Bloqueo pesimista del ticket matriz
    const solicitud = await Solicitud.findByPk(id_solicitud, {
      transaction: t,
      lock: true,
    });

    if (!solicitud) {
      throw new Error("Solicitud matriz no encontrada.");
    }

    if (!solicitud.es_nodriza) {
      throw new Error("Esta solicitud no está categorizada como Despacho Maestro.");
    }

    if (solicitud.estado !== "FINALIZADA") {
      throw new Error(
        `Solo se puede rendir distribución de tickets despachados en estado FINALIZADA. Estado actual: ${solicitud.estado}`
      );
    }

    // 2. Calcular balance actual de litros
    const distribucionesExistentes = await SolicitudDistribucion.findAll({
      where: { id_solicitud },
      transaction: t,
    });

    const litrosDespachados = parseFloat(solicitud.cantidad_despachada || solicitud.cantidad_litros || 0);
    const yaDistribuido = distribucionesExistentes.reduce(
      (acc, curr) => acc + parseFloat(curr.cantidad_litros || 0),
      0
    );

    // 3. Validar nuevos ítems
    let sumaNuevosLitros = 0;
    const itemsNormalizados = [];

    for (const item of items) {
      const litros = parseFloat(item.cantidad_litros);
      if (isNaN(litros) || litros <= 0) {
        throw new Error("La cantidad de litros asignada a cada equipo debe ser mayor a 0.");
      }
      if (!item.id_vehiculo) {
        throw new Error("Debe seleccionar un equipo/vehículo válido para cada asignación.");
      }

      sumaNuevosLitros += litros;
      itemsNormalizados.push({
        id_solicitud,
        id_vehiculo: parseInt(item.id_vehiculo, 10),
        cantidad_litros: parseFloat(litros.toFixed(2)),
        id_usuario_registro: user.id_usuario,
        fecha_distribucion: item.fecha_distribucion || new Date(),
        observaciones: item.observaciones ? String(item.observaciones).trim() : null,
      });
    }

    const nuevoTotal = parseFloat((yaDistribuido + sumaNuevosLitros).toFixed(2));
    if (nuevoTotal > litrosDespachados) {
      const disponible = Math.max(0, parseFloat((litrosDespachados - yaDistribuido).toFixed(2)));
      throw new Error(
        `La distribución total (${nuevoTotal} L) supera la cantidad despachada (${litrosDespachados} L). Saldo disponible: ${disponible} L.`
      );
    }

    // 4. Validar existencia y estado de los vehículos
    const idsVehiculos = [...new Set(itemsNormalizados.map((i) => i.id_vehiculo))];
    const vehiculosEncontrados = await Vehiculo.findAll({
      where: {
        id_vehiculo: { [Op.in]: idsVehiculos },
        estado: "ACTIVO",
      },
      transaction: t,
    });

    if (vehiculosEncontrados.length !== idsVehiculos.length) {
      throw new Error("Uno o más vehículos seleccionados no existen o se encuentran inactivos.");
    }

    // 5. Inserción en la base de datos
    const creados = await SolicitudDistribucion.bulkCreate(itemsNormalizados, {
      transaction: t,
    });

    return {
      success: true,
      mensaje: `Se registraron ${creados.length} asignaciones exitosamente.`,
      total_distribuido: nuevoTotal,
      saldo_restante: parseFloat((litrosDespachados - nuevoTotal).toFixed(2)),
      registros: creados,
    };
  });
};

/**
 * Eliminar una asignación de distribución (corrección por error humano)
 */
exports.eliminarItemDistribucion = async (id_distribucion, user, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const item = await SolicitudDistribucion.findByPk(id_distribucion, {
      transaction: t,
      lock: true,
    });

    if (!item) {
      throw new Error("Registro de distribución no encontrado.");
    }

    const solicitud = await Solicitud.findByPk(item.id_solicitud, {
      transaction: t,
      lock: true,
    });

    // Permisos: el creador, ADMIN o un usuario de la misma dependencia
    if (
      user.tipo_usuario !== "ADMIN" &&
      item.id_usuario_registro !== user.id_usuario &&
      solicitud.id_dependencia !== user.id_dependencia
    ) {
      throw new Error("No tienes permiso para eliminar esta asignación de distribución.");
    }

    await item.destroy({ transaction: t });

    return {
      success: true,
      mensaje: "Asignación de distribución eliminada correctamente.",
    };
  });
};
