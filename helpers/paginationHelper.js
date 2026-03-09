// src/helpers/paginationHelper.js

const { Op } = require('sequelize');

/**
 * Helper para paginar y buscar en modelos de Sequelize.
 * @param {object} model - El modelo de Sequelize sobre el que se va a consultar.
 * @param {object} reqQuery - El objeto req.query de la petición Express.
 * @param {object} options - Opciones adicionales para la consulta.
 * @param {object} options.where - Cláusula 'where' base para filtrar resultados.
 * @param {Array<string>} options.searchableFields - Campos en los que se puede buscar.
 * @returns {Promise<object>} - Un objeto con los datos y la información de paginación.
 */
async function paginate(model, reqQuery, options = {}) {
    // 1. Extraer y validar parámetros de paginación y búsqueda
    const page = parseInt(reqQuery.page, 10) || 1;
    const limit = parseInt(reqQuery.limit, 10) || 10;
    const search = reqQuery.search || '';
    const offset = (page - 1) * limit;

    // 2. Construir la consulta base de Sequelize
    const queryOptions = {
        where: options.where || {}, // Aplicar filtros base si existen
        limit,
        offset,
        ...options // Permite pasar otras opciones como 'include', 'order', etc.
    };

    // 3. Añadir lógica de búsqueda si se proporciona un término y campos de búsqueda
    if (search && options.searchableFields && options.searchableFields.length > 0) {
        // Crear una cláusula OR para buscar el término en cualquiera de los campos definidos
        // Usamos iLike para búsqueda insensible a mayúsculas/minúsculas en Postgres
        const searchClause = {
            [Op.or]: options.searchableFields.map(field => ({
                [field]: { [Op.iLike]: `%${search}%` }
            }))
        };

        // Combinar la cláusula de búsqueda con la cláusula 'where' base
        queryOptions.where = {
            [Op.and]: [
                queryOptions.where,
                searchClause
            ]
        };
    }

    // 4. Ejecutar la consulta con findAndCountAll para obtener datos y conteo total
    const { count, rows } = await model.findAndCountAll(queryOptions);

    // 5. Devolver el resultado estructurado
    return {
        data: rows,
        pagination: {
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit: limit
        }
    };
}

module.exports = { paginate };