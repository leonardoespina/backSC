const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Dependencia = sequelize.define(
  "Dependencia",
  {
    id_dependencia: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    nombre_dependencia: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    nombre_apellido: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    cedula: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ubicacion: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tipo_venta: {
      type: DataTypes.ENUM("INSTITUCIONAL", "VENTA", "AMBOS"),
      defaultValue: "INSTITUCIONAL",
      allowNull: false,
    },
    estatus: {
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
    tableName: "dependencias",
    timestamps: false,
  },
);

Dependencia.associate = (models) => {
  Dependencia.belongsTo(models.Categoria, {
    foreignKey: "id_categoria",
    as: "Categoria",
  });
  Dependencia.hasMany(models.Subdependencia, { foreignKey: "id_dependencia" });
  Dependencia.hasMany(models.Usuario, { foreignKey: "id_dependencia" });
  Dependencia.hasMany(models.Biometria, { foreignKey: "id_dependencia" });
  Dependencia.hasMany(models.CupoBase, { foreignKey: "id_dependencia" });
};

module.exports = Dependencia;
