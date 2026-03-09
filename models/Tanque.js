const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Tanque = sequelize.define(
  "Tanque",
  {
    id_tanque: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_llenadero: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo_tanque: {
      type: DataTypes.ENUM("RECTANGULAR", "CILINDRICO"),
      allowNull: false,
    },
    capacidad_maxima: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    nivel_actual: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    nivel_alarma_bajo: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    nivel_alarma_alto: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    unidad_medida: {
      type: DataTypes.ENUM("CM", "M", "PULGADAS", "MM"),
      allowNull: false,
      defaultValue: "CM",
    },
    alto: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },
    radio: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },
    largo: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },
    ancho: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO", "MANTENIMIENTO", "CONTAMINADO"),
      defaultValue: "ACTIVO",
    },
    con_aforo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    aforo: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    activo_para_despacho: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "tanques",
    timestamps: false,
  }
);

Tanque.associate = (models) => {
  Tanque.belongsTo(models.Llenadero, { foreignKey: "id_llenadero", as: "Llenadero" });
  Tanque.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible", as: "TipoCombustible" });
};

module.exports = Tanque;
