const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MovimientoLlenadero = sequelize.define(
  "MovimientoLlenadero",
  {
    id_movimiento: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_llenadero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'llenaderos',
        key: 'id_llenadero'
      }
    },
    tipo_movimiento: {
      type: DataTypes.ENUM("CARGA", "EVAPORACION"),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    saldo_anterior: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    saldo_nuevo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    porcentaje_anterior: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    porcentaje_nuevo: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    fecha_movimiento: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      }
    },
    // Campos específicos para Carga (Pueden ser null en Evaporación)
    numero_factura: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    litros_factura: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    datos_gandola: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    nombre_conductor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    cedula_conductor: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "movimientos_llenadero",
    timestamps: false,
  }
);

MovimientoLlenadero.associate = (models) => {
  MovimientoLlenadero.belongsTo(models.Llenadero, { foreignKey: "id_llenadero", as: "Llenadero" });
  MovimientoLlenadero.belongsTo(models.Usuario, { foreignKey: "id_usuario", as: "Usuario" });
};

module.exports = MovimientoLlenadero;
