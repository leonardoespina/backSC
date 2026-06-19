/**
 * utils/auditHumanizer.js
 * 
 * Filtro utilitario que intercepta los registros crudos de auditoría 
 * y limpia/humaniza los JSON old_data y new_data, además de generar 
 * un resumen descriptivo del cambio.
 */

const humanizeAuditData = (record) => {
    // Clona el registro para no mutar el original de Sequelize si es una instancia
    const audit = record.toJSON ? record.toJSON() : { ...record };
    
    // Nombres de columnas internas que preferimos ignorar para no hacer ruido
    const ignoreKeys = ['fecha_registro', 'fecha_modificacion', 'changed_at', 'updatedAt', 'createdAt'];

    let resumen = "";

    if (audit.action === "INSERT") {
        resumen = `Creó un nuevo registro en ${audit.table_name}.`;
        
        // Limpiamos llaves ignoradas del new_data
        if (audit.new_data) {
            ignoreKeys.forEach(k => delete audit.new_data[k]);
        }
        
    } else if (audit.action === "DELETE") {
        resumen = `Eliminó un registro de ${audit.table_name}.`;
        
        // Limpiamos llaves ignoradas del old_data
        if (audit.old_data) {
            ignoreKeys.forEach(k => delete audit.old_data[k]);
        }
        
    } else if (audit.action === "UPDATE") {
        const oldFiltered = {};
        const newFiltered = {};
        const cambios = [];

        if (audit.old_data && audit.new_data) {
            for (const key in audit.new_data) {
                // Si la llave está en la lista de ignoradas, la saltamos
                if (ignoreKeys.includes(key)) continue;

                const valOld = audit.old_data[key];
                const valNew = audit.new_data[key];

                // Comparamos si el valor cambió realmente
                if (String(valOld) !== String(valNew)) {
                    oldFiltered[key] = valOld;
                    newFiltered[key] = valNew;
                    
                    const formatOld = valOld !== null && valOld !== undefined ? valOld : 'vacío';
                    const formatNew = valNew !== null && valNew !== undefined ? valNew : 'vacío';
                    cambios.push(`'${key}' de '${formatOld}' a '${formatNew}'`);
                }
            }
        }

        // Reemplazamos los JSON gigantes por las versiones filtradas (adelgazadas)
        audit.old_data = Object.keys(oldFiltered).length > 0 ? oldFiltered : null;
        audit.new_data = Object.keys(newFiltered).length > 0 ? newFiltered : null;

        if (cambios.length > 0) {
            resumen = `Actualizó: ${cambios.join(', ')}.`;
        } else {
            resumen = `Actualizó el registro (sin cambios relevantes rastreables).`;
        }
    }

    // Inyectar la nueva propiedad humanizada
    audit.resumen_humano = resumen;
    
    return audit;
};

module.exports = {
    humanizeAuditData
};
