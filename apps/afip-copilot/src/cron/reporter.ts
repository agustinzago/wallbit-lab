// Formatter del reporte semanal del cron.
// Compara el snapshot actual con el anterior y muestra los deltas.

import type { InferSelectModel } from 'drizzle-orm';
import type { taxSnapshots } from '../db/schema.js';

type TaxSnapshot = InferSelectModel<typeof taxSnapshots>;

export interface WeeklyReportInput {
  readonly current: TaxSnapshot;
  readonly previous: TaxSnapshot | null;
  readonly fiscalYear: number;
  readonly newDividendCount: number;
  readonly nextReportDate: string;
}

export function formatWeeklyReport(input: WeeklyReportInput): string {
  const { current, previous } = input;

  const patrimonioUsd = Number(current.patrimonioUsd);
  const patrimonioUsdDelta = previous ? patrimonioUsd - Number(previous.patrimonioUsd) : 0;

  const bpProjected = Number(current.bpProjectedArs);
  const bpDelta = previous ? bpProjected - Number(previous.bpProjectedArs) : 0;

  const tramoPayload = (current.payload as Record<string, unknown>)['tramo'] as number | undefined;
  const prevTramoPayload = previous
    ? ((previous.payload as Record<string, unknown>)['tramo'] as number | undefined)
    : undefined;
  const tramoChanged = prevTramoPayload !== undefined && tramoPayload !== prevTramoPayload;

  const divYtdArs = Number(current.dividendsYtdArs);

  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    `📅 *Reporte semanal AFIP Copilot*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `📊 Semana al ${today}`,
    '',
    '💼 *Patrimonio:*',
    `  • USD actual: $${fmtNum(patrimonioUsd, 2)} (${formatDelta(patrimonioUsdDelta, 2)} vs semana pasada)`,
    `  • ARS: $${fmtNum(Number(current.patrimonioArs), 0)}`,
    '',
    `📈 *BP proyectado ${input.fiscalYear}:*`,
    `  • Impuesto: $${fmtNum(bpProjected, 0)} (${formatDelta(bpDelta, 0)} vs semana pasada)`,
    `  • Tramo: ${tramoPayload ?? '-'} ${tramoChanged ? '⚠️ cambió de tramo!' : ''}`,
    '',
    '💸 *Dividendos YTD:*',
    `  • ARS equivalentes: $${fmtNum(divYtdArs, 0)}`,
    `  • Nuevos esta semana: ${input.newDividendCount}`,
    '',
    `_Próximo reporte: ${input.nextReportDate}_`,
  ];

  if (bpDelta > 10_000_000) {
    lines.splice(1, 0, '⚠️ Tu BP subió significativamente esta semana. Revisá el portfolio.');
  }

  return lines.join('\n');
}

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDelta(delta: number, decimals: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${fmtNum(delta, decimals)}`;
}
