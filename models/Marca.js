const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Marca = sequelize.define(
  "Marca",
  {
    id_marca: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: false,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
    // --- CAMPOS DE AUDITORÍA ---
 
  
  },
  {
    tableName: "marcas",
    timestamps: false,
  }
);

Marca.associate = (models) => {
  Marca.hasMany(models.Modelo, { foreignKey: "id_marca" });
  // Marca.hasMany(models.Vehiculo, { foreignKey: "id_marca" }); // Comentado en associations.js
};

module.exports = Marca;
