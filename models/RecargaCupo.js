const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const RecargaCupo = sequelize.define(
  "RecargaCupo",
  {
    id_recarga: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cupo_actual: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad_recargada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    motivo: {
      type: DataTypes.TEXT,
      allowNull: true, // El motivo podría ser opcional en algunos casos
    },
    autorizado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fecha_recarga: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "recarga_cupo",
    timestamps: false,
    underscored: true,
  },
);

RecargaCupo.associate = (models) => {
  RecargaCupo.belongsTo(models.CupoActual, { foreignKey: "id_cupo_actual", as: "CupoActual" });
  RecargaCupo.belongsTo(models.Usuario, { foreignKey: "autorizado_por", as: "AutorizadoPor" });
};

module.exports = RecargaCupo;
