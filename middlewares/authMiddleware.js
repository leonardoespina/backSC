const jwt = require("jsonwebtoken");
const { Usuario, Dependencia } = require("../models");

const autenticarUsuario = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ msg: "No hay token, permiso denegado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CONTROL DE SESIÓN ÚNICA - Validar id_sesion contra la BD
    const usuarioBD = await Usuario.findByPk(decoded.id_usuario, {
      attributes: [
        "id_usuario",
        "id_sesion",
        "estado",
        "nombre",
        "apellido",
        "tipo_usuario",
        "rol_sistema",
        "capacidad_solicitudes",
        "id_dependencia",
        "id_subdependencia",
      ],
      include: [{ model: Dependencia, as: "Dependencia" }],
    });

    if (!usuarioBD) {
      return res.status(401).json({ msg: "Usuario no encontrado" });
    }

    if (usuarioBD.estado !== "ACTIVO") {
      return res.status(401).json({ msg: "Usuario inactivo" });
    }

    // Verificar si el ID de sesión del token coincide con el de la BD
    if (decoded.id_sesion && usuarioBD.id_sesion !== decoded.id_sesion) {
      return res.status(401).json({
        msg: "Tu sesión ha sido invalidada porque se inició sesión en otro dispositivo.",
        code: "SESSION_INVALIDATED",
      });
    }

    // Guardamos el objeto completo del usuario para tener los datos frescos (como dependencias)
    req.usuario = usuarioBD;
    next();
  } catch (error) {
    console.error("Error en authMiddleware:", error.message);
    res.status(401).json({ msg: "Token no válido" });
  }
};

const { hasPermission } = require("../utils/permissions");

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(500).json({
        msg: "Se requiere verificar el rol sin validar el token primero",
      });
    }

    if (!roles.includes(req.usuario.tipo_usuario)) {
      return res.status(403).json({
        msg: `Acceso denegado: Se requiere uno de los siguientes roles: ${roles.join(", ")}`,
      });
    }
    next();
  };
};

const authorizePermission = (permission) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(500).json({ msg: "Usuario no autenticado para verificar permisos" });
    }

    if (!hasPermission(req.usuario, permission)) {
      return res.status(403).json({
        msg: `Acceso denegado: No posees la capacidad requerida (${permission}) para realizar esta acción.`,
      });
    }

    next();
  };
};

module.exports = { autenticarUsuario, authorizeRole, authorizePermission };
