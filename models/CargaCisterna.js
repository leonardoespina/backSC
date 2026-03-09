const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CargaCisterna = sequelize.define(
  "CargaCisterna",
  {
    id_carga: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    numero_guia: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fecha_emision: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fecha_recepcion: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fecha_llegada: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    placa_cisterna: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Placa del vehículo cisterna (Ingreso manual)",
    },
    nombre_chofer: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Nombre del chofer (Ingreso manual)",
    },
    id_almacenista: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Usuario logueado que recibe",
    },
    id_tanque: {
      type: DataTypes.INTEGER,
      allowNull: true, // Null en cargas multi-tanque; el detalle está en CargaCisternaTanque
    },
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    litros_segun_guia: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    medida_inicial: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    medida_final: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    litros_iniciales: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    litros_finales: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    litros_recibidos: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    diferencia_guia: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    litros_flujometro: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    peso_entrada: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    peso_salida: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    hora_inicio_descarga: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    hora_fin_descarga: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tiempo_descarga: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tiempo total de descarga en minutos",
    },
    aforo_compartimiento: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array con la tabla de aforo utilizada para validar esta carga",
    },
    estado: {
      type: DataTypes.ENUM("PROCESADO", "ANULADO"),
      defaultValue: "PROCESADO",
    },
    id_usuario_registro: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "cargas_cisterna",
    timestamps: false,
  }
);

CargaCisterna.associate = (models) => {
  CargaCisterna.belongsTo(models.Tanque, { foreignKey: "id_tanque", as: "Tanque", constraints: false });
  CargaCisterna.belongsTo(models.Usuario, { foreignKey: "id_almacenista", as: "Almacenista" });
  CargaCisterna.belongsTo(models.Usuario, { foreignKey: "id_usuario_registro", as: "UsuarioRegistro" });
  CargaCisterna.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible", as: "TipoCombustible" });
  CargaCisterna.hasMany(models.CargaCisternaTanque, { foreignKey: "id_carga", as: "tanques_descarga" });
};

module.exports = CargaCisterna;
