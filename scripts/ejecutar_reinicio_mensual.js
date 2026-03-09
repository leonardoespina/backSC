/**
 * Script para ejecutar MANUALMENTE el reinicio mensual de cupos
 * Uso: node scripts/ejecutar_reinicio_mensual.js
 * 
 * ⚠️ ADVERTENCIA: Este script ejecutará el reinicio mensual inmediatamente
 * - Cerrará cupos del mes anterior
 * - Creará nuevos cupos para el mes actual
 */

const { CupoActual, CupoBase, HistorialCupoMensual, sequelize } = require("../models");
const { Op } = require("sequelize");
const moment = require("moment");

async function ejecutarReinicioMensual() {
    console.log("=== EJECUCIÓN MANUAL DE REINICIO MENSUAL ===");
    console.log(`Fecha/Hora actual: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);

    const t = await sequelize.transaction();

    try {
        const mesAnterior = moment().subtract(1, 'month').format("YYYY-MM");
        const mesNuevo = moment().format("YYYY-MM");
        const fechaInicio = moment().startOf("month").toDate();
        const fechaFin = moment().endOf("month").toDate();

        console.log(`\n📅 Cerrando cupos del mes: ${mesAnterior}`);
        console.log(`📅 Creando cupos para el mes: ${mesNuevo}\n`);

        // 1. Cerrar cupos del mes anterior
        const cuposAnteriores = await CupoActual.findAll({
            where: { periodo: mesAnterior, estado: { [Op.ne]: "CERRADO" } },
            transaction: t
        });

        console.log(`✅ Encontrados ${cuposAnteriores.length} cupos del mes anterior para cerrar.\n`);

        for (const cupo of cuposAnteriores) {
            console.log(`📋 Cerrando cupo ID: ${cupo.id_cupo_actual} (Periodo: ${cupo.periodo})`);
            console.log(`   Asignado: ${cupo.cantidad_asignada} L | Consumido: ${cupo.cantidad_consumida} L | Disponible: ${cupo.cantidad_disponible} L`);

            // Guardar historial
            await HistorialCupoMensual.create({
                id_cupo_base: cupo.id_cupo_base,
                periodo: cupo.periodo,
                cantidad_asignada: cupo.cantidad_asignada,
                cantidad_consumida: cupo.cantidad_consumida,
                cantidad_recargada: cupo.cantidad_recargada,
                cantidad_no_utilizada: cupo.cantidad_disponible,
                fecha_cierre: new Date()
            }, { transaction: t });

            // Cerrar
            await cupo.update({ estado: "CERRADO" }, { transaction: t });
            console.log(`   ✅ Cupo cerrado y guardado en historial\n`);
        }

        // 2. Crear nuevos cupos para el mes actual
        const cuposBaseActivos = await CupoBase.findAll({
            where: { activo: true },
            transaction: t
        });

        console.log(`✅ Encontrados ${cuposBaseActivos.length} cupos base activos.\n`);

        let cuposCreados = 0;
        let cuposOmitidos = 0;

        for (const base of cuposBaseActivos) {
            // Verificar si ya existe
            const existe = await CupoActual.findOne({
                where: { id_cupo_base: base.id_cupo_base, periodo: mesNuevo },
                transaction: t
            });

            if (!existe) {
                await CupoActual.create({
                    id_cupo_base: base.id_cupo_base,
                    periodo: mesNuevo,
                    cantidad_asignada: base.cantidad_mensual,
                    cantidad_disponible: base.cantidad_mensual,
                    cantidad_consumida: 0,
                    cantidad_recargada: 0,
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin,
                    estado: "ACTIVO"
                }, { transaction: t });

                cuposCreados++;
                console.log(`✅ Cupo creado para base ID ${base.id_cupo_base} (${base.cantidad_mensual} litros)`);
            } else {
                cuposOmitidos++;
                console.log(`⚠️  Cupo ya existe para base ID ${base.id_cupo_base} - Saltando`);
            }
        }

        await t.commit();

        console.log("\n" + "=".repeat(60));
        console.log("=== REINICIO MENSUAL COMPLETADO EXITOSAMENTE ===");
        console.log("=".repeat(60));
        console.log(`\n📊 Resumen:`);
        console.log(`   ✅ Cupos cerrados (${mesAnterior}): ${cuposAnteriores.length}`);
        console.log(`   ✅ Cupos creados (${mesNuevo}): ${cuposCreados}`);
        console.log(`   ⚠️  Cupos omitidos (ya existían): ${cuposOmitidos}`);
        console.log(`   📋 Total cupos base activos: ${cuposBaseActivos.length}`);

        await sequelize.close();
        console.log("\n✅ Conexión cerrada.");

    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error("\n❌ ERROR EN REINICIO MENSUAL:", error);
        await sequelize.close();
        process.exit(1);
    }
}

// Ejecutar
ejecutarReinicioMensual();
