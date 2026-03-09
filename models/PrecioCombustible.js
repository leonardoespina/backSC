const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PrecioCombustible = sequelize.define(
  "PrecioCombustible",
  {
    id_precio: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tipo_combustible", // Nombre de tabla en BD (corregido de tipos_combustible a tipo_combustible)
        key: "id_tipo_combustible",
      },
    },
    id_moneda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "monedas",
        key: "id_moneda",
      },
    },
    precio: {
      type: DataTypes.DECIMAL(8, 4), // Alta precisión para valores como Oro (0.025)
      allowNull: false,
    },
    fecha_vigencia: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Solo un precio activo por combinación Combustible-Moneda",
    },
  },
  {
    tableName: "precios_combustible",
    timestamps: false,
  }
);

PrecioCombustible.associate = (models) => {
  PrecioCombustible.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible", as: "TipoCombustible" });
  PrecioCombustible.belongsTo(models.Moneda, { foreignKey: "id_moneda", as: "Moneda" });
};

module.exports = PrecioCombustible;
