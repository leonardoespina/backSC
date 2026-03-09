const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TransferenciaInterna = sequelize.define(
  "TransferenciaInterna",
  {
    id_transferencia: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fecha_transferencia: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    id_tanque_origen: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_tanque_destino: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad_transferida: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nivel_origen_antes: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nivel_origen_despues: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nivel_destino_antes: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nivel_destino_despues: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    id_almacenista: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Usuario logueado que realiza la transferencia",
    },
    medida_vara_destino: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("PROCESADO", "MODIFICADO"),
      defaultValue: "PROCESADO",
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "transferencias_internas",
    timestamps: false,
  }
);

TransferenciaInterna.associate = (models) => {
  TransferenciaInterna.belongsTo(models.Tanque, { foreignKey: "id_tanque_origen", as: "TanqueOrigen" });
  TransferenciaInterna.belongsTo(models.Tanque, { foreignKey: "id_tanque_destino", as: "TanqueDestino" });
  TransferenciaInterna.belongsTo(models.Usuario, { foreignKey: "id_almacenista", as: "Almacenista" });
};

module.exports = TransferenciaInterna;
