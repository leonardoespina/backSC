const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CupoActual = sequelize.define(
  "CupoActual",
  {
    id_cupo_actual: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cupo_base: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    periodo: {
      type: DataTypes.STRING(7), // Formato 'YYYY-MM'
      allowNull: false,
    },
    cantidad_asignada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad_disponible: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cantidad_consumida: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cantidad_recargada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY, // Solo fecha sin hora
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATEONLY, // Solo fecha sin hora
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "AGOTADO", "CERRADO"),
      defaultValue: "ACTIVO",
      allowNull: false,
    },
  },
  {
    tableName: "cupo_actual",
    timestamps: false,
    underscored: true,
    uniqueKeys: {
      unique_cupo_actual_combination: {
        fields: ["id_cupo_base", "periodo"],
      },
    },
  },
);

CupoActual.associate = (models) => {
  CupoActual.belongsTo(models.CupoBase, { foreignKey: "id_cupo_base", as: "CupoBase" });
  CupoActual.hasMany(models.RecargaCupo, { foreignKey: "id_cupo_actual", as: "Recargas" });
  CupoActual.hasMany(models.ConsumoCupo, { foreignKey: "id_cupo_actual", as: "Consumos" });
};

module.exports = CupoActual;
