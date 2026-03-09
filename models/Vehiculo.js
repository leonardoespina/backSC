const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Vehiculo = sequelize.define(
  "Vehiculo",
  {
    id_vehiculo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    placa: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    es_generador: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "TRUE si es generador eléctrico, FALSE si es vehículo flota o planta",
    },
    es_planta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "TRUE si es planta, FALSE si es vehículo flota o generador",
    },
    // Relación con Tipo de Combustible (Migrado de string a FK)
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Relaciones de Flota
    id_marca: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_modelo: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Jerarquía Opcional corregida
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false, // Requerido según instrucciones
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: false, // Requerido según instrucciones
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
    registrado_por: {
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
  },
  {
    tableName: "vehiculos",
    timestamps: false,
  }
);

Vehiculo.associate = (models) => {
  Vehiculo.belongsTo(models.Marca, { foreignKey: "id_marca", as: "Marca" });
  Vehiculo.belongsTo(models.Modelo, { foreignKey: "id_modelo", as: "Modelo" });
  Vehiculo.belongsTo(models.Categoria, { foreignKey: "id_categoria", as: "Categoria" });
  Vehiculo.belongsTo(models.Dependencia, { foreignKey: "id_dependencia", as: "Dependencia" });
  Vehiculo.belongsTo(models.Subdependencia, { foreignKey: "id_subdependencia", as: "Subdependencia" });
  Vehiculo.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible", as: "TipoCombustible" });

  // Vehiculo.hasMany(models.CargaCisterna, { foreignKey: "id_vehiculo" });
  // Vehiculo.hasMany(models.Despacho, { foreignKey: "id_vehiculo" });
};

module.exports = Vehiculo;
