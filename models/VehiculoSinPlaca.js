const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VehiculoSinPlaca = sequelize.define(
  "VehiculoSinPlaca",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ultimo_correlativo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 53,
      comment: "Último número correlativo utilizado (ej: 53 para SPMB0053)"
    },
    prefijo: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "SPMB",
      comment: "Prefijo fijo para los correlativos"
    },
    fecha_actualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: DataTypes.NOW
    }
  },
  {
    tableName: "vehiculos_sin_placa",
    timestamps: false,
    comment: "Tabla auxiliar para gestionar correlativos de vehículos sin placa"
  }
);

module.exports = VehiculoSinPlaca;