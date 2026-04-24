// Handler del comando /probe_tx_types.
// Descubre los tipos de transacción reales de Wallbit.

import { probeTxTypes } from '../../ingest/tx-types-probe.js';
import type { CommandContext } from '../router.js';

export async function handleProbeTxTypes(ctx: CommandContext): Promise<string> {
  const result = await probeTxTypes(ctx.wallbit, ctx.logger);
  return result.message;
}
