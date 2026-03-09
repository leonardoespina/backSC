/**
 * Script de prueba para ejecutar manualmente el cierre diario
 * Uso: node scripts/test_cierre_diario.js
 */

const { Solicitud, CupoActual, CupoBase, sequelize } = require("../models");
const { Op } = require("sequelize");
const moment = require("moment");

async function testCierreDiario() {
    console.log("=== PRUEBA DE CIERRE DIARIO ===");
    console.log(`Fecha/Hora actual: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);

    try {
        // Calcular el inicio del día actual (00:00:00)
        const inicioDiaActual = moment().startOf('day').toDate();

        console.log(`\nBuscando solicitudes creadas ANTES de: ${moment(inicioDiaActual).format("YYYY-MM-DD HH:mm:ss")}`);

        // 1. Primero, mostrar TODAS las solicitudes activas (para comparar)
        const todasActivas = await Solicitud.findAll({
            where: {
                estado: { [Op.in]: ["PENDIENTE", "APROBADA", "IMPRESA"] }
            },
            attributes: ['id_solicitud', 'placa', 'estado', 'fecha_solicitud', 'cantidad_litros'],
            order: [['fecha_solicitud', 'DESC']]
        });

        console.log(`\n📊 Total de solicitudes activas (sin filtro de fecha): ${todasActivas.length}`);
        todasActivas.forEach(sol => {
            const fecha = moment(sol.fecha_solicitud).format("YYYY-MM-DD HH:mm:ss");
            const esDiaAnterior = moment(sol.fecha_solicitud).isBefore(inicioDiaActual);
            console.log(`  - ID: ${sol.id_solicitud}, Placa: ${sol.placa}, Estado: ${sol.estado}, Fecha: ${fecha} ${esDiaAnterior ? '✅ (VENCER)' : '❌ (HOY - NO VENCER)'}`);
        });

        // 2. Buscar solicitudes que SÍ deben vencerse (del día anterior o anteriores)
        const solicitudesVencidas = await Solicitud.findAll({
            where: {
                estado: { [Op.in]: ["PENDIENTE", "APROBADA", "IMPRESA"] },
                fecha_solicitud: { [Op.lt]: inicioDiaActual }
            },
            attributes: ['id_solicitud', 'placa', 'estado', 'fecha_solicitud', 'cantidad_litros', 'id_subdependencia', 'id_tipo_combustible']
        });

        console.log(`\n✅ Solicitudes que DEBEN vencerse (del día anterior): ${solicitudesVencidas.length}`);

        if (solicitudesVencidas.length === 0) {
            console.log("\n✨ No hay solicitudes para vencer. Todo está al día.");
            await sequelize.close();
            return;
        }

        // Mostrar detalles
        solicitudesVencidas.forEach(sol => {
            console.log(`\n  📋 Solicitud ID: ${sol.id_solicitud}`);
            console.log(`     Placa: ${sol.placa}`);
            console.log(`     Estado actual: ${sol.estado}`);
            console.log(`     Fecha solicitud: ${moment(sol.fecha_solicitud).format("YYYY-MM-DD HH:mm:ss")}`);
            console.log(`     Cantidad: ${sol.cantidad_litros} litros`);
        });

        // 3. Preguntar confirmación (simulado - en producción sería automático)
        console.log("\n⚠️  ¿Deseas ejecutar el cierre? (Este es un script de prueba)");
        console.log("Para ejecutar realmente, descomenta la sección de transacción abajo.\n");

        // DESCOMENTAR ESTA SECCIÓN PARA EJECUTAR REALMENTE EL CIERRE
        /*
        const t = await sequelize.transaction();
        try {
          for (const sol of solicitudesVencidas) {
            console.log(`\nProcesando solicitud ID: ${sol.id_solicitud}...`);
            
            // Reintegrar Cupo
            const periodoActual = moment().format("YYYY-MM");
            const cupo = await CupoActual.findOne({
              where: { periodo: periodoActual },
              include: [{
                model: CupoBase,
                as: "CupoBase",
                where: {
                  id_subdependencia: sol.id_subdependencia,
                  id_tipo_combustible: sol.id_tipo_combustible
                }
              }],
              transaction: t
            });
    
            if (cupo) {
              console.log(`  ✅ Reintegrando ${sol.cantidad_litros} litros al cupo ID: ${cupo.id_cupo_actual}`);
              await cupo.increment("cantidad_disponible", { by: sol.cantidad_litros, transaction: t });
              await cupo.decrement("cantidad_consumida", { by: sol.cantidad_litros, transaction: t });
            } else {
              console.log(`  ⚠️  No se encontró cupo para reintegrar`);
            }
    
            // Marcar como Vencida
            await sol.update({ estado: "VENCIDA" }, { transaction: t });
            console.log(`  ✅ Solicitud marcada como VENCIDA`);
          }
    
          await t.commit();
          console.log("\n=== CIERRE COMPLETADO EXITOSAMENTE ===");
          console.log(`Total de solicitudes vencidas: ${solicitudesVencidas.length}`);
        } catch (error) {
          await t.rollback();
          console.error("\n❌ ERROR:", error);
        }
        */

        await sequelize.close();
        console.log("\n✅ Conexión cerrada.");

    } catch (error) {
        console.error("\n❌ ERROR CRÍTICO:", error);
        await sequelize.close();
        process.exit(1);
    }
}

// Ejecutar
testCierreDiario();
