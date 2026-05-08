/**
 * helpers/auditSetup.js
 * 
 * Sincroniza el Sistema de Auditoría al iniciar el servidor.
 * Este helper es "Self-Healing": asegura que la tabla, la función trigger 
 * y los triggers de cada tabla estén correctamente configurados.
 */
const { sequelize } = require("../config/database");
const { TABLAS_AUDITADAS } = require("../constants/auditoriaConstants");

async function ensureAuditTriggers() {
    try {
        console.log("🔍 Sincronizando sistema de auditoría...");
        const db = require("../models");

        // 1. Asegurar que la tabla 'auditorias' exista y tenga las columnas correctas
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS auditorias (
                id_auditoria  SERIAL PRIMARY KEY,
                table_name    TEXT NOT NULL,
                action        TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
                record_id     TEXT,
                record_pk     TEXT,
                user_id       INTEGER,
                user_name     TEXT,
                ip_address    INET,
                old_data      JSONB,
                new_data      JSONB,
                changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // Columnas que podrían faltar en versiones antiguas
        const columnasExtras = [
            { name: "record_pk", type: "TEXT" },
            { name: "user_name", type: "TEXT" },
            { name: "ip_address", type: "INET" }
        ];

        for (const col of columnasExtras) {
            await sequelize.query(`
                ALTER TABLE auditorias ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
            `).catch(() => {}); // Ignorar si ya existe
        }

        // 2. Crear o actualizar la función trigger
        // Se ha mejorado para capturar record_pk y ser más flexible con los nombres de ID
        await sequelize.query(`
            CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS TRIGGER AS $$
            DECLARE
                client_ip INET;
                curr_user_id TEXT;
                curr_user_name TEXT;
                rec_id TEXT;
                pk_field TEXT;
                old_json JSONB;
                new_json JSONB;
            BEGIN
                -- 1. Capturar contexto desde variables de sesión (seteado por transactionHelper.js)
                BEGIN
                    client_ip := NULLIF(current_setting('app.current_ip', true), '')::INET;
                EXCEPTION WHEN OTHERS THEN client_ip := NULL;
                END;

                BEGIN
                    curr_user_id := NULLIF(current_setting('app.current_user_id', true), '');
                EXCEPTION WHEN OTHERS THEN curr_user_id := NULL;
                END;

                BEGIN
                    curr_user_name := NULLIF(current_setting('app.current_user_name', true), '');
                EXCEPTION WHEN OTHERS THEN curr_user_name := NULL;
                END;

                -- 2. Preparar JSONs
                old_json := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END;
                new_json := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END;

                -- 3. Optimización: No auditar UPDATEs sin cambios
                IF TG_OP = 'UPDATE' AND old_json = new_json THEN
                    RETURN NEW;
                END IF;

                -- 4. Determinar el campo de la clave primaria (PK)
                -- Intenta: <tabla>_id, id_<tabla>, id_<tabla_singular>, id
                pk_field := TG_TABLE_NAME || '_id';
                
                IF TG_OP = 'DELETE' THEN
                    rec_id := COALESCE(
                        old_json->>pk_field,
                        old_json->>'id_' || TG_TABLE_NAME,
                        old_json->>'id_' || RTRIM(TG_TABLE_NAME, 's'),
                        old_json->>'id'
                    );
                ELSE
                    rec_id := COALESCE(
                        new_json->>pk_field,
                        new_json->>'id_' || TG_TABLE_NAME,
                        new_json->>'id_' || RTRIM(TG_TABLE_NAME, 's'),
                        new_json->>'id'
                    );
                END IF;

                -- 5. Insertar registro de auditoría
                INSERT INTO auditorias (
                    table_name, action, record_id, record_pk, 
                    user_id, user_name, ip_address, 
                    old_data, new_data, changed_at
                ) VALUES (
                    TG_TABLE_NAME, TG_OP, rec_id, pk_field,
                    curr_user_id::INTEGER, curr_user_name, client_ip,
                    old_json, new_json, NOW()
                );

                IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 3. Sincronizar Triggers
        // Obtener tablas del sistema (excluyendo la propia auditoría)
        const TODAS = [];
        Object.keys(db).forEach((name) => {
            if (name === "sequelize") return;
            const model = db[name];
            if (model.tableName && model.tableName !== "auditorias") {
                TODAS.push(model.tableName);
            }
        });

        let instalados = 0;
        let eliminados = 0;

        // Eliminar triggers de tablas no permitidas
        for (const table of TODAS) {
            if (!TABLAS_AUDITADAS.includes(table)) {
                await sequelize.query(`DROP TRIGGER IF EXISTS trg_audit_${table} ON "${table}"`);
                eliminados++;
            }
        }

        // Asegurar triggers en la lista blanca
        for (const table of TABLAS_AUDITADAS) {
            await sequelize.query(`DROP TRIGGER IF EXISTS trg_audit_${table} ON "${table}"`);
            await sequelize.query(`
                CREATE TRIGGER trg_audit_${table}
                AFTER INSERT OR UPDATE OR DELETE ON "${table}"
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
            `);
            instalados++;
        }

        console.log(`✅ Auditoría lista: ${instalados} tablas activas, ${eliminados} inactivas.`);
    } catch (err) {
        console.error("❌ Error configurando triggers de auditoría:", err.message);
    }
}

module.exports = { ensureAuditTriggers };
