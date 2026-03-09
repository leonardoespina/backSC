const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Moneda = sequelize.define(
  "Moneda",
  {
    id_moneda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(50), // Ej: Dólar Americano, Bolívar Digital
      allowNull: false,
      unique: true,
    },
    simbolo: {
      type: DataTypes.STRING(10), // Ej: $, Bs, Au
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "monedas",
    timestamps: false,
  }
);

Moneda.associate = (models) => {
  Moneda.hasMany(models.PrecioCombustible, { foreignKey: "id_moneda", as: "Precios" });
};

module.exports = Moneda;
