const { Op } = require("sequelize");

/**
 * Helper para obtener datos jerárquicos con soporte para Lazy Loading y Búsqueda Profunda.
 * 
 * @param {Array} levels - Configuración de niveles jerárquicos.
 *   Ejemplo: [
 *     { model: Categoria, alias: 'Dependencias', type: 'categoria', searchFields: ['nombre'] },
 *     { model: Dependencia, alias: 'Subdependencias', foreignKey: 'id_categoria', type: 'dependencia' }
 *   ]
 * @param {Object} query - Objeto req.query (search, type, parentId, page, limit).
 * @param {Object} options - Opciones adicionales (ej: { rootWhere: { estado: 'ACTIVO' } }).
 */
exports.getHierarchy = async (levels, query, options = {}) => {
  const { search, type, parentId, page = 1, limit = 10 } = query;
  const { rootWhere = {} } = options;
  const offset = (page - 1) * limit;

  // ============================================================
  // MODO 1: BÚSQUEDA (Retorna estructura de árbol filtrada)
  // ============================================================
  if (search) {
    const rootLevel = levels[0];
    
    // Construir includes anidados dinámicamente
    const include = [];
    let currentIncludeLevel = include;

    // Iteramos desde el segundo nivel (hijos) hacia abajo
    for (let i = 1; i < levels.length; i++) {
      const level = levels[i];
      const inc = {
        model: level.model,
        as: level.alias, // Debe coincidir con associations.js
        required: false, // LEFT JOIN para traer padres aunque no tengan hijos
        where: level.where || {}, // Aplicar filtros de nivel (ej: estatus ACTIVO)
        include: []
      };
      
      currentIncludeLevel.push(inc);
      // El siguiente nivel se anidará dentro de este include
      currentIncludeLevel = inc.include;
    }

    // Configurar filtro de búsqueda en el nivel raíz
    const where = { ...rootWhere, ...(rootLevel.where || {}) };
    const searchFields = rootLevel.searchFields || ['nombre'];
    
    if (searchFields.length > 0) {
      where[Op.or] = searchFields.map(field => ({
        [field]: { [Op.iLike]: `%${search}%` } // iLike para case-insensitive en Postgres
      }));
    }

    const { count, rows } = await rootLevel.model.findAndCountAll({
      where,
      include,
      distinct: true, // Importante para contar filas raíz correctas con includes
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return {
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // ============================================================
  // MODO 2: LAZY LOADING (Navegación por niveles)
  // ============================================================
  
  // Determinar el nivel actual basado en 'type' y 'parentId'
  // Si no se envían, asumimos que se busca el nivel raíz (índice 0)
  let currentLevelIndex = 0;

  if (type && parentId) {
    // Buscamos el índice del tipo actual y avanzamos al siguiente nivel (sus hijos)
    const typeIndex = levels.findIndex(l => l.type === type);
    if (typeIndex !== -1 && typeIndex < levels.length - 1) {
      currentLevelIndex = typeIndex + 1;
    } else {
      // Si es el último nivel o tipo desconocido, retornamos vacío
      return { data: [], pagination: { totalItems: 0, totalPages: 0 } };
    }
  }

  const currentLevel = levels[currentLevelIndex];
  const where = { ...(currentLevel.where || {}) };

  // Si es nivel raíz, aplicamos filtros base adicionales (opcional, prioridad a rootWhere)
  if (currentLevelIndex === 0) {
    Object.assign(where, rootWhere);
  } else {
    // Si es un nivel hijo, filtramos por la FK del padre
    where[currentLevel.foreignKey] = parentId;
  }

  const { count, rows } = await currentLevel.model.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    data: rows,
    pagination: {
      totalItems: count,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};
