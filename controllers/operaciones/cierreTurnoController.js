const svc = require("../../services/operaciones/cierreTurnoService");
const { CierreTurno } = require("../../models");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE SOCKET
// ─────────────────────────────────────────────────────────────────────────────
function emitCierre(io, event, payload) {
    if (io) io.emit(event, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAS AUXILIARES PARA EL FORMULARIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /cierres-turno/tanques-llenadero/:id_llenadero
 * Tanques activos del llenadero con su último nivel de cierre.
 */
exports.tanquesPorLlenadero = async (req, res) => {
    try {
        const data = await svc.obtenerTanquesLlenaderoConNivel(req.params.id_llenadero);
        res.json(data);
    } catch (error) {
        res.status(400).json({ msg: error.message });
    }
};

/**
 * GET /cierres-turno/ultimo-nivel/:id_tanque
 * Último nivel registrado en cierre para el tanque.
 */
exports.ultimoNivel = async (req, res) => {
    try {
        const data = await svc.obtenerUltimoNivel(req.params.id_tanque);
        res.json(data);
    } catch (error) {
        res.status(400).json({ msg: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR CIERRE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /cierres-turno/generar
 *
 * Validaciones previas:
 *  - No debe existir un CierreTurno PENDIENTE para el mismo llenadero.
 *
 * Emite socket:
 *  - 'cierre:creado' → todos los clientes
 */
exports.generarCierre = async (req, res) => {
    try {
        const { id_llenadero } = req.body;

        // ── Validación: cierre pendiente ─────────────────────────────
        if (id_llenadero) {
            const pendiente = await CierreTurno.findOne({
                where: { id_llenadero, estado: "PENDIENTE" },
            });
            if (pendiente) {
                return res.status(409).json({
                    msg: `Ya existe un cierre PENDIENTE (#${pendiente.id_cierre}) para este llenadero. Ciérralo antes de generar uno nuevo.`,
                    id_cierre_pendiente: pendiente.id_cierre,
                });
            }
        }

        const cierre = await svc.generarCierre(req.body, req.usuario, req.clientIp);

        // ── Emit socket ──────────────────────────────────────────────
        emitCierre(req.io, "cierre:creado", {
            id_cierre: cierre.id_cierre,
            id_llenadero: cierre.id_llenadero,
            turno: cierre.turno,
            fecha_lote: cierre.fecha_lote,
            estado: cierre.estado,
        });

        res.status(201).json({ msg: "Cierre de turno generado correctamente.", cierre });

    } catch (error) {
        res.status(400).json({ msg: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /cierres-turno
 */
exports.listarCierres = async (req, res) => {
    try {
        const result = await svc.listarCierres(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

/**
 * GET /cierres-turno/:id
 */
exports.obtenerCierre = async (req, res) => {
    try {
        const cierre = await svc.obtenerCierre(req.params.id);
        if (!cierre) return res.status(404).json({ msg: "Cierre no encontrado." });
        res.json(cierre);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

/**
 * GET /cierres-turno/:id/reporte
 */
exports.generarReporte = async (req, res) => {
    try {
        const reporte = await svc.generarReporteTurno(req.params.id);
        res.json(reporte);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

/**
 * GET /cierres-turno/:id/acta
 */
exports.generarActaTurno = async (req, res) => {
    try {
        const acta = await svc.generarActaTurno(req.params.id);
        res.json(acta);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};
