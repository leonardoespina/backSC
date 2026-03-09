const {
  Vehiculo,
  Marca,
  Modelo,
  Categoria,
  Dependencia,
  Subdependencia,
  TipoCombustible,
} = require("../../models");
const vehiculoSinPlacaService = require("./vehiculoSinPlacaService");
const { paginate } = require("../../helpers/paginationHelper");
const { executeTransaction } = require("../../helpers/transactionHelper");
const { Op } = require("sequelize");

/**
 * Crear Vehículo
 */
exports.crearVehiculo = async (data, user, clientIp) => {
  const {
    placa,
    es_sin_placa,
    id_marca,
    id_modelo,
    id_categoria,
    id_dependencia,
    id_subdependencia,
    es_generador,
    es_planta,
    id_tipo_combustible,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    let placaFinal = placa;

    // Si es vehículo sin placa, generar el correlativo usando el servicio correspondiente
    if (es_sin_placa) {
      const resultCorrelativo =
        await vehiculoSinPlacaService.generarSiguienteCorrelativo(clientIp);
      placaFinal = resultCorrelativo.placaGenerada;
    }

    // 1. Validar duplicado de placa
    const vehiculoExistente = await Vehiculo.findOne({
      where: { placa: placaFinal },
      transaction: t,
    });
    if (vehiculoExistente) {
      throw new Error(`La placa/código ${placaFinal} ya está registrada.`);
    }

    // 2. Validar consistencia Modelo/Marca
    const modelo = await Modelo.findOne({
      where: { id_modelo, id_marca },
      transaction: t,
    });
    if (!modelo) {
      throw new Error(
        "El modelo seleccionado no pertenece a la marca indicada",
      );
    }

    // 3. Validar Tipo de Combustible
    const combustible = await TipoCombustible.findByPk(id_tipo_combustible, {
      transaction: t,
    });
    if (!combustible) {
      throw new Error("El tipo de combustible no es válido");
    }

    // 4. Crear registro
    const vehiculo = await Vehiculo.create(
      {
        placa: placaFinal,
        id_marca,
        id_modelo,
        id_categoria,
        id_dependencia,
        id_subdependencia: id_subdependencia || null,
        id_tipo_combustible,
        es_generador: es_generador || false,
        es_planta: es_planta || false,
        registrado_por: user.id_usuario,
        fecha_registro: new Date(),
        fecha_modificacion: new Date(),
        estado: "ACTIVO",
      },
      { transaction: t },
    );

    return {
      vehiculo,
      placaGenerada: es_sin_placa ? placaFinal : undefined,
    };
  });
};

/**
 * Obtener Vehículos (Paginado)
 */
exports.obtenerVehiculos = async (query, user) => {
  const {
    id_categoria,
    id_dependencia,
    id_subdependencia,
    id_tipo_combustible,
    es_generador,
    es_planta,
    estado,
  } = query;

  const searchableFields = ["placa"];
  const where = {};

  if (id_categoria) where.id_categoria = id_categoria;
  if (id_dependencia) where.id_dependencia = id_dependencia;
  if (id_subdependencia) where.id_subdependencia = id_subdependencia;
  if (id_tipo_combustible) where.id_tipo_combustible = id_tipo_combustible;
  if (es_generador !== undefined) where.es_generador = es_generador === "true";
  if (es_planta !== undefined) where.es_planta = es_planta === "true";

  if (user && user.tipo_usuario !== "ADMIN") {
    where.estado = "ACTIVO";
  } else if (estado) {
    where.estado = estado;
  }

  return await paginate(Vehiculo, query, {
    where,
    searchableFields,
    include: [
      { model: Marca, as: "Marca", attributes: ["nombre"] },
      { model: Modelo, as: "Modelo", attributes: ["nombre"] },
      { model: Categoria, as: "Categoria", attributes: ["nombre"] },
      {
        model: Dependencia,
        as: "Dependencia",
        attributes: ["nombre_dependencia"],
      },
      { model: Subdependencia, as: "Subdependencia", attributes: ["nombre"] },
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
    ],
  });
};

/**
 * Actualizar Vehículo
 */
exports.actualizarVehiculo = async (id, data, clientIp) => {
  const {
    placa,
    id_marca,
    id_modelo,
    id_categoria,
    id_dependencia,
    id_subdependencia,
    es_generador,
    es_planta,
    id_tipo_combustible,
    estado,
  } = data;

  return await executeTransaction(clientIp, async (t) => {
    const vehiculo = await Vehiculo.findByPk(id, { transaction: t });
    if (!vehiculo) {
      throw new Error("Vehículo no encontrado");
    }

    // Validar placa duplicada
    if (placa && placa !== vehiculo.placa) {
      const existe = await Vehiculo.findOne({
        where: { placa, id_vehiculo: { [Op.ne]: id } },
        transaction: t,
      });
      if (existe) {
        throw new Error("La placa ya está registrada en otro vehículo");
      }
      vehiculo.placa = placa;
    }

    // Validar Marca/Modelo
    if (id_marca || id_modelo) {
      const checkMarca = id_marca || vehiculo.id_marca;
      const checkModelo = id_modelo || vehiculo.id_modelo;
      const modeloValido = await Modelo.findOne({
        where: { id_modelo: checkModelo, id_marca: checkMarca },
        transaction: t,
      });
      if (!modeloValido) {
        throw new Error("El modelo no coincide con la marca");
      }
      vehiculo.id_marca = checkMarca;
      vehiculo.id_modelo = checkModelo;
    }

    // Validar Tipo Combustible
    if (id_tipo_combustible) {
      const combustible = await TipoCombustible.findByPk(id_tipo_combustible, {
        transaction: t,
      });
      if (!combustible) {
        throw new Error("Tipo de combustible inválido");
      }
      vehiculo.id_tipo_combustible = id_tipo_combustible;
    }

    if (id_categoria) vehiculo.id_categoria = id_categoria;
    if (id_dependencia) vehiculo.id_dependencia = id_dependencia;
    if (id_subdependencia !== undefined)
      vehiculo.id_subdependencia = id_subdependencia;
    if (es_generador !== undefined) vehiculo.es_generador = es_generador;
    if (es_planta !== undefined) vehiculo.es_planta = es_planta;
    if (estado) vehiculo.estado = estado;

    vehiculo.fecha_modificacion = new Date();
    await vehiculo.save({ transaction: t });

    return vehiculo;
  });
};

/**
 * Desactivar Vehículo
 */
exports.desactivarVehiculo = async (id, clientIp) => {
  return await executeTransaction(clientIp, async (t) => {
    const vehiculo = await Vehiculo.findByPk(id, { transaction: t });
    if (!vehiculo) {
      throw new Error("Vehículo no encontrado");
    }

    await vehiculo.update(
      { estado: "INACTIVO", fecha_modificacion: new Date() },
      { transaction: t },
    );

    return { id_vehiculo: id, estado: "INACTIVO" };
  });
};

/**
 * Lista Simple para selectores
 */
exports.obtenerListaVehiculos = async (query) => {
  const { es_generador, es_planta, id_categoria, id_dependencia } = query;
  const where = { estado: "ACTIVO" };

  if (es_generador !== undefined) where.es_generador = es_generador === "true";
  if (es_planta !== undefined) where.es_planta = es_planta === "true";
  if (id_categoria) where.id_categoria = id_categoria;
  if (id_dependencia) where.id_dependencia = id_dependencia;

  return await Vehiculo.findAll({
    where,
    include: [
      { model: Marca, as: "Marca", attributes: ["nombre"] },
      { model: Modelo, as: "Modelo", attributes: ["nombre"] },
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
    ],
    order: [["placa", "ASC"]],
  });
};

/**
 * Obtener Modelos por Marca
 */
exports.obtenerModelosPorMarca = async (id_marca) => {
  return await Modelo.findAll({
    where: { id_marca, estado: "ACTIVO" },
    attributes: ["id_modelo", "nombre"],
    order: [["nombre", "ASC"]],
  });
};
