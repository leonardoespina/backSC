const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * MovimientoInventario
 * Tabla central de trazabilidad. Registra TODOS los eventos que
 * modifican el nivel de un tanque, con referencia  al evento origen.
 *
 * tipo_movimiento:
 *   DESPACHO             - ticket de combustible finalizado
 *   TRANSFERENCIA_SALIDA - tanque que entrega combustible
 *   TRANSFERENCIA_ENTRADA- tanque que recibe combustible
 *   RECEPCION_CISTERNA   - carga de camión cisterna
 *   AJUSTE_MEDICION      - recalibración por medición física de cierre
 */
const MovimientoInventario = sequelize.define(
    "MovimientoInventario",
    {
        id_movimiento: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_tanque: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        id_cierre_turno: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "null = pendiente de asignar a un lote de cierre",
        },
        tipo_movimiento: {
            type: DataTypes.STRING(30),
            allowNull: false,
            validate: {
                isIn: [[
                    "DESPACHO",
                    "TRANSFERENCIA_SALIDA",
                    "TRANSFERENCIA_ENTRADA",
                    "RECEPCION_CISTERNA",
                    "AJUSTE_MEDICION",
                ]],
            },
        },
        id_referencia: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "ID del registro origen (id_solicitud, id_transferencia, id_carga, id_medicion)",
        },
        tabla_referencia: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "Tabla origen: solicitudes | transferencias_internas | cargas_cisternas | mediciones_tanque",
        },
        volumen_antes: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            comment: "nivel_actual del tanque ANTES del evento",
        },
        volumen_despues: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            comment: "nivel_actual del tanque DESPUÉS del evento",
        },
        variacion: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            comment: "volumen_despues - volumen_antes (negativo = salida, positivo = entrada)",
        },
        fecha_movimiento: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        id_usuario: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        observaciones: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "movimientos_inventario",
        timestamps: false,
    }
);

MovimientoInventario.associate = (models) => {
    MovimientoInventario.belongsTo(models.Tanque, {
        foreignKey: "id_tanque",
        as: "Tanque",
    });
    MovimientoInventario.belongsTo(models.CierreTurno, {
        foreignKey: "id_cierre_turno",
        as: "CierreTurno",
    });
    MovimientoInventario.belongsTo(models.Usuario, {
        foreignKey: "id_usuario",
        as: "Usuario",
    });
};

module.exports = MovimientoInventario;
