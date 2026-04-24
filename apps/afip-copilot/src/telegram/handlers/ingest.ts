// Handler del comando /ingest.
// Fuerza una ingesta manual de dividendos de los últimos 90 días.

import { WallbitClient } from '@wallbit-lab/sdk';
import { DividendDetector } from '../../ingest/dividend-detector.js';
import { DividendIngester } from '../../ingest/dividend-ingester.js';
import type { CommandContext } from '../router.js';

export async function handleIngest(ctx: CommandContext): Promise<string> {
  const detector = new DividendDetector({ dividendTypes: ctx.config.dividendTxTypes });
  const ingester = new DividendIngester({
    client: ctx.wallbit,
    detector,
    fx: ctx.fx,
    db: ctx.db,
    logger: ctx.logger,
  });

  const result = await ingester.ingestWindow({ days: 90 });

  return [
    `✅ *Ingesta completada*`,
    `• Transacciones revisadas: ${result.found} dividendos detectados`,
    `• Insertadas: ${result.inserted}`,
    `• Saltadas (ya existían o sin FX): ${result.skipped}`,
    '',
    result.inserted === 0 && result.found > 0
      ? '_Todos los dividendos ya estaban en el ledger._'
      : result.found === 0
        ? '_No se encontraron dividendos en los últimos 90 días. Verificá DIVIDEND_TX_TYPES._'
        : '',
  ]
    .filter(Boolean)
    .join('\n');
}
