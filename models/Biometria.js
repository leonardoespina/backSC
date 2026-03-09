const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Biometria = sequelize.define(
  "Biometria",
  {
    id_biometria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cedula: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    rol: {
      type: DataTypes.ENUM("RETIRO", "ALMACEN", "AMBOS"),
      allowNull: false,
    },
    // Almacenamos el template de SourceAFIS (JSON o binario serializado)
    template: {
      type: DataTypes.TEXT, // O BLOB si es binario puro
      allowNull: false,
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    fecha_modificacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
  },
  {
    tableName: "biometria",
    timestamps: false,
  }
);

Biometria.associate = (models) => {
  Biometria.belongsTo(models.Categoria, { foreignKey: "id_categoria", as: "Categoria" });
  Biometria.belongsTo(models.Dependencia, { foreignKey: "id_dependencia", as: "Dependencia" });
  Biometria.belongsTo(models.Subdependencia, { foreignKey: "id_subdependencia", as: "Subdependencia" });
};

module.exports = Biometria;
