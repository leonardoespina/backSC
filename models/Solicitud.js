const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Solicitud = sequelize.define(
  "Solicitud",
  {
    id_solicitud: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    codigo_ticket: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Generado al imprimir: [B/R][CodDep][Correlativo]",
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Usuario solicitante",
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_vehiculo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Null para solicitudes BIDÓN",
    },
    // Snapshot de datos del vehículo
    placa: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "'NO APLICA' para solicitudes BIDÓN",
    },
    marca: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    modelo: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    flota: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    id_llenadero: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_tipo_combustible: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad_litros: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    cantidad_despachada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Cantidad real despachada (puede diferir de lo aprobado)",
    },
    tipo_suministro: {
      type: DataTypes.ENUM("REGULAR", "BIDON"),
      allowNull: false,
    },
    tipo_solicitud: {
      type: DataTypes.ENUM("INSTITUCIONAL", "VENTA"),
      allowNull: false,
      // defaultValue: "INSTITUCIONAL",
    },
    // Cierre de Turno (Lote)
    id_cierre_turno: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK a CierreTurno. null = pendiente de asignar al próximo lote de cierre",
    },
    // Datos para Venta
    id_precio: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK a PrecioCombustible usado para el cálculo",
    },
    precio_unitario: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
    },
    monto_total: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM(
        "NUEVA",
        "PENDIENTE",
        "APROBADA",
        "IMPRESA",
        "DESPACHADA",
        "VENCIDA",
        "ANULADA",
        "FINALIZADA"
      ),
      // defaultValue: "PENDIENTE",
    },
    // Auditoría y Fechas
    fecha_solicitud: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    fecha_aprobacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    id_aprobador: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Gerente o Jefe que aprobó",
    },
    fecha_impresion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    numero_impresiones: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    fecha_despacho: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Validación y Cierre (Nuevo Fase 5)
    fecha_validacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observaciones_validacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    id_validador: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Usuario (Inspector/Gerente) que finalizó el ticket",
    },
    // Biometría (IDs de usuario/biometria que pusieron huella)
    id_almacenista: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Usuario Almacenista que validó impresión",
    },
    id_receptor: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID de Biometria (Persona) que recibió",
    },
    qr_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "solicitudes",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["codigo_ticket"],
      },
      {
        fields: ["placa", "estado"],
      },
      {
        fields: ["id_subdependencia", "fecha_solicitud"],
      },
    ],
  }
);

Solicitud.associate = (models) => {
  Solicitud.belongsTo(models.Usuario, { foreignKey: "id_usuario", as: "Solicitante" });
  Solicitud.belongsTo(models.Usuario, { foreignKey: "id_aprobador", as: "Aprobador" });
  Solicitud.belongsTo(models.Usuario, { foreignKey: "id_almacenista", as: "Almacenista" });
  Solicitud.belongsTo(models.Usuario, { foreignKey: "id_validador", as: "Validador" });

  Solicitud.belongsTo(models.Biometria, { foreignKey: "id_receptor", as: "Receptor" });

  Solicitud.belongsTo(models.Dependencia, { foreignKey: "id_dependencia", as: "Dependencia" });
  Solicitud.belongsTo(models.Subdependencia, { foreignKey: "id_subdependencia", as: "Subdependencia" });
  Solicitud.belongsTo(models.Categoria, { foreignKey: "id_categoria" });

  Solicitud.belongsTo(models.Vehiculo, { foreignKey: "id_vehiculo" });
  Solicitud.belongsTo(models.Llenadero, { foreignKey: "id_llenadero" });
  Solicitud.belongsTo(models.TipoCombustible, { foreignKey: "id_tipo_combustible" });

  // Relación opcional con PrecioCombustible (para ventas)
  Solicitud.belongsTo(models.PrecioCombustible, { foreignKey: "id_precio" });

  // Cierre de Turno (lote al que pertenece el despacho)
  Solicitud.belongsTo(models.CierreTurno, { foreignKey: "id_cierre_turno", as: "CierreTurno" });
};

module.exports = Solicitud;
