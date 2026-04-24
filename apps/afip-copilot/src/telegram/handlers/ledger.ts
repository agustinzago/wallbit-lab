// Handler del comando /ledger [year].
// Muestra el ledger de dividendos y proyecta el impuesto del Art. 94.

import { and, gte, lte } from 'drizzle-orm';
import { projectIncomeTaxDividends } from '@wallbit-lab/ar-tax-engine';
import type { DividendWithFx } from '@wallbit-lab/ar-tax-engine';
import { dividendLedger } from '../../db/schema.js';
import type { CommandContext } from '../router.js';

export async function handleLedger(ctx: CommandContext): Promise<string> {
  const year = ctx.args[0] ? Number(ctx.args[0]) : ctx.config.fiscalYear;

  if (!Number.isFinite(year) || year < 2020 || year > 2030) {
    return `Año inválido: \`${ctx.args[0]}\`. Ejemplo: /ledger 2025`;
  }

  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;

  const rows = await ctx.db
    .select()
    .from(dividendLedger)
    .where(
      and(gte(dividendLedger.payDate, fromDate), lte(dividendLedger.payDate, toDate)),
    )
    .orderBy(dividendLedger.payDate);

  if (rows.length === 0) {
    return [
      `📊 *Dividend Ledger ${year}*`,
      '━━━━━━━━━━━━━━',
      '',
      `Sin dividendos registrados para ${year}.`,
      '',
      'Usá /ingest para ingestar transacciones desde Wallbit.',
    ].join('\n');
  }

  const dividendsForEngine: DividendWithFx[] = rows.map((row) => ({
    payDate: row.payDate,
    symbol: row.symbol,
    amountUsd: Number(row.amountUsd),
    whtUsdAmount: Number(row.whtUsd),
    sourceTxUuid: row.sourceTxUuid,
    fxBnaCompradorAtPayDate: Number(row.fxBnaComprador),
  }));

  const projection = projectIncomeTaxDividends(dividendsForEngine, year);

  const totalUsd = dividendsForEngine.reduce((sum, d) => sum + d.amountUsd, 0);

  const detalle = rows
    .slice(0, 20) // máximo 20 líneas para no superar el límite de Telegram
    .map((r) => `• ${r.payDate}  ${r.symbol.padEnd(6)}  USD ${fmtNum(Number(r.amountUsd), 2)}  → ARS ${fmtNum(Number(r.amountArs), 0)}`)
    .join('\n');

  const truncado = rows.length > 20 ? `\n_... y ${rows.length - 20} más_` : '';

  const warningLines =
    projection.warnings.length > 0
      ? '\n' + projection.warnings.map((w) => `⚠️ ${w}`).join('\n')
      : '';

  return [
    `📊 *Dividend Ledger ${year}*`,
    '━━━━━━━━━━━━━━',
    `💵 Total cobrado: USD ${fmtNum(totalUsd, 2)}`,
    `🇦🇷 Equivalente ARS: $${fmtNum(projection.totalGrossArs, 0)}`,
    `🧾 Impuesto proyectado (Art.94): $${fmtNum(projection.incomeTaxArs, 0)}`,
    `🪙 Crédito fiscal WHT: $${fmtNum(projection.foreignTaxCreditArs, 0)}`,
    `💸 Neto a pagar AR: $${fmtNum(projection.netTaxArs, 0)}`,
    '',
    '── Detalle ──',
    detalle,
    truncado,
    warningLines,
  ].join('\n');
}

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
