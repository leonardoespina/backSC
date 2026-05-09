const { AsyncLocalStorage } = require("async_hooks");

/**
 * Almacenamiento de contexto asíncrono para compartir datos
 * a través del ciclo de vida de una petición HTTP sin pasarlos
 * explícitamente como parámetros.
 * 
 * Útil para que el helper de transacciones (executeTransaction)
 * pueda acceder al usuario autenticado SIN necesidad de que
 * cada servicio lo pase manualmente como parámetro.
 * 
 * Uso:
 *   const context = new RequestContext();
 *   context.run({ usuario, ip }, () => {
 *     // Dentro de este callback, executeTransaction
 *     // podrá acceder al usuario automáticamente
 *     miServicio.hacerAlgo();
 *   });
 */
class RequestContext {
    constructor() {
        this.storage = new AsyncLocalStorage();
    }

    /**
     * Ejecuta una función dentro del contexto asíncrono
     * @param {Object} data - { usuario, ip }
     * @param {Function} fn - Función a ejecutar
     */
    run(data, fn) {
        return this.storage.run(data, fn);
    }

    /**
     * Obtiene el contexto actual
     */
    get() {
        return this.storage.getStore();
    }

    /**
     * Middleware de Express para capturar el contexto de cada request
     */
    middleware() {
        return (req, res, next) => {
            const data = {
                ip: req.ip || req.connection?.remoteAddress || "127.0.0.1",
                usuario: req.usuario || null,
            };
            this.run(data, next);
        };
    }
}

// Singleton
const requestContext = new RequestContext();

module.exports = requestContext;
