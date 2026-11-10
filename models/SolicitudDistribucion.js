const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SolicitudDistribucion = sequelize.define(
  "SolicitudDistribucion",
  {
    id_distribucion: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_solicitud: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "solicitudes",
        key: "id_solicitud",
      },
      comment: "FK al ticket nodriza matriz",
    },
    id_vehiculo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "vehiculos",
        key: "id_vehiculo",
      },
      comment: "FK a la maquinaria, generador o vehículo receptor",
    },
    cantidad_litros: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
      comment: "Cantidad de litros asignados al equipo",
    },
    id_usuario_registro: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id_usuario",
      },
      comment: "Usuario que registró la rendición en campo",
    },
    fecha_distribucion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Frente de trabajo, turno o notas operativas",
    },
  },
  {
    tableName: "solicitudes_distribucion",
    timestamps: false,
  }
);

SolicitudDistribucion.associate = (models) => {
  SolicitudDistribucion.belongsTo(models.Solicitud, {
    foreignKey: "id_solicitud",
    as: "Solicitud",
    onDelete: "CASCADE",
  });
  SolicitudDistribucion.belongsTo(models.Vehiculo, {
    foreignKey: "id_vehiculo",
    as: "Vehiculo",
  });
  SolicitudDistribucion.belongsTo(models.Usuario, {
    foreignKey: "id_usuario_registro",
    as: "Registrador",
  });
};

module.exports = SolicitudDistribucion;
