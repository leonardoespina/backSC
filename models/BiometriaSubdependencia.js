const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Tabla pivot para la relación M:N entre Biometria y Subdependencia.
 * Una persona biométrica puede estar autorizada para operar en múltiples subdependencias.
 */
const BiometriaSubdependencia = sequelize.define(
  "BiometriaSubdependencia",
  {
    id_biometria: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "biometria", key: "id_biometria" },
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subdependencias", key: "id_subdependencia" },
    },
  },
  {
    tableName: "biometria_subdependencias",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["id_biometria", "id_subdependencia"],
      },
    ],
  }
);

module.exports = BiometriaSubdependencia;
