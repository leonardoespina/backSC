/**
 * Script de migración: Cierre de Turno
 * 
 * Problema: Sequelize alter:true no puede convertir columnas existentes
 * a ENUM en PostgreSQL (falla con "syntax error at or near USING").
 * 
 * Solución: Este script crea los tipos ENUM con IF NOT EXISTS y agrega
 * las columnas nuevas manualmente con ADD COLUMN IF NOT EXISTS.
 * 
 * Ejecutar: node scripts/migrate_cierre_turno.js
 */

require("dotenv").config();
const { sequelize } = require("../config/database");

(async () => {
    try {
        console.log("🔗 Conectando a PostgreSQL...");
        await sequelize.authenticate();
        console.log("✅ Conexión exitosa.\n");

        // ══════════════════════════════════════════════
        // 1. CREAR TIPOS ENUM (si no existen)
        // ══════════════════════════════════════════════

        console.log("⏳ Creando tipos ENUM...");

        const enums = [
            `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_mediciones_tanque_tipo_medicion') THEN
          CREATE TYPE "enum_mediciones_tanque_tipo_medicion" AS ENUM ('INICIAL', 'CIERRE', 'ORDINARIA');
        END IF;
      END $$;`,

            `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cierres_turno_turno') THEN
          CREATE TYPE "enum_cierres_turno_turno" AS ENUM ('DIURNO', 'NOCTURNO');
        END IF;
      END $$;`,

            `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cierres_turno_estado') THEN
          CREATE TYPE "enum_cierres_turno_estado" AS ENUM ('PENDIENTE', 'CERRADO');
        END IF;
      END $$;`,

            `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_movimientos_inventario_tipo_movimiento') THEN
          CREATE TYPE "enum_movimientos_inventario_tipo_movimiento" AS ENUM (
            'DESPACHO', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA',
            'RECEPCION_CISTERNA', 'AJUSTE_MEDICION'
          );
        END IF;
      END $$;`,
        ];

        for (const sql of enums) {
            await sequelize.query(sql);
        }
        console.log("✅ Tipos ENUM listos.\n");

        // ══════════════════════════════════════════════
        // 2. NUEVAS COLUMNAS EN mediciones_tanque
        // ══════════════════════════════════════════════

        console.log("⏳ Agregando columnas a mediciones_tanque...");

        await sequelize.query(`
      ALTER TABLE mediciones_tanque
        ADD COLUMN IF NOT EXISTS tipo_medicion "enum_mediciones_tanque_tipo_medicion" NOT NULL DEFAULT 'ORDINARIA',
        ADD COLUMN IF NOT EXISTS id_cierre_turno INTEGER REFERENCES cierres_turno(id_cierre) ON DELETE SET NULL;
    `);
        console.log("✅ mediciones_tanque actualizada.\n");

        // ══════════════════════════════════════════════
        // 3. NUEVA COLUMNA EN solicitudes
        // ══════════════════════════════════════════════

        console.log("⏳ Agregando columna id_cierre_turno a solicitudes...");

        await sequelize.query(`
      ALTER TABLE solicitudes
        ADD COLUMN IF NOT EXISTS id_cierre_turno INTEGER REFERENCES cierres_turno(id_cierre) ON DELETE SET NULL;
    `);
        console.log("✅ solicitudes actualizada.\n");

        // ══════════════════════════════════════════════
        // 4. CREAR TABLA cierres_turno (si no existe)
        // ══════════════════════════════════════════════

        console.log("⏳ Creando tabla cierres_turno...");

        await sequelize.query(`
      CREATE TABLE IF NOT EXISTS cierres_turno (
        id_cierre         SERIAL PRIMARY KEY,
        id_llenadero      INTEGER NOT NULL REFERENCES llenaderos(id_llenadero),
        id_usuario_almacen INTEGER NOT NULL REFERENCES usuarios(id_usuario),
        id_usuario_pcp    INTEGER REFERENCES usuarios(id_usuario),
        turno             "enum_cierres_turno_turno" NOT NULL,
        fecha_lote        DATE NOT NULL,
        hora_inicio_lote  TIME NOT NULL,
        hora_cierre_lote  TIME,
        estado            "enum_cierres_turno_estado" NOT NULL DEFAULT 'PENDIENTE',
        observaciones     TEXT,
        fecha_registro    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log("✅ cierres_turno creada.\n");

        // ══════════════════════════════════════════════
        // 5. CREAR TABLA cierres_turno_mediciones
        // ══════════════════════════════════════════════

        console.log("⏳ Creando tabla cierres_turno_mediciones...");

        await sequelize.query(`
      CREATE TABLE IF NOT EXISTS cierres_turno_mediciones (
        id                    SERIAL PRIMARY KEY,
        id_cierre             INTEGER NOT NULL REFERENCES cierres_turno(id_cierre) ON DELETE CASCADE,
        id_tanque             INTEGER NOT NULL REFERENCES tanques(id_tanque),
        id_tipo_combustible   INTEGER NOT NULL REFERENCES tipos_combustible(id_tipo_combustible),
        id_medicion_inicial   INTEGER REFERENCES mediciones_tanque(id_medicion),
        id_medicion_cierre    INTEGER REFERENCES mediciones_tanque(id_medicion)
      );
    `);
        console.log("✅ cierres_turno_mediciones creada.\n");

        // ══════════════════════════════════════════════
        // 6. CREAR TABLA movimientos_inventario
        // ══════════════════════════════════════════════

        console.log("⏳ Creando tabla movimientos_inventario...");

        await sequelize.query(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id_movimiento       SERIAL PRIMARY KEY,
        id_tanque           INTEGER NOT NULL REFERENCES tanques(id_tanque),
        id_cierre_turno     INTEGER REFERENCES cierres_turno(id_cierre) ON DELETE SET NULL,
        tipo_movimiento     "enum_movimientos_inventario_tipo_movimiento" NOT NULL,
        id_referencia       INTEGER,
        tabla_referencia    VARCHAR(50),
        volumen_antes       NUMERIC(15,2) NOT NULL,
        volumen_despues     NUMERIC(15,2) NOT NULL,
        variacion           NUMERIC(15,2) NOT NULL,
        fecha_movimiento    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        id_usuario          INTEGER REFERENCES usuarios(id_usuario),
        observaciones       TEXT
      );
    `);
        console.log("✅ movimientos_inventario creada.\n");

        console.log("🎉 Migración completada exitosamente.");
    } catch (error) {
        console.error("❌ Error durante la migración:", error.message);
        if (error.parent) {
            console.error("   Detalle:", error.parent.message);
        }
    } finally {
        await sequelize.close();
        process.exit();
    }
})();
