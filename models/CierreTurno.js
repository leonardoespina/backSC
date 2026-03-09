const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * CierreTurno
 * Representa un lote de cierre de turno para un llenadero.
 * Agrupa todos los movimientos de inventario (despachos, transferencias,
 * recepciones) con id_cierre_turno = null que existan en ese llenadero
 * al momento de ejecutar el cierre.
 */
const CierreTurno = sequelize.define(
    "CierreTurno",
    {
        id_cierre: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_llenadero: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "Llenadero al que pertenece el lote",
        },
        id_usuario_almacen: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "Almacenista que registra el cierre",
        },
        id_usuario_pcp: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "Validador PCP que firma el cierre",
        },
        turno: {
            type: DataTypes.STRING(10),
            allowNull: false,
            validate: { isIn: [["DIURNO", "NOCTURNO"]] },
        },
        fecha_lote: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: "Fecha del lote (ingresada manualmente por el almacenista)",
        },
        hora_inicio_lote: {
            type: DataTypes.TIME,
            allowNull: false,
            comment: "Hora inicio del período (manual)",
        },
        hora_cierre_lote: {
            type: DataTypes.TIME,
            allowNull: true,
            comment: "Hora de cierre efectivo",
        },
        estado: {
            type: DataTypes.STRING(20),
            defaultValue: "PENDIENTE",
            validate: { isIn: [["PENDIENTE", "CERRADO"]] },
        },
        observaciones: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        fecha_registro: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "cierres_turno",
        timestamps: false,
    }
);

CierreTurno.associate = (models) => {
    CierreTurno.belongsTo(models.Llenadero, {
        foreignKey: "id_llenadero",
        as: "Llenadero",
    });
    CierreTurno.belongsTo(models.Usuario, {
        foreignKey: "id_usuario_almacen",
        as: "Almacenista",
    });
    CierreTurno.belongsTo(models.Usuario, {
        foreignKey: "id_usuario_pcp",
        as: "ValidadorPCP",
    });
    // Detalle de mediciones por tipo de combustible
    CierreTurno.hasMany(models.CierreTurnoMedicion, {
        foreignKey: "id_cierre",
        as: "Mediciones",
    });
    // Movimientos agrupados en este lote
    CierreTurno.hasMany(models.MovimientoInventario, {
        foreignKey: "id_cierre_turno",
        as: "Movimientos",
    });
    // Solicitudes (despachos) del lote
    CierreTurno.hasMany(models.Solicitud, {
        foreignKey: "id_cierre_turno",
        as: "Solicitudes",
    });
};

module.exports = CierreTurno;
