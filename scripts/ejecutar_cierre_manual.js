/**
 * Script para ejecutar MANUALMENTE el cierre diario
 * Uso: node scripts/ejecutar_cierre_manual.js
 * 
 * ⚠️ ADVERTENCIA: Este script ejecutará el cierre diario inmediatamente
 */

const { Solicitud, CupoActual, CupoBase, sequelize } = require("../models");
const { Op } = require("sequelize");
const moment = require("moment");

async function ejecutarCierreManual() {
    console.log("=== EJECUCIÓN MANUAL DE CIERRE DIARIO ===");
    console.log(`Fecha/Hora actual: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);

    const t = await sequelize.transaction();

    try {
        // Calcular el inicio del día actual (00:00:00)
        const inicioDiaActual = moment().startOf('day').toDate();

        console.log(`\nBuscando solicitudes creadas ANTES de: ${moment(inicioDiaActual).format("YYYY-MM-DD HH:mm:ss")}`);

        // Buscar solicitudes activas del día anterior o anteriores
        const solicitudesVencidas = await Solicitud.findAll({
            where: {
                estado: { [Op.in]: ["PENDIENTE", "APROBADA", "IMPRESA"] },
                fecha_solicitud: { [Op.lt]: inicioDiaActual }
            },
            transaction: t
        });

        console.log(`\n✅ Encontradas ${solicitudesVencidas.length} solicitudes para vencer.\n`);

        if (solicitudesVencidas.length === 0) {
            await t.commit();
            console.log("✨ No hay solicitudes para vencer. Todo está al día.");
            await sequelize.close();
            return;
        }

        for (const sol of solicitudesVencidas) {
            console.log(`📋 Venciendo solicitud ID: ${sol.id_solicitud}, Placa: ${sol.placa}, Fecha: ${moment(sol.fecha_solicitud).format("YYYY-MM-DD HH:mm:ss")}`);

            // Reintegrar Cupo (RF-14)
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
                console.log(`   💰 Reintegrando ${sol.cantidad_litros} litros al cupo ID: ${cupo.id_cupo_actual}`);
                console.log(`      Disponible antes: ${cupo.cantidad_disponible} litros`);

                // Devolver los litros
                await cupo.increment("cantidad_disponible", { by: sol.cantidad_litros, transaction: t });
                await cupo.decrement("cantidad_consumida", { by: sol.cantidad_litros, transaction: t });

                // Recargar para mostrar el nuevo valor
                await cupo.reload({ transaction: t });
                console.log(`      Disponible después: ${cupo.cantidad_disponible} litros`);
            } else {
                console.log(`   ⚠️  No se encontró cupo para reintegrar - Solicitud ID: ${sol.id_solicitud}`);
            }

            // Marcar como Vencida
            await sol.update({ estado: "VENCIDA" }, { transaction: t });
            console.log(`   ✅ Estado cambiado a: VENCIDA\n`);
        }

        await t.commit();

        console.log("=== CIERRE DIARIO COMPLETADO EXITOSAMENTE ===");
        console.log(`✅ Total de solicitudes vencidas: ${solicitudesVencidas.length}`);
        console.log(`✅ Cupos reintegrados correctamente`);

        await sequelize.close();
        console.log("\n✅ Conexión cerrada.");

    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error("\n❌ ERROR EN CIERRE DIARIO:", error);
        await sequelize.close();
        process.exit(1);
    }
}

// Ejecutar
ejecutarCierreManual();
