const Usuario = require("../../models/Usuario");
const Categoria = require("../../models/Categoria");
const Dependencia = require("../../models/Dependencia");
const Subdependencia = require("../../models/Subdependencia");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Usuario
 */
exports.crearUsuario = async (data, adminUser, clientIp) => {
  const {
    nombre,
    apellido,
    cedula,
    password,
    tipo_usuario,
    rol_sistema,
    capacidad_solicitudes,
    id_categoria,
    id_dependencia,
    id_subdependencia,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    // 1. Verificar Cédula Duplicada
    const existe = await Usuario.findOne({
      where: { cedula },
      transaction: t,
    });
    if (existe) {
      throw new Error("La cédula ya está registrada");
    }

    // 2. Hashear Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Guardar en BD
    const usuario = await Usuario.create(
      {
        nombre,
        apellido,
        cedula,
        password: hashedPassword,
        tipo_usuario: tipo_usuario || "INSPECTOR",
        rol_sistema: rol_sistema || "ESTANDAR",
        capacidad_solicitudes: capacidad_solicitudes || "SOLICITANTE",
        registrado_por: adminUser.id_usuario,
        fecha_registro: new Date(),
        estado: "ACTIVO",
        id_categoria,
        id_dependencia,
        id_subdependencia,
      },
      { transaction: t },
    );

    return usuario;
  });
};

/**
 * Login Usuario
 */
exports.loginUsuario = async (data, activeSocketsMap) => {
  const { cedula, password } = data; // Eliminamos 'forzar'

  const usuario = await Usuario.findOne({
    where: { cedula },
    include: [
      { model: Dependencia, as: "Dependencia" },
      { model: Subdependencia, as: "Subdependencia" }
    ],
  });

  if (!usuario) {
    throw new Error("Credenciales incorrectas (Cédula)");
  }
  if (usuario.estado !== "ACTIVO") {
    const error = new Error("Usuario Inactivo");
    error.status = 403;
    throw error;
  }

  // Verificar si la dependencia o subdependencia están inactivas (Solo para NO administradores)
  if (usuario.tipo_usuario !== "ADMIN") {
    if (usuario.Dependencia && usuario.Dependencia.estatus !== "ACTIVO") {
      const error = new Error("Acceso denegado: La Dependencia asociada está inactiva.");
      error.status = 403;
      throw error;
    }

    if (usuario.Subdependencia && usuario.Subdependencia.estatus !== "ACTIVO") {
      const error = new Error("Acceso denegado: La Subdependencia asociada está inactiva.");
      error.status = 403;
      throw error;
    }
  }

  const isMatch = await bcrypt.compare(password, usuario.password);
  if (!isMatch) {
    throw new Error("Credenciales incorrectas (Password)");
  }

  // RESTRICCIÓN DE SESIÓN ÚNICA BASADA EN SOCKETS
  const userId = Number(usuario.id_usuario);
  const userSockets = activeSocketsMap?.get(userId);
  const activeCount = userSockets ? userSockets.size : 0;

  console.log(
    `[DEBUG Login] Intentando Login Usuario ID: ${userId} (${usuario.cedula})`,
  );
  console.log(
    `[DEBUG Login] Sockets activos encontrados para este ID: ${activeCount}`,
  );

  if (userSockets) {
    console.log(`[DEBUG Login] Socket IDs actuales:`, Array.from(userSockets));
  }

  if (activeCount >= 2) {
    const error = new Error(
      `Sesión activa: Esta cuenta (ID: ${userId}) ya tiene múltiples dispositivos o pestañas abiertas. Por seguridad, cierra las sesiones activas antes de entrar aquí.`,
    );
    error.status = 409;
    error.sesion_activa = true;
    throw error;
  }

  // Generar un ID de sesión único para esta nueva conexión
  const nuevoIdSesion = crypto.randomUUID();

  await usuario.update({
    ultimo_acceso: new Date(),
    id_sesion: nuevoIdSesion,
  });

  const payload = {
    id_usuario: usuario.id_usuario,
    tipo_usuario: usuario.tipo_usuario,
    nombre: usuario.nombre,
    id_sesion: nuevoIdSesion,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  // needExpel siempre es false porque no permitimos forzar el login
  return { token, usuario, needExpel: false };
};

/**
 * Logout
 */
exports.logoutUsuario = async (userId) => {
  await Usuario.update({ id_sesion: null }, { where: { id_usuario: userId } });
  return { msg: "Sesión cerrada correctamente" };
};

/**
 * Obtener Usuarios (Paginado)
 */
exports.obtenerUsuarios = async (query, user) => {
  const searchableFields = ["nombre", "apellido", "cedula"];
  const where = {};

  if (!user || user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  return await paginate(Usuario, query, {
    where,
    searchableFields,
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Categoria,
        as: "Categoria",
        attributes: ["id_categoria", "nombre"],
      },
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["id_dependencia", "nombre_dependencia"],
      },
      {
        model: Subdependencia,
        as: "Subdependencia",
        attributes: ["id_subdependencia", "nombre"],
      },
    ],
  });
};

/**
 * Actualizar Usuario
 */
exports.actualizarUsuario = async (id, data, clientIp) => {
  const { password, cedula, ...restoDatos } = data;

  return await executeTransaction(clientIp, async (t) => {
    let usuario = await Usuario.findByPk(id, { transaction: t });
    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    if (cedula && cedula !== usuario.cedula) {
      const cedulaExiste = await Usuario.findOne({
        where: {
          cedula,
          id_usuario: { [Op.ne]: id },
        },
        transaction: t,
      });
      if (cedulaExiste) {
        throw new Error("La cédula ya está registrada por otro usuario");
      }
      usuario.cedula = cedula;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      usuario.password = await bcrypt.hash(password, salt);
    }

    Object.assign(usuario, restoDatos);
    usuario.fecha_modificacion = new Date();

    await usuario.save({ transaction: t });

    return usuario;
  });
};

/**
 * Desactivar Usuario
 */
exports.desactivarUsuario = async (id, currentUser, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const usuario = await Usuario.findByPk(id, { transaction: t });

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    if (usuario.id_usuario === currentUser.id_usuario) {
      throw new Error("No puedes desactivar tu propio usuario administrador");
    }

    await usuario.update(
      {
        estado: "INACTIVO",
        fecha_modificacion: new Date(),
      },
      { transaction: t },
    );

    return usuario;
  });
};

/**
 * Cambiar Password
 */
exports.cambiarPassword = async (userId, data, clientIp) => {
  const { passwordActual, nuevaPassword } = data;

  return await executeTransaction(clientIp, async (t) => {
    const usuario = await Usuario.findByPk(userId, { transaction: t });
    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    const isMatch = await bcrypt.compare(passwordActual, usuario.password);
    if (!isMatch) {
      throw new Error("La contraseña actual es incorrecta");
    }

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(nuevaPassword, salt);
    usuario.id_sesion = null;

    await usuario.save({ transaction: t });

    return {
      msg: "Contraseña actualizada exitosamente. Por seguridad, su sesión ha sido cerrada.",
    };
  });
};

/**
 * Listar Almacenistas
 */
exports.obtenerListaAlmacenistas = async () => {
  const usuarios = await Usuario.findAll({
    where: { estado: "ACTIVO", tipo_usuario: "ALMACENISTA" },
    attributes: ["id_usuario", "nombre", "apellido", "cedula"],
    order: [["nombre", "ASC"]],
  });

  return usuarios.map((u) => ({
    id_almacenista: u.id_usuario,
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    cedula: u.cedula,
  }));
};

/**
 * Listar Choferes
 */
exports.obtenerListaChoferes = async () => {
  const usuarios = await Usuario.findAll({
    where: { estado: "ACTIVO" },
    attributes: ["id_usuario", "nombre", "apellido", "cedula"],
    order: [["nombre", "ASC"]],
  });

  return usuarios.map((u) => ({
    id_chofer: u.id_usuario,
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    cedula: u.cedula,
  }));
};
