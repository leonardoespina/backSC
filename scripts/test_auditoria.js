/**
 * ═══════════════════════════════════════════════════
 *  test_auditoria.js — PRUEBA COMPLETA DE AUDITORÍA
 * ═══════════════════════════════════════════════════
 *
 * Este script:
 *   1. Verifica que los triggers estén instalados
 *   2. Hace una operación de prueba en solicitudes
 *   3. Consulta los registros de auditoría generados
 *   4. Muestra el resultado formateado
 *
 * ⚠️  Requiere que el servidor esté corriendo (npm start)
 *     Y que setup_audit.js ya se haya ejecutado.
 *
 * ═══════════════════════════════════════════════════
 */

const { sequelize } = require("../config/database");

async function testAuditoria() {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  🧪 PRUEBA DEL SISTEMA DE AUDITORÍA');
    console.log('═══════════════════════════════════════════════');
    console.log('');

    try {
        // ============================================================
        // 1. VERIFICAR QUE LOS TRIGGERS ESTÉN INSTALADOS
        // ============================================================
        console.log('📋 1/4 Verificando triggers instalados...');
        const [triggers] = await sequelize.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE 'trg_audit_%'
      ORDER BY event_object_table;
    `);

        if (triggers.length === 0) {
            console.log('   ❌ NO HAY TRIGGERS INSTALADOS.');
            console.log('   📌 Ejecuta primero: node scripts/setup_audit.js');
            return;
        }
        console.log(`   ✅ ${triggers.length} triggers instalados:`);
        triggers.slice(0, 5).forEach((t) => {
            console.log(`      - ${t.trigger_name} → ${t.event_object_table} (${t.event_manipulation})`);
        });
        if (triggers.length > 5) {
            console.log(`      ... y ${triggers.length - 5} más`);
        }

        // ============================================================
        // 2. VERIFICAR REGISTROS EXISTENTES
        // ============================================================
        console.log('');
        console.log('📊 2/4 Consultando registros de auditoría existentes...');
        const [total] = await sequelize.query(`SELECT COUNT(*) as total FROM auditorias;`);
        const count = total[0]?.total || 0;
        console.log(`   📝 Total registros en auditorias: ${count}`);

        // ============================================================
        // 3. HACER UNA OPERACIÓN DE PRUEBA REAL
        // ============================================================
        console.log('');
        console.log('🔧 3/4 Simulando una operación auditada...');

        // Configurar variables de sesión COMO LO HACE transactionHelper
        await sequelize.query(`SET LOCAL app.current_ip = '192.168.1.100';`);
        await sequelize.query(`SET LOCAL app.current_user_id = '1';`);
        await sequelize.query(`SET LOCAL app.current_user_name = 'Admin de Prueba';`);

        // Buscar una solicitud existente para modificarla temporalmente
        const [solicitudesExistentes] = await sequelize.query(`
      SELECT id_solicitud FROM solicitudes LIMIT 1;
    `);

        if (solicitudesExistentes.length > 0) {
            const idSolicitud = solicitudesExistentes[0].id_solicitud;
            console.log(`   📄 Actualizando solicitud #${idSolicitud} para generar auditoría...`);

            // Hacer un UPDATE real que active el trigger
            await sequelize.query(
                `UPDATE solicitudes SET estado = estado WHERE id_solicitud = :id;`,
                { replacements: { id: idSolicitud } }
            );
            console.log(`   ✅ UPDATE (sin cambios) disparado - trigger NO debería registrar (anti-ruido)`);
            console.log(`      (Esto prueba el filtro anti-ruido correctamente)`);

            // Hacer un UPDATE con cambio real
            await sequelize.query(
                `UPDATE solicitudes SET observaciones = COALESCE(observaciones, '') || ' [Test auditoría ' || NOW()::text || ']' WHERE id_solicitud = :id;`,
                { replacements: { id: idSolicitud } }
            );
            console.log(`   ✅ UPDATE con cambios reales disparado - SÍ debería registrar`);

            // Restaurar
            await sequelize.query(
                `UPDATE solicitudes SET observaciones = regexp_replace(observaciones, ' \\[Test auditoría.*\\]', '', 'g') WHERE id_solicitud = :id;`,
                { replacements: { id: idSolicitud } }
            );
            console.log(`   ✅ UPDATE de limpieza disparado`);
        } else {
            console.log('   ⚠️  No hay solicitudes en la BD para hacer prueba.');
            console.log('   📌 Crea una solicitud desde la app y vuelve a ejecutar este test.');
        }

        // ============================================================
        // 4. MOSTRAR LOS REGISTROS DE AUDITORÍA
        // ============================================================
        console.log('');
        console.log('📋 4/4 Últimos registros de auditoría:');
        console.log('');

        const [registros] = await sequelize.query(`
      SELECT 
          id_auditoria,
          TO_CHAR(changed_at AT TIME ZONE 'America/Caracas', 'DD/MM/YYYY HH24:MI:SS') AS fecha,
          user_name,
          action,
          table_name,
          record_id,
          record_pk,
          ip_address,
          CASE 
              WHEN action = 'UPDATE' THEN 
                  CASE 
                      WHEN old_data IS NOT NULL AND new_data IS NOT NULL THEN
                          'old→new: ' || LEFT(old_data::text, 40) || ' → ' || LEFT(new_data::text, 40)
                      ELSE 'Ver detalle completo'
                  END
              WHEN action = 'INSERT' THEN 'Nuevo registro'
              WHEN action = 'DELETE' THEN 'Registro eliminado'
          END AS detalle
      FROM auditorias
      ORDER BY changed_at DESC
      LIMIT 15;
    `);

        if (registros.length === 0) {
            console.log('   ⚠️  NO HAY REGISTROS DE AUDITORÍA.');
            console.log('');
            console.log('   Posibles causas:');
            console.log('   1. Los triggers no están instalados → node scripts/setup_audit.js');
            console.log('   2. El servidor está caído o no se ha reiniciado');
            console.log('   3. Las operaciones se hacen fuera de executeTransaction()');
            console.log('');
            console.log('   📌 Si ya ejecutaste setup_audit.js, reinicia el servidor:');
            console.log('      pm2 restart 0 (o npm start)');
            console.log('   📌 Luego haz una solicitud desde la app y vuelve a ejecutar:');
            console.log('      node scripts/test_auditoria.js');
        } else {
            console.log('   ┌────────┬─────────────────────┬──────────────────┬────────┬──────────────────┬──────────┐');
            console.log('   │ ID     │ FECHA               │ USUARIO          │ ACCIÓN │ TABLA            │ ID REG   │');
            console.log('   ├────────┼─────────────────────┼──────────────────┼────────┼──────────────────┼──────────┤');
            registros.forEach((r) => {
                console.log(
                    `   │ ${String(r.id_auditoria).padEnd(6)}│ ${r.fecha.padEnd(20)}│ ${String(r.user_name || 'N/A').padEnd(17)}│ ${r.action.padEnd(7)}│ ${r.table_name.padEnd(17)}│ ${String(r.record_id || 'N/A').padEnd(9)}│`
                );
            });
            console.log('   └────────┴─────────────────────┴──────────────────┴────────┴──────────────────┴──────────┘');
        }

        console.log('');
        console.log('═══════════════════════════════════════════════');
        console.log('  🧪 FIN DE LA PRUEBA');
        console.log('═══════════════════════════════════════════════');
        console.log('');

        // Sugerencia para consulta enriquecida
        if (registros.length > 0) {
            console.log('📌 Para ver el detalle completo usa:');
            console.log('');
            console.log('   SELECT * FROM auditorias ORDER BY changed_at DESC LIMIT 5;');
            console.log('');
            console.log('📌 Para consultar por tabla específica:');
            console.log('   SELECT * FROM auditorias WHERE table_name = \'solicitudes\' ORDER BY changed_at DESC;');
            console.log('');
            console.log('📌 Para generar estadísticas:');
            console.log('   SELECT table_name, action, COUNT(*) as total');
            console.log('   FROM auditorias');
            console.log('   GROUP BY table_name, action');
            console.log('   ORDER BY total DESC;');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

testAuditoria();
