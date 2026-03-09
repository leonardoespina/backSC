const usuarioService = require("../../services/administracion/usuarioService");

// --- CREAR USUARIO (Solo Admin) ---
exports.crearUsuario = async (req, res) => {
  try {
    const usuario = await usuarioService.crearUsuario(
      req.body,
      req.usuario,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("usuarios:creado", usuario);

    res.status(201).json({
      msg: "Usuario creado exitosamente",
      usuario,
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("ya está registrada")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error en el servidor" });
    }
  }
};

// --- LOGIN (Público) ---
exports.loginUsuario = async (req, res) => {
  try {
    const result = await usuarioService.loginUsuario(
      req.body,
      req.io?.activeSockets,
    );
    const { token, usuario } = result;
    res.json({ msg: "Login OK", token, usuario });
  } catch (error) {
    // Errores de negocio esperados → solo el mensaje, sin stack
    if (error.status === 409) {
      console.warn(`⚠️  Sesión activa: ${req.body?.cedula}`);
      return res.status(409).json({ msg: error.message, sesion_activa: error.sesion_activa });
    }
    if (error.status === 403) {
      console.warn(`⚠️  Acceso denegado (inactivo/bloqueado): ${req.body?.cedula}`);
      return res.status(403).json({ msg: error.message });
    }
    if (error.message?.includes("incorrectas")) {
      console.warn(`⚠️  Credenciales incorrectas: ${req.body?.cedula}`);
      return res.status(400).json({ msg: error.message });
    }
    // Error inesperado → stack trace completo
    console.error("Error inesperado en login:", error);
    res.status(500).json({ msg: "Error en el login" });
  }
};


// --- LOGOUT (Privado) ---
exports.logoutUsuario = async (req, res) => {
  try {
    const result = await usuarioService.logoutUsuario(req.usuario.id_usuario);
    res.json(result);
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({ msg: "Error al cerrar sesión" });
  }
};

// --- OBTENER USUARIOS (Solo Admin) ---
exports.obtenerUsuarios = async (req, res) => {
  try {
    const result = await usuarioService.obtenerUsuarios(req.query, req.usuario);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error obteniendo usuarios" });
  }
};

// --- ACTUALIZAR USUARIO (Solo Admin - PUT) ---
exports.actualizarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await usuarioService.actualizarUsuario(
      id,
      req.body,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("usuarios:actualizado", usuario);

    res.json({
      msg: "Usuario actualizado correctamente",
      usuario,
    });
  } catch (error) {
    console.error(error);
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("ya está registrada")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al actualizar usuario" });
    }
  }
};

// --- ELIMINAR (DESACTIVAR) USUARIO (Solo Admin - DELETE) ---
exports.desactivarUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await usuarioService.desactivarUsuario(
      id,
      req.usuario,
      req.ip,
    );

    // Notificar a clientes
    if (req.io) req.io.emit("usuarios:actualizado", usuario);

    res.json({ msg: "Usuario desactivado exitosamente (Soft Delete)" });
  } catch (error) {
    console.error(error);
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("No puedes desactivar")) {
      return res.status(400).json({ msg: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ msg: "Error al desactivar usuario" });
    }
  }
};

// --- CAMBIAR CONTRASEÑA (Propio Usuario) ---
exports.cambiarPassword = async (req, res) => {
  try {
    const result = await usuarioService.cambiarPassword(
      req.usuario.id_usuario,
      req.body,
      req.ip,
    );
    res.json(result);
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ msg: error.message });
    }
    if (error.message.includes("incorrecta")) {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: "Error al actualizar la contraseña" });
  }
};

// --- OBTENER LISTA DE ALMACENISTAS ---
exports.obtenerListaAlmacenistas = async (req, res) => {
  try {
    const result = await usuarioService.obtenerListaAlmacenistas();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener almacenistas" });
  }
};

// --- OBTENER LISTA DE CHOFERES (USUARIOS O PERSONAL) ---
exports.obtenerListaChoferes = async (req, res) => {
  try {
    const result = await usuarioService.obtenerListaChoferes();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener choferes" });
  }
};
