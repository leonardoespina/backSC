const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Usuario = sequelize.define(
  "Usuario",
  {
    // Mapeo exacto a tu PK 'id_usuario'
    id_usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo_usuario: {
      type: DataTypes.ENUM(
        "ADMIN",
        "GERENTE",
        "JEFE DIVISION",
        "SUPERVISOR",
        "COORDINADOR",
        "INSPECTOR",
        "ALMACENISTA",
      ),
      allowNull: false,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    apellido: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cedula: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: false,
    },
    aprobado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Nuevas columnas para el sistema RBAC
    rol_sistema: {
      type: DataTypes.ENUM(
        "ADMIN",
        "ESTANDAR",
        "ALMACEN",
        "SEGURIDAD",
        "INSPECTOR",
        "PRESIDENCIA"
      ),
      allowNull: false,
      defaultValue: "ESTANDAR",
    },
    capacidad_solicitudes: {
      type: DataTypes.ENUM("SOLICITANTE", "APROBADOR", "AMBOS", "NINGUNO"),
      allowNull: false,
      defaultValue: "SOLICITANTE",
    },
    password: {
      // Campo nuevo que agregamos con el ALTER TABLE
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("ACTIVO", "INACTIVO"),
      defaultValue: "ACTIVO",
    },
    // Tus campos de fecha personalizados
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    ultimo_acceso: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fecha_modificacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    registrado_por: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_dependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_subdependencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_sesion: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "ID de sesión único para control de acceso único por cuenta",
    },
  },
  {
    tableName: "usuarios", // Forzamos el nombre de tu tabla existente
    timestamps: false, // No usamos createdAt/updatedAt de Sequelize
  },
);

// Método para quitar el password al devolver JSON
Usuario.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

Usuario.associate = (models) => {
  Usuario.belongsTo(models.Categoria, {
    foreignKey: "id_categoria",
    as: "Categoria",
  });
  Usuario.belongsTo(models.Dependencia, {
    foreignKey: "id_dependencia",
    as: "Dependencia",
  });
  Usuario.belongsTo(models.Subdependencia, {
    foreignKey: "id_subdependencia",
    as: "Subdependencia",
  });

  Usuario.hasMany(models.RecargaCupo, { foreignKey: "autorizado_por" });
};

module.exports = Usuario;
