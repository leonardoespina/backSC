const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Categoria = sequelize.define(
  "Categoria",
  {
    id_categoria: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    fecha_modificacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "categoria",
    timestamps: false,
  }
);

Categoria.associate = (models) => {
  Categoria.hasMany(models.Dependencia, { foreignKey: "id_categoria" });
  Categoria.hasMany(models.Usuario, { foreignKey: "id_categoria" });
  Categoria.hasMany(models.Biometria, { foreignKey: "id_categoria" });
  Categoria.hasMany(models.CupoBase, { foreignKey: "id_categoria" });
};

module.exports = Categoria;
