// Handler del comando /export [year].
// Genera un CSV del ledger de dividendos y un resumen MD para el contador,
// y los envía como documentos adjuntos en Telegram.

import { buildCsvLedger } from '../../export/csv-ledger.js';
import { buildMdSummary } from '../../export/md-summary.js';
import { sendTelegramDocument } from '../send-document.js';
import type { CommandContext } from '../router.js';

export async function handleExport(ctx: CommandContext): Promise<string> {
  const year = ctx.args[0] ? Number(ctx.args[0]) : ctx.config.fiscalYear;

  if (!Number.isFinite(year) || year < 2020 || year > 2030) {
    return `Año inválido: \`${ctx.args[0]}\`. Ejemplo: /export 2025`;
  }

  let csv: string;
  let md: string;

  try {
    [csv, md] = await Promise.all([
      buildCsvLedger(ctx.db, year),
      buildMdSummary(ctx.db, year, ctx.config),
    ]);
  } catch (err) {
    return `❌ Error generando el export: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    await sendTelegramDocument(ctx.config, {
      filename: `dividend-ledger-${year}.csv`,
      content: csv,
      mimeType: 'text/csv',
    });

    await sendTelegramDocument(ctx.config, {
      filename: `tax-summary-${year}.md`,
      content: md,
      mimeType: 'text/markdown',
    });
  } catch (err) {
    return `❌ Error enviando archivos: ${err instanceof Error ? err.message : String(err)}`;
  }

  return `📎 Exportación ${year} enviada (2 archivos).`;
}
