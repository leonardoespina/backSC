const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * CierreTurnoMedicion
 * Detalle de mediciones por tanque activo / tipo de combustible
 * dentro de un CierreTurno.
 *
 * Para cada tipo de combustible en el llenadero se registra:
 *   - Medición Inicial (foto de apertura, no modifica nivel)
 *   - Medición de Cierre (foto final, recalibra nivel_actual del tanque)
 */
const CierreTurnoMedicion = sequelize.define(
    "CierreTurnoMedicion",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_cierre: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        id_tanque: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "Tanque activo (activo_para_despacho=true) de ese tipo de combustible",
        },
        id_tipo_combustible: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        id_medicion_inicial: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "MedicionTanque tipo=INICIAL",
        },
        id_medicion_cierre: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "MedicionTanque tipo=CIERRE (recalibra nivel_actual)",
        },
    },
    {
        tableName: "cierres_turno_mediciones",
        timestamps: false,
    }
);

CierreTurnoMedicion.associate = (models) => {
    CierreTurnoMedicion.belongsTo(models.CierreTurno, {
        foreignKey: "id_cierre",
        as: "CierreTurno",
    });
    CierreTurnoMedicion.belongsTo(models.Tanque, {
        foreignKey: "id_tanque",
        as: "Tanque",
    });
    CierreTurnoMedicion.belongsTo(models.TipoCombustible, {
        foreignKey: "id_tipo_combustible",
        as: "TipoCombustible",
    });
    CierreTurnoMedicion.belongsTo(models.MedicionTanque, {
        foreignKey: "id_medicion_inicial",
        as: "MedicionInicial",
    });
    CierreTurnoMedicion.belongsTo(models.MedicionTanque, {
        foreignKey: "id_medicion_cierre",
        as: "MedicionCierre",
    });
};

module.exports = CierreTurnoMedicion;
