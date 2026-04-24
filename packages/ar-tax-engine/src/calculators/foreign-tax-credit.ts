// Helper puro: crédito fiscal por WHT (retención en origen).
// Fuente: LIG art. 178 + research §2.5.
//
// Límite: el crédito no puede superar el impuesto argentino sobre la misma renta.

import { fromCents, toCents } from '../cents.js';

export interface ForeignTaxCreditInput {
  /** WHT en USD (retención en origen, ej. 30% USA). */
  readonly whtUsd: number;
  /** Ganancia bruta en USD. */
  readonly grossUsd: number;
  /** Alícuota marginal del impuesto argentino (como decimal, ej. 0.35). */
  readonly marginalRate: number;
  /** TC BNA comprador al momento de la retención. */
  readonly fxBnaComprador: number;
}

export interface ForeignTaxCreditResult {
  /** Crédito computable en ARS. */
  readonly creditArs: number;
  /** Impuesto argentino calculado (referencia). */
  readonly arTaxArs: number;
  /** True si el WHT supera el impuesto AR (el exceso no se computa). */
  readonly capped: boolean;
}

/**
 * Calcula el crédito fiscal computable por retención en origen (WHT).
 * El crédito se limita al impuesto argentino que hubiera correspondido
 * sobre la misma renta (no puede dar saldo a favor).
 */
export function computeForeignTaxCredit(input: ForeignTaxCreditInput): ForeignTaxCreditResult {
  const whtArsCents = toCents(input.whtUsd * input.fxBnaComprador);
  const grossArsCents = toCents(input.grossUsd * input.fxBnaComprador);
  const arTaxCents = BigInt(Math.round(Number(grossArsCents) * input.marginalRate));

  const capped = whtArsCents > arTaxCents;
  const creditCents = capped ? arTaxCents : whtArsCents;

  return {
    creditArs: fromCents(creditCents),
    arTaxArs: fromCents(arTaxCents),
    capped,
  };
}
