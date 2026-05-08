const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Modelo de Auditoría
 * 
 * Cada registro representa un cambio en cualquier tabla del sistema.
 * Los datos son insertados automáticamente por el trigger de BD
 * audit_trigger_func() en cada INSERT/UPDATE/DELETE.
 */
const Auditoria = sequelize.define(
    "Auditoria",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: "id_auditoria",
        },
        table_name: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "Nombre de la tabla que se modificó (ej: solicitudes, usuarios)",
        },
        action: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "Acción realizada: INSERT, UPDATE o DELETE",
        },
        record_id: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "ID del registro afectado (valor de la PK)",
        },
        record_pk: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Nombre de la columna PK (ej: solicitudes_id)",
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "ID del usuario que realizó la acción (FK a usuarios)",
        },
        user_name: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Nombre completo del usuario (para consultas rápidas sin JOIN)",
        },
        ip_address: {
            type: DataTypes.INET,
            allowNull: true,
            comment: "Dirección IP desde donde se realizó la acción",
        },
        old_data: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "Estado anterior del registro (NULL en INSERT)",
        },
        new_data: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "Estado nuevo del registro (NULL en DELETE)",
        },
        changed_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            comment: "Marca de tiempo de cuándo ocurrió el cambio",
        },
    },
    {
        tableName: "auditorias",
        timestamps: false, // Nosotros manejamos changed_at manualmente con el trigger
        indexes: [
            { name: "idx_audit_table_action", fields: ["table_name", "action", "changed_at"] },
            { name: "idx_audit_user", fields: ["user_id", "changed_at"] },
            { name: "idx_audit_record", fields: ["record_id", "table_name"] },
            { name: "idx_audit_fecha", fields: ["changed_at"] },
        ],
    }
);

module.exports = Auditoria;
