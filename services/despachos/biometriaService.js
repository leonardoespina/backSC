const Biometria = require("../../models/Biometria");
const Categoria = require("../../models/Categoria");
const Dependencia = require("../../models/Dependencia");
const Subdependencia = require("../../models/Subdependencia");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");
const axios = require("axios");

// ============================================================================
// 🔧 CONFIGURACIÓN SIMPLE - COMENTA/DESCOMENTA SEGÚN NECESITES
// ============================================================================

// 🏠 PARA PRUEBAS LOCALES (descomenta esta línea, comenta la otra)
const BIOMETRIC_SERVICE_URL = "http://localhost:7000";

// 🌐 PARA PRODUCCIÓN/RENDER (descomenta esta línea, comenta la otra)
//const BIOMETRIC_SERVICE_URL = "https://captura-huellas-microservicio.onrender.com";

// ⚠️ IMPORTANTE: Solo una línea debe estar descomentada a la vez
// ============================================================================

console.log(
  `✅ Microservicio configurado en Servicio: ${BIOMETRIC_SERVICE_URL}`,
);

/**
 * Migración automática: mueve id_subdependencia de la tabla biometria
 * a la nueva tabla pivot biometria_subdependencias para registros existentes.
 * Se ejecuta una vez al arrancar el servidor.
 */
exports.migrarSubdependenciasExistentes = async () => {
  try {
    const { sequelize } = require("../../config/database");

    // Registros que tienen id_subdependencia antiguo pero no tienen fila en el pivot
    const [registros] = await sequelize.query(`
      SELECT b.id_biometria, b.id_subdependencia
      FROM biometria b
      WHERE b.id_subdependencia IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM biometria_subdependencias bs
          WHERE bs.id_biometria = b.id_biometria
        )
    `);

    if (registros.length === 0) {
      console.log("✅ Migración M:N biometría: no hay registros pendientes.");
      return { msg: "No hay registros pendientes para migrar", migrados: 0 };
    }

    // Insertar en la tabla pivot con timestamps
    const values = registros
      .map((r) => `(${r.id_biometria}, ${r.id_subdependencia}, NOW(), NOW())`)
      .join(", ");

    await sequelize.query(`
      INSERT INTO biometria_subdependencias (id_biometria, id_subdependencia, "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `);

    console.log(`✅ Migración M:N biometría: ${registros.length} registro(s) migrado(s) al pivot.`);
    return { msg: "Migración completada con éxito", migrados: registros.length };
  } catch (error) {
    console.error("⚠️ Migración M:N biometría falló (no crítico):", error.message);
    // Removemos el throw para que no rompa la inicialización del servidor si falla
    return { msg: "La migración falló", detalle: error.message };
  }
};

// Ejecutar migración con un pequeño delay para asegurarse de que Sequelize haya sincronizado las tablas
setTimeout(() => {
  exports.migrarSubdependenciasExistentes().catch(err => console.error(err));
}, 3000);


/**
 * Registrar o actualizar biometría
 */
exports.registrarBiometria = async (data, clientIp) => {
  const {
    id_biometria,
    cedula,
    nombre,
    rol,
    id_categoria,
    id_dependencia,
    subdependencias_ids = [],
    huellas,
  } = data;

  // Validar que se asigne al menos una subdependencia
  if (!subdependencias_ids || subdependencias_ids.length === 0) {
    throw new Error("Se requiere al menos una subdependencia asignada.");
  }

  return await executeTransaction(clientIp, async (t) => {
    let registro;

    // CASO 1: ACTUALIZACIÓN (Si viene ID)
    if (id_biometria) {
      registro = await Biometria.findByPk(id_biometria, { transaction: t });
      if (!registro) {
        throw new Error("Registro biométrico no encontrado para actualizar");
      }

      // Validar si cambió la cédula y si la nueva ya existe en otro registro
      if (cedula && cedula !== registro.cedula) {
        const cedulaExiste = await Biometria.findOne({
          where: { cedula, id_biometria: { [Op.ne]: id_biometria } },
          transaction: t,
        });
        if (cedulaExiste) {
          throw new Error(
            `La cédula ${cedula} ya está registrada por otra persona.`,
          );
        }
      }

      const updateData = {
        cedula,
        nombre,
        rol,
        id_categoria,
        id_dependencia,
        fecha_modificacion: new Date(),
      };

      // Permitir cambiar estado (activar/desactivar) en la edición
      if (data.estado !== undefined) {
        updateData.estado = data.estado;
      }

      // Actualizar huellas SOLO si se enviaron nuevas
      if (huellas && huellas.length > 0) {
        updateData.template = JSON.stringify({
          templates: huellas,
          updatedAt: new Date().toISOString(),
        });
      }

      await registro.update(updateData, { transaction: t });

      // Sincronizar subdependencias (reemplaza completamente el set anterior)
      await registro.setSubdependencias(subdependencias_ids, { transaction: t });
    } else {
      // CASO 2: CREACIÓN (Nuevo Registro)

      // Validación de Duplicados
      const existe = await Biometria.findOne({
        where: { cedula },
        transaction: t,
      });
      if (existe) {
        throw new Error(
          `La cédula ${cedula} ya posee un registro biométrico activo o inactivo.`,
        );
      }

      // Validar que vengan huellas para un registro nuevo
      if (!huellas || huellas.length === 0) {
        throw new Error(
          "Se requieren muestras de huellas para un nuevo registro.",
        );
      }

      const biometricData = JSON.stringify({
        templates: huellas,
        updatedAt: new Date().toISOString(),
      });

      registro = await Biometria.create(
        {
          cedula,
          nombre,
          rol,
          id_categoria,
          id_dependencia,
          template: biometricData,
        },
        { transaction: t },
      );

      // Asignar subdependencias al nuevo registro
      await registro.setSubdependencias(subdependencias_ids, { transaction: t });
    }

    return {
      msg: id_biometria
        ? "Registro actualizado correctamente"
        : "Identidad biométrica registrada correctamente",
      registro,
    };
  });
};

/**
 * Comparar dos huellas directamente
 */
exports.compararHuellas = async (muestra1, muestra2) => {
  if (!muestra1 || !muestra2) {
    throw new Error("Se requieren ambas muestras para comparar");
  }

  try {
    const response = await axios.post(
      `${BIOMETRIC_SERVICE_URL}/api/verify`,
      {
        probe: muestra1,
        candidate: muestra2,
      },
      {
        timeout: BIOMETRIC_SERVICE_URL.includes("localhost") ? 10000 : 30000,
        headers: { "Content-Type": "application/json" },
      },
    );

    return response.data;
  } catch (error) {
    console.error("❌ Error en comparación directa:", error.message);
    throw new Error(`Error en el servicio biométrico: ${error.message}`);
  }
};

/**
 * Verificar identidad (Matching 1:N contra templates de una persona)
 */
exports.verificarIdentidad = async (cedula, muestraActual) => {
  console.log("=== INICIO VERIFICACIÓN BIOMÉTRICA (SERVICIO) ===");
  console.log(
    "🔧 Entorno:",
    BIOMETRIC_SERVICE_URL.includes("localhost") ? "LOCAL" : "RENDER",
  );

  if (!cedula || !muestraActual) {
    throw new Error("Cédula y muestra biométrica son requeridas");
  }

  const registro = await Biometria.findOne({
    where: { cedula, estado: "ACTIVO" },
    include: [
      {
        model: Subdependencia,
        as: "Subdependencias",
        attributes: ["id_subdependencia", "nombre"],
        through: { attributes: [] }, // No incluir columnas de la tabla pivot
      },
    ],
  });

  if (!registro) {
    console.log("❌ Cédula no encontrada");
    throw new Error("Persona no registrada");
  }

  const biometricData = JSON.parse(registro.template);

  console.log(
    `🔢 Comparando contra ${biometricData.templates.length} template(s)`,
  );

  const matchPromises = biometricData.templates.map(
    async (templateGuardado, index) => {
      try {
        // console.log(`📤 Enviando comparación ${index + 1}...`);

        const response = await axios.post(
          `${BIOMETRIC_SERVICE_URL}/api/verify`,
          {
            probe: muestraActual,
            candidate: templateGuardado,
          },
          {
            timeout: BIOMETRIC_SERVICE_URL.includes("localhost")
              ? 10000
              : 30000,
            headers: { "Content-Type": "application/json" },
          },
        );

        const { match, score } = response.data;
        // console.log(`✅ Template ${index + 1} - Score: ${score}, Match: ${match}`);
        return score;
      } catch (error) {
        console.error(`❌ Error template ${index + 1}:`, error.message);
        return 0;
      }
    },
  );

  const scores = await Promise.all(matchPromises);
  const mejorScore = Math.max(...scores);
  const umbral = 40;

  console.log(`🎯 Mejor score: ${mejorScore} (umbral: ${umbral})`);

  if (mejorScore >= umbral) {
    console.log(`✅ MATCH ENCONTRADO!`);
    return {
      match: true,
      score: mejorScore,
      persona: registro,
      entorno: BIOMETRIC_SERVICE_URL.includes("localhost") ? "LOCAL" : "RENDER",
    };
  } else {
    console.log("❌ NO HAY COINCIDENCIA");
    return {
      match: false,
      msg: "La huella no coincide",
      score: mejorScore,
      entorno: BIOMETRIC_SERVICE_URL.includes("localhost") ? "LOCAL" : "RENDER",
    };
  }
};

/**
 * Obtener listado de registros paginados
 */
exports.obtenerRegistros = async (query, user) => {
  const searchableFields = ["nombre", "cedula"];
  const where = {};

  // Solo ADMIN puede ver los registros desactivados
  if (!user || user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  }

  return await paginate(Biometria, query, {
    where,
    searchableFields,
    include: [
      { model: Categoria, as: "Categoria", attributes: ["nombre"] },
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["nombre_dependencia"],
      },
      {
        model: Subdependencia,
        as: "Subdependencias",
        attributes: ["id_subdependencia", "nombre"],
        through: { attributes: [] },
      },
    ],
  });
};

/**
 * Eliminar (desactivar) registro
 */
exports.eliminarRegistro = async (id) => {
  const registro = await Biometria.findByPk(id);
  if (!registro) throw new Error("Registro no encontrado");

  // Toggle: si está ACTIVO lo desactiva, si está INACTIVO lo reactiva
  const nuevoEstado = registro.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

  await registro.update({ estado: nuevoEstado, fecha_modificacion: new Date() });

  return {
    id_biometria: id,
    estado: nuevoEstado,
    msg: nuevoEstado === "INACTIVO"
      ? "Registro biométrico desactivado"
      : "Registro biométrico reactivado",
  };
};

/**
 * Verificar conexión con microservicio
 */
exports.verificarConexionMicroservicio = async () => {
  try {
    const healthCheck = await axios.get(
      BIOMETRIC_SERVICE_URL.includes("localhost")
        ? "http://localhost:7000/health"
        : "https://captura-huellas-microservicio.onrender.com/health",
      { timeout: 5000 },
    );

    return {
      conectado: healthCheck.data === "OK",
      entorno: BIOMETRIC_SERVICE_URL.includes("localhost") ? "LOCAL" : "RENDER",
      urlBase: BIOMETRIC_SERVICE_URL,
      healthCheck: healthCheck.data,
      mensaje: "✅ Microservicio disponible",
    };
  } catch (error) {
    throw {
      conectado: false,
      entorno: BIOMETRIC_SERVICE_URL.includes("localhost") ? "LOCAL" : "RENDER",
      urlBase: BIOMETRIC_SERVICE_URL,
      error: error.message,
      mensaje: BIOMETRIC_SERVICE_URL.includes("localhost")
        ? "❌ Microservicio local no responde. Ejecuta: java -jar target\\biometric-service-1.0-SNAPSHOT.jar"
        : "❌ Microservicio en Render no disponible. Puede estar en 'cold start'.",
    };
  }
};
