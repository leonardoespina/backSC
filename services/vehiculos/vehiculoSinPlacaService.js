const VehiculoSinPlaca = require("../../models/VehiculoSinPlaca");
const { executeTransaction } = require("../../helpers/transactionHelper");

// --- FUNCIONES AUXILIARES ---

/**
 * Obtiene o crea el registro de configuración de correlativos
 */
const obtenerOcrearRegistro = async (transaction = null) => {
  const options = transaction ? { transaction } : {};
  let registro = await VehiculoSinPlaca.findByPk(1, options);

  if (!registro) {
    registro = await VehiculoSinPlaca.create(
      {
        id: 1,
        ultimo_correlativo: 53,
        prefijo: "SPMB",
      },
      options,
    );
  }

  return registro;
};

/**
 * Genera una placa a partir de un correlativo
 */
const generarPlaca = (correlativo, prefijo = "SPMB") => {
  return `${prefijo}${String(correlativo).padStart(4, "0")}`;
};

// --- SERVICIOS EXPORTADOS ---

/**
 * Obtener Último Correlativo
 */
exports.obtenerUltimoCorrelativo = async () => {
  const registro = await obtenerOcrearRegistro();
  const siguiente = registro.ultimo_correlativo + 1;

  return {
    correlativo: registro.ultimo_correlativo,
    siguiente_correlativo: siguiente,
    placaGenerada: generarPlaca(siguiente, registro.prefijo),
    prefijo: registro.prefijo,
  };
};

/**
 * Generar Siguiente Correlativo
 */
exports.generarSiguienteCorrelativo = async (clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const registro = await obtenerOcrearRegistro(t);

    const siguienteCorrelativo = registro.ultimo_correlativo + 1;

    await registro.update(
      {
        ultimo_correlativo: siguienteCorrelativo,
        fecha_actualizacion: new Date(),
      },
      { transaction: t },
    );

    return {
      correlativo: siguienteCorrelativo,
      placaGenerada: generarPlaca(siguienteCorrelativo, registro.prefijo),
      prefijo: registro.prefijo,
    };
  });
};

/**
 * Actualizar Correlativo Manualmente
 */
exports.actualizarCorrelativo = async (nuevoCorrelativo, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const registro = await obtenerOcrearRegistro(t);

    await registro.update(
      {
        ultimo_correlativo: nuevoCorrelativo,
        fecha_actualizacion: new Date(),
      },
      { transaction: t },
    );

    return {
      msg: "Correlativo actualizado exitosamente",
      correlativo: nuevoCorrelativo,
      placaGenerada: generarPlaca(nuevoCorrelativo, registro.prefijo),
      prefijo: registro.prefijo,
    };
  });
};

/**
 * Obtener Configuración Actual
 */
exports.obtenerConfiguracion = async () => {
  const registro = await VehiculoSinPlaca.findByPk(1);

  if (!registro) {
    return {
      existe: false,
      mensaje: "No existe configuración de correlativos",
      valorInicial: 53,
      prefijo: "SPMB",
    };
  } else {
    return {
      existe: true,
      ultimo_correlativo: registro.ultimo_correlativo,
      prefijo: registro.prefijo,
      fecha_actualizacion: registro.fecha_actualizacion,
    };
  }
};
