const { Tanque, Llenadero, TipoCombustible } = require("../../models");

/**
 * Obtener estadísticas globales para el Dashboard
 */
exports.getStats = async () => {
  const tanques = await Tanque.findAll({
    where: { estado: "ACTIVO" },
    include: [
      { model: Llenadero, as: "Llenadero", attributes: ["nombre_llenadero"] },
      { model: TipoCombustible, as: "TipoCombustible", attributes: ["nombre"] },
    ],
  });

  // Formatear para que el componente lo reciba como 'tank' (para reusar lógica)
  const llenaderosFormatted = tanques.map((t) => ({
    id_llenadero: t.id_tanque, // Se usa el ID del tanque para el key en v-for
    nombre: `${t.Llenadero?.nombre_llenadero || 'S/N'} - ${t.nombre}`,
    capacidad_maxima: parseFloat(t.capacidad_maxima) || 0,
    nivel_actual: parseFloat(t.nivel_actual) || 0,
    tipo_tanque: t.tipo_tanque || "CILINDRICO",
    tipo_combustible: t.TipoCombustible?.nombre || "No definido",
    codigo: t.codigo || `TK-0${t.id_tanque}`,
    estado: t.estado,
  }));

  return {
    llenaderos: llenaderosFormatted,
  };
};
