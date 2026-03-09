const { sequelize } = require('../config/database');

const setupAudit = async () => {
  const transaction = await sequelize.transaction();
  try {
    console.log('Iniciando configuración de auditoría...');

    // 1. Crear tabla auditorias
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS auditorias (
          id SERIAL PRIMARY KEY,
          table_name TEXT NOT NULL,
          action TEXT NOT NULL,
          record_id TEXT,
          old_data JSONB,
          new_data JSONB,
          ip_address INET,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, { transaction });

    // 2. Crear función del trigger
    // Nota: Usamos row_to_json para capturar los datos.
    // Intentamos extraer id_usuario o id como record_id.
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS TRIGGER AS $$
      DECLARE
          client_ip INET;
          rec_id TEXT;
          old_json JSONB;
          new_json JSONB;
      BEGIN
          -- Intentar obtener la IP de la configuración local (seteada por la app)
          BEGIN
              client_ip := NULLIF(current_setting('app.current_ip', true), '')::INET;
          EXCEPTION WHEN OTHERS THEN
              client_ip := NULL;
          END;

          -- Convertir a JSON
          old_json := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END;
          new_json := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END;

          -- Intentar extraer ID (buscamos id_usuario o id)
          IF (TG_OP = 'DELETE') THEN
              rec_id := COALESCE(old_json->>'id_usuario', old_json->>'id');
          ELSE
              rec_id := COALESCE(new_json->>'id_usuario', new_json->>'id');
          END IF;

          IF (TG_OP = 'DELETE') THEN
              INSERT INTO auditorias (table_name, action, record_id, old_data, ip_address)
              VALUES (TG_TABLE_NAME, 'DELETE', rec_id, old_json, client_ip);
              RETURN OLD;
          ELSIF (TG_OP = 'UPDATE') THEN
              INSERT INTO auditorias (table_name, action, record_id, old_data, new_data, ip_address)
              VALUES (TG_TABLE_NAME, 'UPDATE', rec_id, old_json, new_json, client_ip);
              RETURN NEW;
          ELSIF (TG_OP = 'INSERT') THEN
              INSERT INTO auditorias (table_name, action, record_id, new_data, ip_address)
              VALUES (TG_TABLE_NAME, 'INSERT', rec_id, new_json, client_ip);
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `, { transaction });

    // 3. Crear trigger en tabla usuarios
    await sequelize.query(`
      DROP TRIGGER IF EXISTS trg_audit_usuarios ON usuarios;
      CREATE TRIGGER trg_audit_usuarios
      AFTER INSERT OR UPDATE OR DELETE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    `, { transaction });

    await transaction.commit();
    console.log('✅ Configuración de auditoría completada exitosamente.');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error configurando auditoría:', error);
  } finally {
    await sequelize.close();
  }
};

setupAudit();
