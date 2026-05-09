/**
 * Middleware para identificar el origen de la solicitud (Gateway).
 * 
 * Determina si la petición entra por:
 * 1. IP Pública (Directo)
 * 2. Túnel Personalizado (Cloudflare/lespina.info)
 * 3. Red Local (VPN/LAN 10.60 o 10.80)
 */

// Parámetros de red cargados desde .env con valores por defecto de seguridad
const INTERNAL_NETWORKS = (process.env.INTERNAL_NETWORKS || '10.60,10.80').split(',').map(s => s.trim());
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'combustible.lespina.info';
const PUBLIC_GATEWAY_IP = process.env.PUBLIC_GATEWAY_IP || '201.249.162.214';

const originMiddleware = (req, res, next) => {
    const host = req.headers.host || '';
    const ip = req.ip || '';
    
    // Normalizar IP (quitar prefijos de IPv6 y espacios)
    const clientIp = ip.replace(/^.*:/, '').trim();

    let gateway = 'EXTERNO';
    let isInternal = false;

    // 1. Detección Inteligente de Red Local (VPN/LAN)
    const matchesInternal = INTERNAL_NETWORKS.some(segment => clientIp.startsWith(segment));
    
    if (matchesInternal || clientIp === '127.0.0.1' || clientIp === 'localhost') {
        gateway = 'LOCAL';
        isInternal = true;
    }
    // 2. Detección de Túnel (Prioriza encabezados de Cloudflare si existen)
    else if (host.includes(TUNNEL_DOMAIN) || req.headers['cf-ray'] || req.headers['cf-connecting-ip']) {
        gateway = 'TUNNEL';
    }
    // 3. Detección de IP Pública Directa
    else if (host.includes(PUBLIC_GATEWAY_IP) || clientIp === PUBLIC_GATEWAY_IP) {
        gateway = 'PUBLIC_IP';
    }

    // Adjuntar metadatos de origen a la petición
    req.gateway = gateway;
    req.isInternal = isInternal;
    req.clientIp = clientIp;

    // Logging preventivo en desarrollo
    if (process.env.NODE_ENV === 'development') {
        console.log(`[SmartGateway] ${gateway} | IP: ${clientIp} | Host: ${host} | Internal: ${isInternal}`);
    }

    next();
};

/**
 * Helper para verificar si una IP pertenece a un segmento permitido.
 * @param {string} clientIp - IP del cliente.
 * @param {string|string[]} segments - Segmento(s) a comparar (ej: '10.60', '201.249').
 */
const isIpInSegment = (clientIp, segments) => {
    if (!clientIp || !segments) return false;
    const allowed = Array.isArray(segments) ? segments : segments.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.some(segment => clientIp.includes(segment));
};

/**
 * Valida si el origen de la solicitud coincide con la configuración del llenadero.
 * @param {Object} llenadero - Objeto del llenadero (debe tener direccion_ip).
 * @param {string} clientIp - IP detectada del cliente.
 * @param {string} gateway - Gateway detectado (req.gateway).
 * @throws {Error} Si el origen no es válido.
 */
const validateLlenaderoOrigin = (llenadero, clientIp, gateway) => {
    if (!llenadero) return; // Si no hay llenadero, no podemos validar

    const configIp = llenadero.direccion_ip;
    if (!configIp) {
        console.warn(`[Seguridad] Llenadero '${llenadero.nombre_llenadero}' no tiene IP configurada. Bypass.`);
        return;
    }

    // Si es local, validamos segmento
    if (gateway === 'LOCAL') {
        if (!isIpInSegment(clientIp, configIp)) {
            const error = new Error(`Seguridad Llenadero: Esta terminal (IP: ${clientIp}) no está autorizada para operar en '${llenadero.nombre_llenadero}'.`);
            error.status = 403;
            throw error;
        }
    } 
    // Si viene por túnel o IP pública, podríamos aplicar reglas adicionales
    // por ahora permitimos si el segmento coincide (ej. si la IP pública está permitida)
    else {
        if (!isIpInSegment(clientIp, configIp)) {
             // Si el llenadero está configurado con un segmento 10.x, pero la petición es EXTERNA,
             // bloqueamos a menos que se permita explícitamente el gateway.
             const error = new Error(`Acceso Remoto Bloqueado: El llenadero '${llenadero.nombre_llenadero}' solo permite operaciones desde su red local (${configIp}). Origen detectado: ${gateway} (${clientIp}).`);
             error.status = 403;
             throw error;
        }
    }
};

module.exports = {
    originMiddleware,
    isIpInSegment,
    validateLlenaderoOrigin
};
