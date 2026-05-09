const { Auditoria } = require("../models");
const { Op } = require("sequelize");

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

/**
 * Obtiene los registros de auditoría paginados y con filtros.
 * 
 * Parámetros de consulta (query params):
 *   @param {string}  table_name   - Filtrar por nombre de tabla
 *   @param {string}  action       - Filtrar por acción (INSERT, UPDATE, DELETE)
 *   @param {number}  user_id      - Filtrar por ID de usuario
 *   @param {string}  user_name    - Filtrar por nombre de usuario (búsqueda parcial)
 *   @param {string}  record_id    - Filtrar por ID del registro afectado
 *   @param {string}  fecha_desde  - Fecha inicio (YYYY-MM-DD) 
 *   @param {string}  fecha_hasta  - Fecha fin (YYYY-MM-DD)
 *   @param {string}  search       - Búsqueda libre en old_data y new_data (JSONB)
 *   @param {number}  page         - Número de página (default: 1)
 *   @param {number}  page_size    - Registros por página (default: 50, max: 200)
 * 
 * @param {Request} req
 * @param {Response} res
 */
const obtenerRegistros = async (req, res) => {
    try {
        const {
            table_name,
            action,
            user_id,
            user_name,
            record_id,
            fecha_desde,
            fecha_hasta,
            search,
            order_by = "changed_at",
            order_dir = "DESC",
            page = 1,
            page_size = 50,
        } = req.query;

        // Construir filtros dinámicamente
        const where = {};

        if (table_name) {
            where.table_name = table_name;
        }

        if (action) {
            where.action = action.toUpperCase();
        }

        if (user_id) {
            where.user_id = parseInt(user_id, 10);
        }

        if (user_name) {
            where.user_name = { [Op.iLike]: `%${user_name}%` };
        }

        if (record_id) {
            where.record_id = record_id;
        }

        // Filtro por rango de fechas
        if (fecha_desde || fecha_hasta) {
            where.changed_at = {};
            if (fecha_desde) {
                where.changed_at[Op.gte] = new Date(fecha_desde);
            }
            if (fecha_hasta) {
                // Si solo es fecha (YYYY-MM-DD), agregamos hasta fin del día
                const hasta = fecha_hasta.length <= 10
                    ? new Date(fecha_hasta + 'T23:59:59.999Z')
                    : new Date(fecha_hasta);
                where.changed_at[Op.lte] = hasta;
            }
        }

        // Validar ordenamiento permitido
        const allowedOrderFields = ["changed_at", "table_name", "action", "user_name", "record_id"];
        const orderField = allowedOrderFields.includes(order_by) ? order_by : "changed_at";
        const orderDirection = order_dir.toUpperCase() === "ASC" ? "ASC" : "DESC";

        // Calcular paginación
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(page_size, 10) || 50));
        const offset = (pageNum - 1) * pageSize;

        // Consulta
        const { count, rows } = await Auditoria.findAndCountAll({
            where,
            order: [[orderField, orderDirection]],
            limit: pageSize,
            offset,
            attributes: [
                "id",
                "table_name",
                "action",
                "record_id",
                "record_pk",
                "user_id",
                "user_name",
                "ip_address",
                "changed_at",
            ],
        });

        return res.status(200).json({
            success: true,
            data: {
                registros: rows,
                paginacion: {
                    total: count,
                    page: pageNum,
                    page_size: pageSize,
                    total_pages: Math.ceil(count / pageSize),
                },
            },
        });
    } catch (error) {
        console.error("Error al obtener registros de auditoría:", error);
        return res.status(500).json({
            success: false,
            message: "Error al consultar auditoría",
            error: error.message,
        });
    }
};

/**
 * Obtiene el detalle completo de un registro de auditoría (incluyendo JSON de datos).
 * 
 * @param {Request} req
 * @param {Response} res
 */
const obtenerDetalle = async (req, res) => {
    try {
        const { id } = req.params;

        const registro = await Auditoria.findByPk(id);

        if (!registro) {
            return res.status(404).json({
                success: false,
                message: "Registro de auditoría no encontrado",
            });
        }

        return res.status(200).json({
            success: true,
            data: registro,
        });
    } catch (error) {
        console.error("Error al obtener detalle de auditoría:", error);
        return res.status(500).json({
            success: false,
            message: "Error al consultar auditoría",
            error: error.message,
        });
    }
};

/**
 * Obtiene estadísticas/resumen de actividad.
 * 
 * Parámetros de consulta:
 *   @param {string} fecha_desde - Fecha inicio
 *   @param {string} fecha_hasta - Fecha fin
 * 
 * @param {Request} req
 * @param {Response} res
 */
const obtenerEstadisticas = async (req, res) => {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        // Filtro de fechas para las estadísticas
        const whereFecha = {};
        if (fecha_desde || fecha_hasta) {
            whereFecha.changed_at = {};
            if (fecha_desde) whereFecha.changed_at[Op.gte] = new Date(fecha_desde);
            if (fecha_hasta) {
                const hasta = fecha_hasta.length <= 10
                    ? new Date(fecha_hasta + 'T23:59:59.999Z')
                    : new Date(fecha_hasta);
                whereFecha.changed_at[Op.lte] = hasta;
            }
        }

        // Estadística 1: Conteo por tabla
        const { sequelize } = require("../models");
        const { QueryTypes } = require("sequelize");

        const whereFechaClause = fecha_desde || fecha_hasta ? 'WHERE changed_at BETWEEN :fecha_desde AND :fecha_hasta' : '';
        const whereParams = {};
        if (fecha_desde) whereParams.fecha_desde = new Date(fecha_desde);
        if (fecha_hasta) {
            whereParams.fecha_hasta = fecha_hasta.length <= 10
                ? new Date(fecha_hasta + 'T23:59:59.999Z')
                : new Date(fecha_hasta);
        }

        // Usar consulta raw para mejor performance con agrupaciones
        const statsPorTabla = await sequelize.query(
            `SELECT table_name, action, COUNT(*) as cantidad
       FROM auditorias
       ${whereFechaClause ? `WHERE changed_at BETWEEN :fecha_desde AND :fecha_hasta` : ''}
       GROUP BY table_name, action
       ORDER BY cantidad DESC
       LIMIT 30`,
            {
                replacements: whereParams,
                type: QueryTypes.SELECT,
            }
        );

        // Estadística 2: Top usuarios más activos
        const topUsuarios = await sequelize.query(
            `SELECT user_id, user_name, COUNT(*) as cantidad_acciones
       FROM auditorias
       ${whereFechaClause ? `WHERE changed_at BETWEEN :fecha_desde AND :fecha_hasta` : ''}
       GROUP BY user_id, user_name
       ORDER BY cantidad_acciones DESC
       LIMIT 10`,
            {
                replacements: whereParams,
                type: QueryTypes.SELECT,
            }
        );

        // Estadística 3: Actividad por día (últimos 30 días)
        const actividadDiaria = await sequelize.query(
            `SELECT DATE(changed_at) as fecha, COUNT(*) as cantidad
       FROM auditorias
       WHERE changed_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(changed_at)
       ORDER BY fecha DESC`,
            {
                type: QueryTypes.SELECT,
            }
        );

        // Estadística 4: Totales globales
        const totales = await sequelize.query(
            `SELECT 
         COUNT(*) as total_registros,
         COUNT(DISTINCT table_name) as tablas_afectadas,
         COUNT(DISTINCT user_id) as usuarios_activos,
         MIN(changed_at) as primer_registro,
         MAX(changed_at) as ultimo_registro
       FROM auditorias
       ${whereFechaClause ? `WHERE changed_at BETWEEN :fecha_desde AND :fecha_hasta` : ''}`,
            {
                replacements: whereParams,
                type: QueryTypes.SELECT,
            }
        );

        return res.status(200).json({
            success: true,
            data: {
                totales: totales[0] || {},
                por_tabla: statsPorTabla,
                top_usuarios: topUsuarios,
                actividad_diaria: actividadDiaria,
            },
        });
    } catch (error) {
        console.error("Error al obtener estadísticas de auditoría:", error);
        return res.status(500).json({
            success: false,
            message: "Error al consultar estadísticas de auditoría",
            error: error.message,
        });
    }
};

module.exports = {
    obtenerRegistros,
    obtenerDetalle,
    obtenerEstadisticas,
};
