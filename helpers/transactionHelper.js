const { sequelize } = require("../config/database");

/**
 * Ejecuta una operación dentro de una transacción de Sequelize,
 * configurando previamente la IP del cliente para que sea accesible
 * desde los triggers de auditoría de PostgreSQL.
 *
 * @param {string} clientIp - Dirección IP del cliente
 * @param {Function} callback - Función asíncrona que recibe la transacción 't'
 * @returns {Promise<any>} - El resultado de la función callback
 */
const executeTransaction = async (clientIp, callback) => {
  const t = await sequelize.transaction();
  try {
    // Configurar IP para el trigger de auditoría
    const ip = clientIp || "127.0.0.1";

    // Seteamos la variable de configuración local para esta transacción
    await sequelize.query(`SET LOCAL app.current_ip = :ip`, {
      replacements: { ip },
      transaction: t,
    });

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
  return executeTransaction(req.ip, callback);
};

module.exports = { withTransaction, executeTransaction };
