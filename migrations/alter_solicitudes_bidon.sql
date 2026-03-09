-- ============================================================
-- Migración: Soporte BIDÓN sin vehículo en tabla solicitudes
-- Fecha: 2026-02-23
-- Descripción: id_vehiculo y placa pasan a ser opcionales
--              para solicitudes de tipo_suministro = 'BIDON'.
--              El service asigna "NO APLICA" a placa/marca/modelo.
-- ============================================================

-- SQL Server / Azure SQL:
ALTER TABLE solicitudes ALTER COLUMN id_vehiculo INT NULL;
ALTER TABLE solicitudes ALTER COLUMN placa VARCHAR(20) NULL;

-- ============================================================
-- Si usas MySQL / MariaDB, reemplazar con:
-- ALTER TABLE solicitudes MODIFY COLUMN id_vehiculo INT NULL;
-- ALTER TABLE solicitudes MODIFY COLUMN placa VARCHAR(20) NULL;
-- ============================================================

-- ============================================================
-- Si usas PostgreSQL, reemplazar con:
-- ALTER TABLE solicitudes ALTER COLUMN id_vehiculo DROP NOT NULL;
-- ALTER TABLE solicitudes ALTER COLUMN placa DROP NOT NULL;
-- ============================================================
