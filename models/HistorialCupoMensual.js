const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HistorialCupoMensual = sequelize.define(
  "HistorialCupoMensual",
  {
    id_historial: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cupo_base: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    periodo: {
      type: DataTypes.STRING(7),
      allowNull: false,
    },
    cantidad_asignada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad_consumida: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad_recargada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad_no_utilizada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Lo que se perdió por no acumularse",
    },
    fecha_cierre: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "historial_cupo_mensual",
    timestamps: false,
    underscored: true,
  },
);

HistorialCupoMensual.associate = (models) => {
  HistorialCupoMensual.belongsTo(models.CupoBase, { foreignKey: "id_cupo_base", as: "CupoBase" });
};

module.exports = HistorialCupoMensual;
