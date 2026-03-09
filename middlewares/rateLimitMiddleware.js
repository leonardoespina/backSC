'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// ──────────────────────────────────────────────────────────────
// POR QUÉ DOS TIPOS DE LIMITER
// ──────────────────────────────────────────────────────────────
// El middleware global en app.js se ejecuta ANTES de autenticarUsuario,
// por lo que req.usuario aún no existe → la clave siempre sería req.ip →
// dos usuarios en la misma red local compartirían el contador y uno
// bloquearía al otro.
//
// Solución:
//   ddosLimiter  → va en app.js (global, por IP, muy permisivo, solo anti-DDoS)
//   apiLimiter / criticalLimiter / creationLimiter → van POR RUTA,
//     DESPUÉS de autenticarUsuario, donde req.usuario ya existe.
// ──────────────────────────────────────────────────────────────

/** Genera la clave de rate-limit. Usa el ID de usuario si está disponible. */
const keyByUser = (req) =>
  req.usuario?.id_usuario ? `user_${req.usuario.id_usuario}` : ipKeyGenerator(req);

// ──────────────────────────────────────────────────────────────
// 1. ANTI-DDOS GLOBAL (app.js) — POR IP, MUY PERMISIVO
// ──────────────────────────────────────────────────────────────
const ddosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️  DDoS detectado - IP: ${ipKeyGenerator(req)}`);
    res.status(429).json({
      msg: 'Demasiadas peticiones desde su dirección. Intente más tarde.',
      tipo: 'RATE_LIMIT_DDOS',
    });
  },
});

// ──────────────────────────────────────────────────────────────
// 2. LOGIN — POR IP + CÉDULA (sin token aún)
// ──────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login_${ipKeyGenerator(req)}_${req.body?.cedula || ''}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️  Rate-limit LOGIN - Cédula: ${req.body?.cedula || 'N/A'}`);
    res.status(429).json({
      msg: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
      tipo: 'RATE_LIMIT_LOGIN',
      retry_after: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// ──────────────────────────────────────────────────────────────
// 3. API GENERAL — POR USUARIO (solo en rutas con auth)
// ──────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,  // 300 req/min por usuario
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️  Rate-limit API - Key: ${keyByUser(req)}, Ruta: ${req.path}`);
    res.status(429).json({
      msg: 'Demasiadas peticiones. Intente nuevamente en un momento.',
      tipo: 'RATE_LIMIT_API',
    });
  },
});

// ──────────────────────────────────────────────────────────────
// 4. OPERACIONES CRÍTICAS — POR USUARIO
// ──────────────────────────────────────────────────────────────
const criticalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,  // 30 operaciones cada 5 min por usuario
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const uid = req.usuario?.id_usuario || 'Anónimo';
    console.warn(`⚠️  Rate-limit CRÍTICO - Usuario: ${uid}, Ruta: ${req.path}`);
    res.status(429).json({
      msg: 'Ha excedido el límite de operaciones críticas. Intente en unos minutos.',
      tipo: 'RATE_LIMIT_CRITICAL',
    });
  },
});

// ──────────────────────────────────────────────────────────────
// 5. CREACIÓN DE RECURSOS — POR USUARIO
// ──────────────────────────────────────────────────────────────
const creationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,  // 50 creates cada 10 min por usuario
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const uid = req.usuario?.id_usuario || 'Anónimo';
    console.warn(`⚠️  Rate-limit CREACIÓN - Usuario: ${uid}, Ruta: ${req.path}`);
    res.status(429).json({
      msg: 'Ha alcanzado el límite de creación de recursos. Intente más tarde.',
      tipo: 'RATE_LIMIT_CREATION',
    });
  },
});

module.exports = {
  ddosLimiter,
  loginLimiter,
  apiLimiter,
  criticalLimiter,
  creationLimiter,
};
