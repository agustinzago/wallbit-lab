// Router de comandos de Telegram. Cada handler recibe un CommandContext con
// todas las dependencias inyectadas y devuelve el texto de respuesta.

import type { FxService } from '@wallbit-lab/fx-ars';
import type { WallbitClient } from '@wallbit-lab/sdk';
import type { Db } from '../db/client.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { handleLedger } from './handlers/ledger.js';
import { handleIngest } from './handlers/ingest.js';
import { handleProbeTxTypes } from './handlers/probe.js';
import { handleStatus } from './handlers/status.js';
import { handleSimulate } from './handlers/simulate.js';
import { handleImportCostBasis } from './handlers/import-cost-basis.js';
import { handleExport } from './handlers/export.js';

export interface CommandContext {
  readonly args: readonly string[];
  readonly rawText: string;
  readonly db: Db;
  readonly fx: FxService;
  readonly config: AppConfig;
  readonly wallbit: WallbitClient;
  readonly logger: Logger;
}

export type CommandHandler = (ctx: CommandContext) => Promise<string>;

function handleStart(_ctx: CommandContext): Promise<string> {
  return Promise.resolve(
    '👋 Hola, soy *AFIP Copilot* — tu asistente fiscal para el portfolio en Wallbit.\n\nUsá /help para ver los comandos disponibles.',
  );
}

function handleHelp(_ctx: CommandContext): Promise<string> {
  return Promise.resolve(
    [
      '📋 *Comandos disponibles:*',
      '',
      '`/start` — Iniciar el bot',
      '`/help` — Mostrar este mensaje',
      '`/status` — Patrimonio + proyección de Bienes Personales',
      '`/ledger [year]` — Ledger de dividendos y proyección de Ganancias',
      '`/ingest` — Forzar ingesta de dividendos (últimos 90 días)',
      '`/probe_tx_types` — Descubrir tipos de transacción reales de Wallbit',
      '`/simulate <SYMBOL> <SHARES>` — Simular venta (impacto fiscal)',
      '`/import_cost_basis` — Importar cost basis desde CSV',
      '`/export [year]` — Exportar resumen fiscal al contador (CSV + MD)',
    ].join('\n'),
  );
}

export const COMMANDS: Record<string, CommandHandler> = {
  '/start': handleStart,
  '/help': handleHelp,
  '/status': handleStatus,
  '/ledger': handleLedger,
  '/ingest': handleIngest,
  '/probe_tx_types': handleProbeTxTypes,
  '/simulate': handleSimulate,
  '/import_cost_basis': handleImportCostBasis,
  '/export': handleExport,
};

export function parseCommand(text: string): { command: string; args: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  // Extraer el comando (hasta el primer espacio o arroba), y los args.
  const parts = trimmed.split(/\s+/);
  const commandRaw = parts[0] ?? '';
  // Remover el @botname si viene incluido (ej. /start@MiBotname).
  const command = commandRaw.split('@')[0] ?? commandRaw;
  const args = parts.slice(1);

  return { command, args };
}

export async function dispatch(text: string, ctx: CommandContext): Promise<string> {
  const parsed = parseCommand(text);
  if (!parsed) {
    return 'No entendí ese comando. Usá /help para ver los disponibles.';
  }

  const handler = COMMANDS[parsed.command];
  if (!handler) {
    return `Comando \`${parsed.command}\` no reconocido. Usá /help para ver los disponibles.`;
  }

  return handler({ ...ctx, args: parsed.args });
}
