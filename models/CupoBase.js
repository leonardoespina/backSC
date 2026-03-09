const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const CupoBase = sequelize.define(
  "CupoBase",
  {
    id_cupo_base: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad_mensual: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "cupo_base",
    timestamps: false, // Usamos created_at y updated_at manualmente
    underscored: true,
    uniqueKeys: {
      unique_cupo_base_combination_v2: {
        fields: ["id_categoria", "id_dependencia", "id_subdependencia", "id_tipo_combustible"],
      },
    },
  },
);

CupoBase.associate = (models) => {
  CupoBase.belongsTo(models.Categoria, { foreignKey: "id_categoria", as: "Categoria" });
  CupoBase.belongsTo(models.Dependencia, { foreignKey: "id_dependencia", as: "Dependencia" });
  CupoBase.belongsTo(models.Subdependencia, { foreignKey: "id_subdependencia", as: "Subdependencia" });
  CupoBase.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible", as: "TipoCombustible" });
  
  CupoBase.hasMany(models.CupoActual, { foreignKey: "id_cupo_base", as: "CuposMensuales" });
  CupoBase.hasMany(models.HistorialCupoMensual, { foreignKey: "id_cupo_base", as: "HistorialMensual" });
};

module.exports = CupoBase;
