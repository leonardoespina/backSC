const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ConsumoCupo = sequelize.define(
  "ConsumoCupo",
  {
    id_consumo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cupo_actual: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_consumo: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "consumo_cupo",
    timestamps: false,
    underscored: true,
  },
);

ConsumoCupo.associate = (models) => {
  ConsumoCupo.belongsTo(models.CupoActual, { foreignKey: "id_cupo_actual", as: "CupoActual" });
};

module.exports = ConsumoCupo;
