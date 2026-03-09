const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Modelo = sequelize.define(
  "Modelo",
  {
    id_modelo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // Clave foránea explícita
    id_marca: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
    
  },
  {
    tableName: "modelos",
    timestamps: false,
  }
);

Modelo.associate = (models) => {
  Modelo.belongsTo(models.Marca, { foreignKey: "id_marca" });
  // Modelo.hasMany(models.Vehiculo, { foreignKey: "id_modelo" }); // Comentado en associations.js
};

module.exports = Modelo;
