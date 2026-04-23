// Formateo del reporte para Telegram. Diseño profesional y sobrio: tipografía
// Markdown (bold + italics) como única decoración, sin emojis ni separadores
// ASCII. Jerarquía clara (Título → Resumen → Detalle → Contexto → Recomendación)
// y números en formato es-AR (1.500,00) para el público argentino.

import type { AnalysisResult, IdleAsset, IdleCategory } from './analyzer.js';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

const CATEGORY_LABEL: Record<IdleCategory, string> = {
  checking: 'Cuenta corriente',
  investment_cash: 'Cash sin invertir (cuenta de inversión)',
};

export function buildReport(result: AnalysisResult): string {
  const sections: string[] = [buildHeader(result)];

  if (!result.hasIdle || result.totalIdleUSD === 0) {
    sections.push(buildEmptyBody());
    sections.push(buildContext(result));
    return sections.join('\n\n');
  }

  sections.push(buildSummary(result));
  sections.push(buildDetail(result.idleAssets));
  sections.push(buildContext(result));

  const recommendation = buildRecommendation(result);
  if (recommendation !== null) sections.push(recommendation);

  return sections.join('\n\n');
}

function buildHeader(result: AnalysisResult): string {
  return [
    '*Guita Dormida — Reporte diario*',
    `_${formatDate(result.analyzedAt)}_`,
  ].join('\n');
}

function buildEmptyBody(): string {
  return 'No se detectaron activos ociosos en la ventana analizada. El capital está asignado por encima de los umbrales configurados.';
}

function buildSummary(result: AnalysisResult): string {
  return [
    '*Resumen*',
    `Capital ocioso total: USD ${fmt(result.totalIdleUSD)}`,
    `Costo de oportunidad: USD ${fmt(result.totalOpportunityCost)} en el período`,
  ].join('\n');
}

function buildDetail(assets: readonly IdleAsset[]): string {
  const blocks = assets.map((asset, idx) => formatAsset(asset, idx + 1));
  return ['*Detalle*', ...blocks].join('\n\n');
}

function buildContext(result: AnalysisResult): string {
  return [
    '*Contexto*',
    `Gasto mensual estimado: USD ${fmt(result.monthlyBurnRateUSD)}`,
    `Colchón recomendado: USD ${fmt(result.recommendedBufferUSD)}`,
    `Ventana de análisis: ${result.analyzedDays} días`,
  ].join('\n');
}

function buildRecommendation(result: AnalysisResult): string | null {
  if (result.totalOpportunityCost < 10) return null;
  return [
    '*Recomendación*',
    `El capital ocioso equivale a USD ${fmt(result.totalOpportunityCost)} de rendimiento no capturado en los últimos ${result.analyzedDays} días. Considerá reasignar el excedente a instrumentos de bajo riesgo (T-Bills cortos como SGOV o BIL) o a un Robo Advisor desde el dashboard de Wallbit.`,
  ].join('\n');
}

function formatAsset(asset: IdleAsset, index: number): string {
  const lines: string[] = [
    `*${index}. ${CATEGORY_LABEL[asset.category]}*`,
    `Monto: USD ${fmt(asset.amount)} (${asset.currency})`,
    `Antigüedad: ${asset.idleDays} días`,
    `Costo de oportunidad: USD ${fmt(asset.opportunityCost)}`,
  ];
  // La acción sugerida la ponemos como línea en itálica final, así queda clara
  // pero no compite con las cifras.
  lines.push(`_Acción sugerida:_ ${asset.suggestedAction}`);
  return lines.join('\n');
}

// Formato de número localizado a es-AR: 1.234,56 (punto de miles, coma decimal).
function fmt(n: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Fecha "23 de abril de 2026, 16:32 (ART)" — formal pero legible.
function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup['day']} de ${lookup['month']} de ${lookup['year']}, ${lookup['hour']}:${lookup['minute']} ART`;
}
