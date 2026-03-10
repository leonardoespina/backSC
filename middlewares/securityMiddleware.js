// middlewares/securityMiddleware.js

/**
 * Middleware para bloquear peticiones provenientes de herramientas 
 * de línea de comandos (como curl, wget) o clientes sin User-Agent
 * que típicamente son bots automatizados escaneando el servidor.
 */
const antiBotMiddleware = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const userAgentLower = userAgent.toLowerCase();

    // Si no hay User-Agent (Petición sospechosa/script automático), o usar herramientas CLI explícitas
    if (!userAgent || userAgentLower.includes('curl') || userAgentLower.includes('wget') || userAgentLower.includes('postman')) {

        // Ignorar en desarrollo si se desea, pero por seguridad general lo bloqueamos siempre.
        // Console log opcional para monitorear intentos de escaneo
        console.warn(`[Seguridad] Bloqueado acceso desde fuente automatizada/desconocida. IP: ${req.ip} | User-Agent: ${userAgent}`);

        return res.status(403).json({
            success: false,
            msg: "Acceso denegado: El cliente no cumple con las políticas de seguridad del servidor."
        });
    }

    // Si el User Agent parece legítimo, continuamos
    next();
};

module.exports = {
    antiBotMiddleware
};
