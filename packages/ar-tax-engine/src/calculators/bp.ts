// Calculadora de Bienes Personales.
// Fuente: Ley 23.966 + Ley 27.743 art. 64 + research §1.2-§1.3.
//
// Los cálculos internos usan centavos enteros (bigint) para evitar drift de floats.

import { toCents, fromCents } from '../cents.js';
import { getBpRule } from '../rules/bp-rules.js';
import type { BpProjection, BpProjectionInput } from '../types.js';
import type { BpTranche } from '../rules/bp-rules.js';

export function projectBienesPersonales(input: BpProjectionInput): BpProjection {
  const rule = getBpRule(input.period);
  const warnings: string[] = [];

  if (rule.isEstimated) {
    warnings.push(
      `Los valores de BP ${input.period} son estimados (${rule.norma}). Verificar con contador cuando ARCA publique la RG definitiva.`,
    );
  }

  // REIBP: si adhirió al Régimen Especial de Ingreso de BP (Ley 27.743 Capítulo V),
  // el impuesto de los períodos 2023-2027 ya fue abonado en forma especial.
  if (input.isReibpAdherido && input.period >= 2023 && input.period <= 2027) {
    return {
      period: input.period,
      valuatedAssetsArs: 0,
      mniArs: rule.mniArs,
      excedenteArs: 0,
      tramo: 0,
      impuestoArs: 0,
      impuestoUsd: 0,
      normaAplicada: rule.norma,
      warnings: [
        ...warnings,
        'REIBP adherido (Ley 27.743 Cap. V): BP período cubierto por pago especial. No se proyecta impuesto ordinario.',
      ],
    };
  }

  // Valuación: positions × price × TC + cash USD × TC.
  // Excluir: cashArBank (caja de ahorro en banco AR, art. 21 Ley 23.966)
  //          titulosPublicosAr (exentos por Ley 23.576)
  let totalUsd = input.portfolio.usdCashBroker;
  for (const pos of input.portfolio.positions) {
    totalUsd += pos.shares * pos.priceUsd;
  }
  const totalArsCents = toCents(totalUsd * input.fxBnaComprador);
  const mniCents = toCents(rule.mniArs);

  if (totalArsCents <= mniCents) {
    return {
      period: input.period,
      valuatedAssetsArs: fromCents(totalArsCents),
      mniArs: rule.mniArs,
      excedenteArs: 0,
      tramo: 0,
      impuestoArs: 0,
      impuestoUsd: 0,
      normaAplicada: rule.norma,
      warnings,
    };
  }

  const excedenteCents = totalArsCents - mniCents;
  const scale = input.isCumplidor ? rule.scales.cumplidor : rule.scales.general;

  // Advertencia si el beneficio cumplidor expiró (post 2027, Ley 27.743).
  if (input.isCumplidor && input.period >= 2028) {
    warnings.push(
      `El beneficio de alícuota diferenciada para contribuyente cumplidor vence a partir de 2028 (Ley 27.743). Se aplica escala general.`,
    );
  }

  const { impuestoCents, tramo } = applyScale(excedenteCents, scale);

  const impuestoArs = fromCents(impuestoCents);
  const impuestoUsd = input.fxBnaComprador > 0 ? impuestoArs / input.fxBnaComprador : 0;

  return {
    period: input.period,
    valuatedAssetsArs: fromCents(totalArsCents),
    mniArs: rule.mniArs,
    excedenteArs: fromCents(excedenteCents),
    tramo,
    impuestoArs,
    impuestoUsd,
    normaAplicada: rule.norma,
    warnings,
  };
}

function applyScale(
  excedenteCents: bigint,
  scale: readonly BpTranche[],
): { impuestoCents: bigint; tramo: 0 | 1 | 2 | 3 } {
  let tramo: 0 | 1 | 2 | 3 = 0;

  for (let i = 0; i < scale.length; i++) {
    const t = scale[i];
    if (!t) continue;
    const upToCents = t.upToArs === Infinity ? BigInt(Number.MAX_SAFE_INTEGER) : toCents(t.upToArs);

    if (excedenteCents <= upToCents) {
      tramo = Math.min(i + 1, 3) as 0 | 1 | 2 | 3;
      const fixedCents = toCents(t.fixedArs);
      // El excedente sobre el límite inferior del tramo (el tramo anterior define el piso).
      const lowerBoundCents = i === 0 ? 0n : toCents(scale[i - 1]?.upToArs ?? 0);
      const marginalCents = excedenteCents - lowerBoundCents;
      // rate es float, convertimos a centavos con redondeo.
      const marginalTaxCents = BigInt(Math.round(Number(marginalCents) * t.rate));
      return { impuestoCents: fixedCents + marginalTaxCents, tramo };
    }
  }

  // Nunca debería llegar acá si la escala tiene un Infinity al final.
  return { impuestoCents: 0n, tramo: 0 };
}
