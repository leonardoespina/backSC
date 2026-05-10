/**
 * dateUtils.js
 * Utilidades para el manejo de fechas y tiempos en el sistema.
 */

/**
 * Calcula los timestamps de inicio y fin para un rango de "Día Operativo".
 * El Día Operativo comienza a las 07:00:00 del día fecha_desde
 * y termina a las 07:00:00 del día siguiente a fecha_hasta.
 * 
 * @param {string} fecha_desde Formato YYYY-MM-DD
 * @param {string} fecha_hasta Formato YYYY-MM-DD
 * @returns {{ start: string, end: string }}
 */
exports.getOperativeRange = (fecha_desde, fecha_hasta) => {
    // Inicio: 07:00:00 del día desde
    const start = `${fecha_desde} 07:00:00`;
    
    // Fin: 07:00:00 del día después del hasta
    const d = new Date(`${fecha_hasta}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const nextDay = d.toISOString().split('T')[0];
    const end = `${nextDay} 07:00:00`;
    
    return { start, end };
};
