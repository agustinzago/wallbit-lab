// Handler del comando /import_cost_basis.
// Responde pidiendo un CSV adjunto. El Runtime debe detectar el documento
// entrante y enrutar a processCostBasisDocument().

import { CsvImporter } from '../../cost-basis/csv-importer.js';
import type { CommandContext } from '../router.js';

export async function handleImportCostBasis(ctx: CommandContext): Promise<string> {
  return [
    '📎 *Importar cost basis*',
    '',
    'Mandame un CSV con las columnas:',
    '`date,symbol,shares,price_usd,side`',
    '',
    'Donde:',
    '• `date` — formato YYYY-MM-DD',
    '• `symbol` — ticker (ej. AAPL)',
    '• `shares` — cantidad (ej. 100)',
    '• `price_usd` — precio por share en USD al momento de la operación',
    '• `side` — `BUY` o `SELL`',
    '',
    'Ejemplo:',
    '```',
    'date,symbol,shares,price_usd,side',
    '2023-06-15,AAPL,100,185.50,BUY',
    '2024-01-10,SPY,50,470.00,BUY',
    '2024-03-20,AAPL,25,190.00,SELL',
    '```',
    '',
    '_Mandá el archivo como documento en tu próximo mensaje._',
  ].join('\n');
}

/**
 * Procesa un documento CSV recibido vía Telegram.
 * Llama al CsvImporter y retorna el resumen.
 */
export async function processCostBasisDocument(
  csvContent: string,
  ctx: CommandContext,
): Promise<string> {
  const importer = new CsvImporter(ctx.db, ctx.logger);

  let result;
  try {
    result = await importer.import(csvContent);
  } catch (err) {
    return `❌ Error procesando el CSV: ${err instanceof Error ? err.message : String(err)}`;
  }

  const warningLines =
    result.warnings.length > 0
      ? '\n⚠️ Advertencias:\n' + result.warnings.map((w) => `  • ${w}`).join('\n')
      : '';

  return [
    `✅ *Cost basis importado*`,
    `• Filas procesadas: ${result.rowsProcessed}`,
    `• Lotes insertados: ${result.inserted}`,
    `• Saltados (duplicados o inválidos): ${result.skipped}`,
    warningLines,
  ]
    .filter(Boolean)
    .join('\n');
}
