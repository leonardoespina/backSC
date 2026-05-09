const { sequelize } = require("../config/database");
const requestContext = require("./requestContext");

/**
 * Obtiene la info del usuario desde el contexto asíncrono (AsyncLocalStorage)
 * que fue establecido por authMiddleware, SIN necesidad de pasarlo como parámetro.
 */
function getUserInfoFromContext() {
  const ctx = requestContext.get();
  if (!ctx || !ctx.usuario) return null;
  const u = ctx.usuario;
  return {
    id_usuario: u.id_usuario,
    nombre_completo: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo || 'Desconocido',
  };
}

/**
 * Configura las variables de sesión PostgreSQL (app.current_ip, app.current_user_id, app.current_user_name)
 * para que el trigger de auditoría (audit_trigger_func) las capture.
 *
 * El usuario se obtiene AUTOMÁTICAMENTE del contexto asíncrono (AsyncLocalStorage),
 * por lo que los servicios NO necesitan modificarse para que la auditoría funcione.
 *
 * @param {Object} t - Transacción de Sequelize
 * @param {string} ip - Dirección IP
 * @param {Object|null} userInfo - (opcional) Información del usuario
 */
async function setAuditContext(t, ip, userInfo) {
  await sequelize.query(`SET LOCAL app.current_ip = :ip`, {
    replacements: { ip: ip || "127.0.0.1" },
    transaction: t,
  });

  // Determinar el usuario: 1) explícito, 2) desde contexto, 3) null
  const finalUserInfo = userInfo || getUserInfoFromContext();

  if (finalUserInfo && finalUserInfo.id_usuario) {
    await sequelize.query(`SET LOCAL app.current_user_id = :userId`, {
      replacements: { userId: String(finalUserInfo.id_usuario) },
      transaction: t,
    });
    await sequelize.query(`SET LOCAL app.current_user_name = :userName`, {
      replacements: { userName: finalUserInfo.nombre_completo || 'Desconocido' },
      transaction: t,
    });
  }
}

/**
 * Ejecuta una operación dentro de una transacción de Sequelize,
 * configurando previamente la IP del cliente y datos del usuario
 * para que sean accesibles desde los triggers de auditoría de PostgreSQL.
 *
 * El usuario se obtiene AUTOMÁTICAMENTE del contexto de la request
 * (AsyncLocalStorage seteado por authMiddleware), por lo que
 * TODOS los servicios existentes que llaman:
 *   executeTransaction(clientIp, callback)
 * YA ESTÁN CUBIERTOS sin necesidad de modificar nada.
 *
 * @param {string} clientIp - Dirección IP del cliente
 * @param {Function} callback - Función asíncrona que recibe la transacción 't'
 * @param {Object|null} userInfo - (OPCIONAL) Información del usuario { id_usuario, nombre_completo }
 * @returns {Promise<any>} - El resultado de la función callback
 */
const executeTransaction = async (clientIp, callback, userInfo = null) => {
  const t = await sequelize.transaction();
  try {
    await setAuditContext(t, clientIp, userInfo);

    // Ejecutamos la lógica pasando la transacción
    const result = await callback(t);

    await t.commit();
    return result;
  } catch (error) {
    if (!t.finished) await t.rollback();
    throw error;
  }
};

/**
 * Wrapper para mantener compatibilidad con controladores que pasan req
 * @deprecated Preferir usar executeTransaction directamente en servicios
 */
const withTransaction = async (req, callback) => {
  const userInfo = req.usuario ? {
    id_usuario: req.usuario.id_usuario,
    nombre_completo: `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || req.usuario.correo || 'Desconocido'
  } : null;
  return executeTransaction(req.ip, callback, userInfo);
};

module.exports = { withTransaction, executeTransaction };
