/**
 * Tablas que serán auditadas por el sistema de auditoría.
 * Solo las tablas listadas aquí tendrán triggers de auditoría activos.
 * El resto de tablas no generarán registros de auditoría.
 */
const TABLAS_AUDITADAS = [
    "biometria",
    "dependencias",
    "subdependencias",
    "llenaderos",
    "marcas",
    "modelos",
    "monedas",
    "precios_combustible",
    "recarga_cupo",
    "tanques",
    "tipo_combustible",
];

module.exports = { TABLAS_AUDITADAS };
