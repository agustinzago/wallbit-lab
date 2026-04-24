// Sonda para descubrir los tipos de transacción reales en Wallbit.
// Corre al arrancar (o por /probe_tx_types) y loguea los tipos únicos encontrados.
// Razón: Transaction.type no está documentado con enum cerrado en la spec pública.

import type { WallbitClient } from '@wallbit-lab/sdk';
import type { Logger } from '../logger.js';

export interface ProbeResult {
  readonly typeCounts: Record<string, number>;
  readonly total: number;
  readonly message: string;
}

export async function probeTxTypes(
  wallbit: WallbitClient,
  logger: Logger,
): Promise<ProbeResult> {
  const typeCounts: Record<string, number> = {};
  let total = 0;

  try {
    // Fetch last 90 days, max 5 pages para no saturar.
    const fromDate = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const toDate = new Date().toISOString().slice(0, 10);

    for (let page = 1; page <= 5; page++) {
      const res = await wallbit.transactions.list({ page, limit: 50, fromDate, toDate });
      if (res.items.length === 0) break;

      for (const tx of res.items) {
        const type = tx.type ?? 'UNKNOWN';
        typeCounts[type] = (typeCounts[type] ?? 0) + 1;
        total++;
      }

      if (res.currentPage >= res.pages) break;
    }
  } catch (err) {
    logger.error('probe: error fetcheando transacciones', {
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      typeCounts: {},
      total: 0,
      message: `Error al fetchear transacciones: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const sorted = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);
  const lines = sorted.map(([type, count]) => `  • ${type}: ${count}`);

  const message = [
    `🔍 *Tipos de transacción encontrados* (${total} txs, últimos 90 días):`,
    ...lines,
    '',
    `Actualizá \`DIVIDEND_TX_TYPES\` en tu .env con el tipo correcto para dividendos.`,
  ].join('\n');

  logger.info('probe: tipos de transacción', { typeCounts });

  return { typeCounts, total, message };
}
