/**
 * Calcula el volumen de líquido en un tanque cilíndrico horizontal.
 * @param {number} h - Altura del líquido (metros)
 * @param {number} L - Largo del tanque (metros)
 * @param {number} R - Radio del tanque (metros)
 * @returns {number} - Volumen en litros
 */
const calcularVolumenCilindrico = (h, L, R) => {
  if (h < 0) return 0;
  if (h > 2 * R) h = 2 * R;

  const term1 = (Math.PI * Math.pow(R, 2)) / 2;
  const term2 = (h - R) * Math.sqrt(2 * R * h - Math.pow(h, 2));

  let term3 = 0;
  const argumentoAsin = (h - R) / R;

  if (argumentoAsin >= 1) {
    term3 = Math.pow(R, 2) * (Math.PI / 2);
  } else if (argumentoAsin <= -1) {
    term3 = Math.pow(R, 2) * (-Math.PI / 2);
  } else {
    term3 = Math.pow(R, 2) * Math.asin(argumentoAsin);
  }

  const volumenM3 = L * (term1 + term2 + term3);
  return volumenM3 * 1000; // Retorna Litros
};

/**
 * Calcula el volumen de líquido en un tanque rectangular/cuadrado.
 * @param {number} h - Altura del líquido (metros)
 * @param {number} L - Largo del tanque (metros)
 * @param {number} W - Ancho del tanque (metros)
 * @param {number} HMax - Altura máxima del tanque (para validación)
 * @returns {number} - Volumen en litros
 */
const calcularVolumenRectangular = (h, L, W, HMax) => {
  if (h < 0) return 0;
  if (HMax && h > HMax) h = HMax;

  const volumenM3 = L * W * h;
  return volumenM3 * 1000; // Retorna Litros
};

/**
 * Función unificada para calcular volumen según el tipo de tanque.
 */
const calcularVolumenTanque = (
  h,
  L,
  R_or_W,
  tankType = "CILINDRICO",
  HMax = null
) => {
  if (tankType === "RECTANGULAR" || tankType === "CUADRADO") {
    return calcularVolumenRectangular(h, L, R_or_W, HMax);
  } else {
    return calcularVolumenCilindrico(h, L, R_or_W);
  }
};

module.exports = {
  calcularVolumenTanque,
  calcularVolumenCilindrico,
  calcularVolumenRectangular,
};
