// Formateo del reporte para Telegram. Diseño pensado para mobile: líneas
// cortas, emojis moderados, sin tablas (Telegram no las renderiza en Markdown).

import type { EnrichedCharge, HuntResult, Zombie } from './hunter.js';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

export function buildReport(result: HuntResult): string {
  const sections: string[] = [];
  sections.push(buildHeader(result));
  sections.push(buildSummary(result));

  if (result.zombies.length === 0) {
    sections.push(
      '✅ No encontré zombies. Todas tus suscripciones parecen activas y sin anomalías.',
    );
  } else {
    const grouped = groupByType(result.zombies);
    if (grouped.silent_price_increase.length > 0) {
      sections.push(buildSilentIncreases(grouped.silent_price_increase));
    }
    if (grouped.functional_duplicate.length > 0) {
      sections.push(buildFunctionalDuplicates(grouped.functional_duplicate));
    }
    if (grouped.potential_unused.length > 0) {
      sections.push(buildPotentialUnused(grouped.potential_unused));
    }
  }

  sections.push(buildAllSubscriptions(result.allCharges));

  if (result.potentialAnnualSavingsUSD > 100) {
    sections.push(buildSavingsTeaser(result.potentialAnnualSavingsUSD));
  }

  sections.push(`_Análisis basado en los últimos ${result.analyzedDays} días_`);

  return sections.join('\n\n');
}

function buildHeader(result: HuntResult): string {
  return [`🧟 *Cazador de Zombies — Reporte*`, `📅 ${formatDate(result.huntedAt)}`].join('\n');
}

function buildSummary(result: HuntResult): string {
  return [
    '━━━━━━━━━━━━━━━━━━━━',
    `📋 Suscripciones detectadas: ${result.totalSubscriptionsFound}`,
    `💸 Gasto mensual total: USD ${fmt(result.totalMonthlyUSD)}`,
    `💀 Zombies encontrados: ${result.zombies.length}`,
    `💰 Ahorro potencial anual: USD ${fmt(result.potentialAnnualSavingsUSD)}`,
    '━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');
}

function buildSilentIncreases(zombies: readonly Zombie[]): string {
  const lines: string[] = ['*🔇 Aumentos silenciosos*'];
  for (const z of zombies) {
    const firstAmount = z.charge.occurrences[0]!.amount;
    const pct = z.charge.priceIncreasePercent ?? 0;
    lines.push(
      `• *${z.merchantInfo.normalizedName}* — USD ${fmt(z.charge.lastAmount)}/mes (+${fmt(pct)}%)`,
      `  Antes pagabas USD ${fmt(firstAmount)}. Subió sin avisarte.`,
      `  Costo anual: USD ${fmt(z.annualCostUSD)}`,
    );
  }
  return lines.join('\n');
}

function buildFunctionalDuplicates(zombies: readonly Zombie[]): string {
  // Agrupamos por functionalGroup y mostramos un bloque por grupo (no por cada
  // zombie), para evitar repetir info con referencia cruzada.
  const byGroup = new Map<string, Zombie[]>();
  for (const z of zombies) {
    const g = z.merchantInfo.functionalGroup ?? 'otros';
    const list = byGroup.get(g) ?? [];
    list.push(z);
    byGroup.set(g, list);
  }

  const lines: string[] = ['*👯 Duplicados funcionales*'];
  for (const [group, items] of byGroup) {
    const names = items.map((z) => z.merchantInfo.normalizedName);
    const monthlyTotal = items.reduce((acc, z) => acc + z.annualCostUSD / 12, 0);
    const minCost = Math.min(...items.map((z) => z.annualCostUSD));
    lines.push(
      `• ${names.map((n) => `*${n}*`).join(' + ')} — ambos hacen lo mismo (${group})`,
      `  Estás pagando USD ${fmt(monthlyTotal)}/mes por la misma función.`,
      `  Ahorro si cancelás uno: USD ${fmt(minCost)}/año`,
    );
  }
  return lines.join('\n');
}

function buildPotentialUnused(zombies: readonly Zombie[]): string {
  const lines: string[] = ['*👻 Posibles no usados* _(baja confianza)_'];
  for (const z of zombies) {
    const days = z.charge.daysSinceLastCharge;
    lines.push(
      `• *${z.merchantInfo.normalizedName}* — USD ${fmt(z.charge.lastAmount)}/mes`,
      `  No detecté cobro en los últimos ${days} días. Verificá si sigue activo.`,
    );
  }
  return lines.join('\n');
}

function buildAllSubscriptions(charges: readonly EnrichedCharge[]): string {
  const lines: string[] = ['━━━━━━━━━━━━━━━━━━━━', '*📊 Todas tus suscripciones activas*'];
  if (charges.length === 0) {
    lines.push('_Sin suscripciones recurrentes detectadas._');
    return lines.join('\n');
  }
  for (const e of charges) {
    const unit = e.charge.cadence === 'annual' ? 'año' : 'mes';
    lines.push(
      `• ${e.merchantInfo.normalizedName} — USD ${fmt(e.charge.lastAmount)}/${unit}`,
    );
  }
  return lines.join('\n');
}

function buildSavingsTeaser(savings: number): string {
  return `💡 Cancelando los zombies detectados podrías ahorrarte USD ${fmt(savings)}/año — suficiente para ${funnyEquivalent(savings)}.`;
}

function funnyEquivalent(savings: number): string {
  if (savings >= 500) return 'un viaje de fin de semana a Buenos Aires';
  if (savings >= 200) return 'renovar tu setup de café por completo';
  if (savings >= 100) return '3 meses de todas tus herramientas AI';
  if (savings >= 60) return 'un año de Claude Pro';
  return 'unas buenas semanas de cafés de especialidad';
}

function groupByType(zombies: readonly Zombie[]): {
  silent_price_increase: Zombie[];
  functional_duplicate: Zombie[];
  potential_unused: Zombie[];
} {
  const out = {
    silent_price_increase: [] as Zombie[],
    functional_duplicate: [] as Zombie[],
    potential_unused: [] as Zombie[],
  };
  for (const z of zombies) {
    out[z.type].push(z);
  }
  return out;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup['day']}/${lookup['month']}/${lookup['year']}`;
}
