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
    "tipo_combustible",
];

/**
 * Columnas específicas que deben omitirse de la auditoría para cada tabla.
 * Útil para campos pesados (blobs, templates, imágenes) o sensibles.
 */
const COLUMNAS_EXCLUIDAS = {
    "biometria": ["template"],
};

module.exports = { TABLAS_AUDITADAS, COLUMNAS_EXCLUIDAS };
