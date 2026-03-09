const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Llenadero = sequelize.define(
  "Llenadero",
  {
    id_llenadero: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_llenadero: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    // Capacidad, id_combustible, and disponibilidadActual were removed
    // since a Llenadero manages inventory via its associated Tanques.
    estado: {
      // Cambiado de ENUM a STRING para compatibilidad con PostgreSQL sync
      type: DataTypes.STRING(20),
      defaultValue: "ACTIVO",
    },

  },
  {
    tableName: "llenaderos",
    timestamps: false,
  }
);

Llenadero.associate = (models) => {
  Llenadero.hasMany(models.Tanque, { foreignKey: "id_llenadero", as: "Tanques" });
};

module.exports = Llenadero;
