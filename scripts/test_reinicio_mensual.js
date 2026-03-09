/**
 * Script de prueba para verificar el reinicio mensual de cupos
 * Uso: node scripts/test_reinicio_mensual.js
 * 
 * Este script muestra qué pasaría si se ejecutara el reinicio mensual AHORA
 */

const { CupoActual, CupoBase, HistorialCupoMensual, sequelize } = require("../models");
const { Op } = require("sequelize");
const moment = require("moment");

async function testReinicioMensual() {
    console.log("=== PRUEBA DE REINICIO MENSUAL DE CUPOS ===");
    console.log(`Fecha/Hora actual: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);

    try {
        const mesAnterior = moment().subtract(1, 'month').format("YYYY-MM");
        const mesNuevo = moment().format("YYYY-MM");

        console.log(`\n📅 Mes anterior: ${mesAnterior}`);
        console.log(`📅 Mes nuevo: ${mesNuevo}`);

        // 1. Mostrar cupos del mes anterior que se cerrarían
        console.log(`\n${"=".repeat(60)}`);
        console.log("1️⃣  CUPOS DEL MES ANTERIOR QUE SE CERRARÍAN");
        console.log("=".repeat(60));

        const cuposAnteriores = await CupoActual.findAll({
            where: { periodo: mesAnterior, estado: { [Op.ne]: "CERRADO" } },
            include: [{
                model: CupoBase,
                as: "CupoBase",
                attributes: ['id_cupo_base', 'cantidad_mensual']
            }]
        });

        if (cuposAnteriores.length === 0) {
            console.log("✨ No hay cupos del mes anterior para cerrar.");
        } else {
            console.log(`\n📊 Total de cupos a cerrar: ${cuposAnteriores.length}\n`);

            cuposAnteriores.forEach(cupo => {
                console.log(`  📋 Cupo ID: ${cupo.id_cupo_actual}`);
                console.log(`     Periodo: ${cupo.periodo}`);
                console.log(`     Estado actual: ${cupo.estado}`);
                console.log(`     Asignado: ${cupo.cantidad_asignada} litros`);
                console.log(`     Consumido: ${cupo.cantidad_consumida} litros`);
                console.log(`     Disponible: ${cupo.cantidad_disponible} litros`);
                console.log(`     Recargado: ${cupo.cantidad_recargada} litros`);
                console.log(`     No utilizado: ${cupo.cantidad_disponible} litros (se perderá)`);
                console.log("");
            });
        }

        // 2. Mostrar cupos base activos que generarían nuevos cupos
        console.log("=".repeat(60));
        console.log("2️⃣  CUPOS BASE ACTIVOS (Generarán nuevos cupos)");
        console.log("=".repeat(60));

        const cuposBaseActivos = await CupoBase.findAll({
            where: { activo: true },
            include: [
                { model: require("../models/Categoria"), as: "Categoria", attributes: ['nombre'] },
                { model: require("../models/Dependencia"), as: "Dependencia", attributes: ['nombre_dependencia'] },
                { model: require("../models/Subdependencia"), as: "Subdependencia", attributes: ['nombre'], required: false },
                { model: require("../models/TipoCombustible"), as: "TipoCombustible", attributes: ['nombre'] }
            ]
        });

        console.log(`\n📊 Total de cupos base activos: ${cuposBaseActivos.length}\n`);

        for (const base of cuposBaseActivos) {
            // Verificar si ya existe
            const existe = await CupoActual.findOne({
                where: { id_cupo_base: base.id_cupo_base, periodo: mesNuevo }
            });

            const status = existe ? "⚠️  YA EXISTE (no se creará)" : "✅ SE CREARÁ";

            console.log(`  📋 Cupo Base ID: ${base.id_cupo_base} ${status}`);
            console.log(`     Categoría: ${base.Categoria?.nombre || 'N/A'}`);
            console.log(`     Dependencia: ${base.Dependencia?.nombre_dependencia || 'N/A'}`);
            console.log(`     Subdependencia: ${base.Subdependencia?.nombre || 'N/A'}`);
            console.log(`     Combustible: ${base.TipoCombustible?.nombre || 'N/A'}`);
            console.log(`     Cantidad mensual: ${base.cantidad_mensual} litros`);
            console.log("");
        }

        // 3. Resumen
        console.log("=".repeat(60));
        console.log("📊 RESUMEN");
        console.log("=".repeat(60));

        const cuposQueSeCrearian = cuposBaseActivos.length - (await CupoActual.count({
            where: { periodo: mesNuevo }
        }));

        console.log(`\n  ✅ Cupos que se cerrarían (${mesAnterior}): ${cuposAnteriores.length}`);
        console.log(`  ✅ Cupos que se crearían (${mesNuevo}): ${cuposQueSeCrearian}`);
        console.log(`  ℹ️  Cupos base activos: ${cuposBaseActivos.length}`);

        // 4. Verificar si ya existen cupos para el mes nuevo
        const cuposNuevosExistentes = await CupoActual.findAll({
            where: { periodo: mesNuevo }
        });

        if (cuposNuevosExistentes.length > 0) {
            console.log(`\n  ⚠️  ADVERTENCIA: Ya existen ${cuposNuevosExistentes.length} cupos para ${mesNuevo}`);
            console.log(`     El reinicio no creará duplicados.`);
        }

        console.log("\n⚠️  Este es un script de PRUEBA - No se ejecutaron cambios en la BD");
        console.log("Para ejecutar realmente el reinicio, usa: node scripts/ejecutar_reinicio_mensual.js\n");

        await sequelize.close();

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        await sequelize.close();
        process.exit(1);
    }
}

// Ejecutar
testReinicioMensual();
