const cron = require("node-cron");
const {
  Solicitud,
  CupoActual,
  CupoBase,
  HistorialCupoMensual,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const moment = require("moment");

/**
 * Función reutilizable para cerrar/vencer solicitudes expiradas.
 * @param {Object} io - Instancia de Socket.io
 * @param {Date} fechaCorte - Fecha límite para considerar una solicitud como vencida.
 * @param {string} tipoEjecucion - Etiqueta para logs ("CRON" o "INICIO").
 */
const procesarCierreSolicitudes = async (
  io,
  fechaCorte,
  tipoEjecucion = "CRON",
) => {
  console.log(`=== INICIANDO PROCESO DE VENCIMIENTO (${tipoEjecucion}) ===`);
  console.log(
    `Fecha Corte: ${moment(fechaCorte).format("YYYY-MM-DD HH:mm:ss")}`,
  );

  const t = await sequelize.transaction();
  try {
    // 1. Buscar solicitudes activas que no fueron despachadas hasta la fecha de corte
    // Estados: PENDIENTE, APROBADA, IMPRESA
    const solicitudesVencidas = await Solicitud.findAll({
      where: {
        estado: { [Op.in]: ["PENDIENTE", "APROBADA", "IMPRESA"] },
        fecha_solicitud: { [Op.lte]: fechaCorte }, // Menor o igual a la fecha de corte
      },
      transaction: t,
    });

    console.log(
      `Encontradas ${solicitudesVencidas.length} solicitudes para vencer.`,
    );

    for (const sol of solicitudesVencidas) {
      console.log(
        `Venciendo solicitud ID: ${sol.id_solicitud}, Placa: ${sol.placa}, Fecha: ${moment(sol.fecha_solicitud).format("YYYY-MM-DD HH:mm:ss")}`,
      );

      // 2. Reintegrar Cupo (RF-14)
      // Buscamos el cupo del periodo en que se creó la solicitud
      const periodoSolicitud = moment(sol.fecha_solicitud).format("YYYY-MM");
      const cupo = await CupoActual.findOne({
        where: {
          periodo: periodoSolicitud,
          estado: { [Op.ne]: "CERRADO" }, // No reintegrar a cupos ya cerrados legalmente
        },
        include: [
          {
            model: CupoBase,
            as: "CupoBase",
            where: {
              id_subdependencia: sol.id_subdependencia,
              id_tipo_combustible: sol.id_tipo_combustible,
            },
          },
        ],
        transaction: t,
      });

      if (cupo) {
        console.log(
          `Reintegrando ${sol.cantidad_litros} litros al cupo ID: ${cupo.id_cupo_actual} del periodo ${periodoSolicitud}`,
        );
        // Devolvemos los litros a 'cantidad_disponible'
        await cupo.increment("cantidad_disponible", {
          by: sol.cantidad_litros,
          transaction: t,
        });
        // Restamos de 'cantidad_consumida'
        await cupo.decrement("cantidad_consumida", {
          by: sol.cantidad_litros,
          transaction: t,
        });
      } else {
        console.log(
          `⚠️ No se encontró cupo ABIERTO para el periodo ${periodoSolicitud} - Solicitud ID: ${sol.id_solicitud}`,
        );
      }

      // 3. Marcar como Vencida
      // Esto libera la placa automáticamente (RF-05 ya no la verá como activa)
      await sol.update({ estado: "VENCIDA" }, { transaction: t });
    }

    await t.commit();
    console.log(`=== PROCESO DE VENCIMIENTO (${tipoEjecucion}) COMPLETADO ===`);
    console.log(`Total de solicitudes vencidas: ${solicitudesVencidas.length}`);

    if (io && solicitudesVencidas.length > 0) {
      io.emit("cierre:diario", {
        msg: `Cierre (${tipoEjecucion}) ejecutado`,
        cantidad: solicitudesVencidas.length,
      });
    }
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error(`ERROR EN PROCESO DE VENCIMIENTO (${tipoEjecucion}):`, error);
  }
};

const initCronJobs = async (io) => {
  // RF-07: Cierre Diario a las 11:59 PM (23:59)
  // Se ejecuta todos los días a las 23:59
  // Configuración de timezone para Venezuela (UTC-4)
  cron.schedule(
    "59 23 * * *",
    async () => {
      // Cron Job: Vence todo lo de HOY hacia atrás.
      const finDiaActual = moment().endOf("day").toDate();
      await procesarCierreSolicitudes(io, finDiaActual, "CRON-DIARIO");
    },
    {
      timezone: "America/Caracas", // Zona horaria de Venezuela (UTC-4)
    },
  );

  // ============================================================
  // CRON JOB 2: REINICIO MENSUAL DE CUPOS
  // ============================================================
  // Se ejecuta el día 1 de cada mes a las 00:05 AM
  cron.schedule(
    "5 0 1 * *",
    async () => {
      console.log("=== INICIANDO REINICIO MENSUAL AUTOMÁTICO (CRON) ===");
      try {
        const cupoController = require("../controllers/despachos/cupoController");
        const resultado = await cupoController.reiniciarCuposMensuales();

        if (resultado.success) {
          if (io)
            io.emit("cupo:reinicio-mensual", {
              msg: "Reinicio mensual completado exitosamente",
            });
        } else {
          throw new Error(resultado.error);
        }
      } catch (error) {
        console.error("ERROR EN REINICIO MENSUAL (CRON):", error);
      }
    },
    {
      timezone: "America/Caracas",
    },
  );

  console.log("✅ Tareas programadas (Cron Jobs) iniciadas.");
  console.log(
    "📅 Cron de cierre diario: Todos los días a las 23:59 (America/Caracas)",
  );
  console.log(
    "📅 Cron de reinicio mensual: Día 1 de cada mes a las 00:05 (America/Caracas)",
  );

  // === RUTINA DE INICIO: RECUPERACIÓN DE VENCIMIENTOS ===
  // Al arrancar, verificamos si quedaron solicitudes pendientes de días ANTERIORES (ayer hacia atrás).
  // No tocamos las de "hoy" porque el día no ha terminado.
  const finDiaAyer = moment().subtract(1, "days").endOf("day").toDate();
  console.log(
    "🔄 Ejecutando rutina de verificación de tickets vencidos (Recuperación)...",
  );
  await procesarCierreSolicitudes(io, finDiaAyer, "INICIO-RECUPERACION");

  // === RUTINA DE INICIO: VERIFICACIÓN DE REINICIO MENSUAL ===
  // Verificamos si el servidor estuvo apagado durante el cambio de mes (o fecha de corte).
  // Si no existen cupos para el mes actual, ejecutamos el reinicio forzado.
  const periodoActual = moment().format("YYYY-MM");
  console.log(
    `🔄 Verificando inicialización de cupos para el periodo ${periodoActual}...`,
  );

  try {
    const cuposExisten = await CupoActual.count({
      where: { periodo: periodoActual },
    });

    if (cuposExisten === 0) {
      console.log(
        `⚠️ ALERTA: No se encontraron cupos para ${periodoActual}. El proceso mensual no se ejecutó.`,
      );
      console.log(`🚀 Ejecutando reinicio mensual de recuperación ahora...`);

      const cupoController = require("../controllers/despachos/cupoController");
      const resultado = await cupoController.reiniciarCuposMensuales();

      if (resultado.success) {
        console.log(
          "✅ Reinicio mensual de recuperación completado con éxito.",
        );
        if (io)
          io.emit("cupo:reinicio-mensual", {
            msg: "Mes inicializado por recuperación automática",
          });
      } else {
        console.error("❌ Error en recuperación mensual:", resultado.error);
      }
    } else {
      console.log(
        `✅ El periodo ${periodoActual} ya está inicializado correctamente.`,
      );
    }
  } catch (error) {
    console.error("❌ Error verificando estado mensual:", error);
  }
};

module.exports = initCronJobs;
