// Calculadora de Impuesto a las Ganancias sobre dividendos de fuente extranjera.
// Fuente: LIG Art. 94 §1 + research §2.2-§2.5.
//
// El engine recibe los dividendos ya con su FX pre-calculado (no fetchea).
// La alícuota se aplica sobre el total anual bruto en ARS.

import { toCents, fromCents } from '../cents.js';
import { getArt94Rule } from '../rules/art94-rules.js';
import type {
  DividendWithFx,
  DividendTaxed,
  IncomeTaxDividendProjection,
  FiscalYear,
} from '../types.js';
import type { Art94Tranche } from '../rules/art94-rules.js';

export function projectIncomeTaxDividends(
  dividends: readonly DividendWithFx[],
  period: FiscalYear,
): IncomeTaxDividendProjection {
  const warnings: string[] = [];

  const { rule, warning } = getArt94Rule(period);
  if (warning) warnings.push(warning);

  // Convertir cada dividendo a ARS usando su FX al pay_date.
  const dividendsTaxed: DividendTaxed[] = [];
  let totalGrossCents = 0n;

  for (const div of dividends) {
    const amountArsCents = toCents(div.amountUsd * div.fxBnaCompradorAtPayDate);
    totalGrossCents += amountArsCents;
    dividendsTaxed.push({ ...div, amountArs: fromCents(amountArsCents), taxArs: 0, whtCreditArs: 0 });
  }

  const totalGrossArs = fromCents(totalGrossCents);

  if (totalGrossArs === 0) {
    return {
      period,
      dividends: dividendsTaxed,
      totalGrossArs: 0,
      marginalRateUsed: 0,
      incomeTaxArs: 0,
      foreignTaxCreditArs: 0,
      netTaxArs: 0,
      warnings,
    };
  }

  // Calcular impuesto sobre el total anual bruto.
  const { taxCents, marginalRate } = applyArt94Scale(totalGrossCents, rule.tranches);
  const incomeTaxArs = fromCents(taxCents);

  // Crédito fiscal por WHT (art. 178 LIG): min(WHT_ARS, impuesto_AR).
  // WHT se convierte con el mismo TC del pay_date de cada dividendo.
  let totalWhtCents = 0n;
  for (const div of dividends) {
    const whtArsCents = toCents(div.whtUsdAmount * div.fxBnaCompradorAtPayDate);
    totalWhtCents += whtArsCents;
  }
  // El crédito no puede superar el impuesto argentino.
  const foreignTaxCreditCents = totalWhtCents < taxCents ? totalWhtCents : taxCents;
  const foreignTaxCreditArs = fromCents(foreignTaxCreditCents);
  const netTaxArs = fromCents(taxCents - foreignTaxCreditCents);

  // Prorratear el impuesto por dividendo para mostrar en el detalle.
  const dividendsWithTax = dividendsTaxed.map((div) => {
    const proportion = totalGrossArs > 0 ? div.amountArs / totalGrossArs : 0;
    const taxArs = fromCents(BigInt(Math.round(Number(taxCents) * proportion)));
    const whtCreditArs = fromCents(
      BigInt(Math.round(Number(foreignTaxCreditCents) * proportion)),
    );
    return { ...div, taxArs, whtCreditArs };
  });

  return {
    period,
    dividends: dividendsWithTax,
    totalGrossArs,
    marginalRateUsed: marginalRate,
    incomeTaxArs,
    foreignTaxCreditArs,
    netTaxArs,
    warnings,
  };
}

function applyArt94Scale(
  grossCents: bigint,
  tranches: readonly Art94Tranche[],
): { taxCents: bigint; marginalRate: number } {
  for (let i = 0; i < tranches.length; i++) {
    const t = tranches[i];
    if (!t) continue;
    const upToCents = t.upToArs === Infinity ? BigInt(Number.MAX_SAFE_INTEGER) : toCents(t.upToArs);

    if (grossCents <= upToCents) {
      const fixedCents = toCents(t.fixedArs);
      const lowerBoundCents = i === 0 ? 0n : toCents(tranches[i - 1]?.upToArs ?? 0);
      const marginalCents = grossCents - lowerBoundCents;
      const marginalTaxCents = BigInt(Math.round(Number(marginalCents) * t.rate));
      return { taxCents: fixedCents + marginalTaxCents, marginalRate: t.rate };
    }
  }

  return { taxCents: 0n, marginalRate: 0 };
}
