// Formateo del reporte en Markdown-flavored para Telegram. El objetivo es que se
// lea bien en el cliente móvil y que las acciones sugeridas sean inequívocas.

import type { AnalysisResult, IdleAsset, IdleCategory } from './analyzer.js';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

const CATEGORY_LABEL: Record<IdleCategory, string> = {
  checking: 'Checking ocioso',
  investment_cash: 'Cash sin invertir',
};

export function buildReport(result: AnalysisResult): string {
  const header = buildHeader(result);

  if (!result.hasIdle || result.totalIdleUSD === 0) {
    return [header, '', '✅ No detecté capital ocioso. Tu plata está trabajando.'].join('\n');
  }

  const summary = [
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `💰 *Capital ocioso total:* USD ${fmt(result.totalIdleUSD)}`,
    `📉 *Costo de oportunidad:* USD ${fmt(result.totalOpportunityCost)}/mes`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
  ].join('\n');

  const assets = result.idleAssets.map(formatAsset).join('\n\n');

  const context = [
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '📊 *Contexto*',
    `Gasto mensual promedio: USD ${fmt(result.monthlyBurnRateUSD)}`,
    `Colchón recomendado: USD ${fmt(result.recommendedBufferUSD)}`,
    '',
    `_Análisis basado en los últimos ${result.analyzedDays} días_`,
  ].join('\n');

  const warning =
    result.totalOpportunityCost > 50
      ? [
          '',
          `⚠️ Llevás USD ${fmt(result.totalOpportunityCost)} no ganados este mes. Considerá mover parte a T-Bills (SGOV o BIL en tu dashboard de Wallbit).`,
        ].join('\n')
      : '';

  return [header, summary, assets, context, warning].join('\n');
}

function buildHeader(result: AnalysisResult): string {
  return [
    '💤 *Guita Dormida — Reporte diario*',
    `📅 ${formatDate(result.analyzedAt)}`,
  ].join('\n');
}

function formatAsset(asset: IdleAsset): string {
  return [
    `🔴 *${CATEGORY_LABEL[asset.category]}* — USD ${fmt(asset.amount)}`,
    `   Dormido hace ${asset.idleDays} días`,
    `   Costo: USD ${fmt(asset.opportunityCost)} no ganados`,
    `   → ${asset.suggestedAction}`,
  ].join('\n');
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Formato DD/MM/YYYY HH:mm en zona horaria de Argentina.
function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup['day']}/${lookup['month']}/${lookup['year']} ${lookup['hour']}:${lookup['minute']} ART`;
}
