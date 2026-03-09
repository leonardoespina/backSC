const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Subdependencia = sequelize.define(
  "Subdependencia",
  {
    id_subdependencia: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ubicacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    responsable: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    cedula_rif: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    cobra_venta: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: "subdependencias",
    timestamps: false,
  }
);

Subdependencia.associate = (models) => {
  Subdependencia.belongsTo(models.Dependencia, { foreignKey: "id_dependencia", as: "Dependencia" });
  Subdependencia.hasMany(models.Usuario, { foreignKey: "id_subdependencia" });
  Subdependencia.hasMany(models.Biometria, { foreignKey: "id_subdependencia" });
  Subdependencia.hasMany(models.CupoBase, { foreignKey: "id_subdependencia" });
};

module.exports = Subdependencia;
