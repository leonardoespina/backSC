/**
 * Tablas que serán auditadas por el sistema de auditoría.
 * Solo las tablas listadas aquí tendrán triggers de auditoría activos.
 * El resto de tablas no generarán registros de auditoría.
 */
const TABLAS_AUDITADAS = [
    // --- 1. SEGURIDAD Y ACCESOS (CRÍTICAS) ---
    "usuarios",
    "biometria",
    "vehiculos",

    // --- 2. CONFIGURACIÓN FINANCIERA E INVENTARIO ---
    "precios_combustible",
    "cupo_base",
    "cupo_actual",
    "tanques",

    // --- 3. CATÁLOGOS DEL SISTEMA ---
    "dependencias",
    "subdependencias",
    "llenaderos",
    "tipo_combustible",
    "marcas",
    "modelos",
    "categoria",
    "monedas"
];

/**
 * Columnas específicas que deben omitirse de la auditoría para cada tabla.
 * Útil para campos pesados (blobs, templates, imágenes) o sensibles.
 */
const COLUMNAS_EXCLUIDAS = {
    "biometria": ["template"],
    "usuarios": ["password", "token_recuperacion"]
};

module.exports = { TABLAS_AUDITADAS, COLUMNAS_EXCLUIDAS };
