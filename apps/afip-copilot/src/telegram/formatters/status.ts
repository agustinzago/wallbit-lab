// Formatter del mensaje /status.
// Muestra patrimonio, tabla de tipos de cambio, valuación BP y sugerencia de tramo.

import type { BpProjection, PortfolioSnapshot } from '@wallbit-lab/ar-tax-engine';
import type { DolarApiResult, CotizacionUSD, FxQuote } from '@wallbit-lab/fx-ars';

export function formatStatus(
  portfolio: PortfolioSnapshot,
  projection: BpProjection,
  fx: FxQuote,
  dolarapi?: DolarApiResult,
): string {
  const totalUsd =
    portfolio.usdCashBroker +
    portfolio.positions.reduce((sum, p) => sum + p.shares * p.priceUsd, 0);

  const lines: string[] = [
    `🏦 *Status fiscal — ${portfolio.valuationDate}*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `💼 Patrimonio USD: $${fmtNum(totalUsd, 2)} (Wallbit)`,
    `🇦🇷 Valuación ARS @ TC ${fmtNum(fx.rate, 0)} = $${fmtNum(projection.valuatedAssetsArs, 0)}`,
  ];

  // Tabla de tipos de cambio del día si dolarapi respondió.
  if (dolarapi) {
    const { oficial, blue, mep, ccl, cripto, tarjeta } = dolarapi;
    const brechaBlue = calcBrecha(oficial, blue);
    const brechaMep = calcBrecha(oficial, mep);
    const brechaCcl = calcBrecha(oficial, ccl);

    lines.push('');
    lines.push('💱 *Tipos de cambio hoy*');
    lines.push(`• Oficial BNA:  $${fmtRate(oficial)} ${brechaBlue !== null ? '' : ''}`);
    lines.push(`• Blue:         $${fmtRate(blue)}${brechaBlue !== null ? ` _(+${brechaBlue}%)_` : ''}`);
    lines.push(`• MEP (bolsa):  $${fmtRate(mep)}${brechaMep !== null ? ` _(+${brechaMep}%)_` : ''}`);
    lines.push(`• CCL:          $${fmtRate(ccl)}${brechaCcl !== null ? ` _(+${brechaCcl}%)_` : ''}`);
    if (cripto) lines.push(`• Cripto:       $${fmtRate(cripto)}`);
    if (tarjeta) lines.push(`• Tarjeta:      $${fmtRate(tarjeta)}`);
  }

  lines.push('');
  lines.push(`📊 *Bienes Personales ${projection.period}* ${projection.normaAplicada.includes('ESTIMADO') ? '_(estimado)_' : ''}`);
  lines.push(`• MNI: $${fmtNum(projection.mniArs, 0)}`);
  lines.push(`• Base imponible (excedente): $${fmtNum(projection.excedenteArs, 0)}`);
  lines.push(`• Tramo aplicable: ${projection.tramo} de 3`);
  lines.push(`• Impuesto proyectado: $${fmtNum(projection.impuestoArs, 0)} (USD ${fmtNum(projection.impuestoUsd, 0)})`);

  if (projection.warnings.length > 0) {
    lines.push('');
    for (const w of projection.warnings) {
      lines.push(`⚠️ ${w}`);
    }
  }

  const suggestion = buildNextTramoSuggestion(projection);
  if (suggestion) {
    lines.push('');
    lines.push(suggestion);
  }

  lines.push('');
  lines.push(`_Norma: ${projection.normaAplicada}_`);
  lines.push(`_Valuación al cierre usa precios spot de hoy como proxy del 31/12. El resultado final puede variar._`);

  return lines.join('\n');
}

function buildNextTramoSuggestion(projection: BpProjection): string | null {
  if (projection.impuestoArs === 0 && projection.excedenteArs === 0) {
    const distanciaAlMni = projection.mniArs - projection.valuatedAssetsArs;
    if (distanciaAlMni < projection.mniArs * 0.1) {
      return `💡 Estás a $${fmtNum(distanciaAlMni, 0)} del MNI. Si crecés, vas a tributar BP.`;
    }
  }

  if (projection.tramo > 0 && projection.tramo < 3) {
    return `💡 Tip: transferir USD a caja de ahorro en banco AR o rotar a AL30 podría reducir la base imponible de BP (activos exentos).`;
  }

  return null;
}

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formatea compra/venta de una cotización como "1.365 / 1.415". */
function fmtRate(cot: CotizacionUSD): string {
  const compra = cot.compra !== null ? fmtNum(cot.compra, 0) : '-';
  const venta = cot.venta !== null ? fmtNum(cot.venta, 0) : '-';
  return `${compra} / ${venta}`;
}

/** Brecha porcentual de la venta de `alt` vs la venta de `base`. */
function calcBrecha(base: CotizacionUSD, alt: CotizacionUSD): string | null {
  const baseVenta = base.venta;
  const altVenta = alt.venta;
  if (baseVenta === null || altVenta === null || baseVenta === 0) return null;
  const pct = ((altVenta - baseVenta) / baseVenta) * 100;
  return pct.toFixed(1);
}
