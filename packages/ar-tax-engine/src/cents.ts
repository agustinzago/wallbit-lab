// Helpers de precisión: convierte montos a centavos enteros para evitar
// drift de IEEE-754 en cálculos fiscales críticos.

/** Convierte un monto en pesos a centavos enteros (redondea al centavo más cercano). */
export function toCents(ars: number): bigint {
  return BigInt(Math.round(ars * 100));
}

/** Convierte centavos enteros de vuelta a pesos. */
export function fromCents(cents: bigint): number {
  return Number(cents) / 100;
}

/** Redondea a 2 decimales (centavos). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Redondea a 8 decimales (precision para cotizaciones FX). */
export function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
