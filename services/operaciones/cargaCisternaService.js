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

  return await paginate(CargaCisterna, query, {
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
