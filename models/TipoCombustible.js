const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TipoCombustible = sequelize.define(
  "TipoCombustible",
  {
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "tipo_combustible",
    timestamps: false,
    underscored: true,
  }
);

TipoCombustible.associate = (models) => {
  TipoCombustible.hasMany(models.CupoBase, { foreignKey: "id_tipo_combustible" });
  TipoCombustible.hasMany(models.PrecioCombustible, { foreignKey: "id_tipo_combustible", as: "Precios" });
};

module.exports = TipoCombustible;
