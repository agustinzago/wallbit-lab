// Entry point del cron semanal.
// Diseñado para ser disparado por cron externo (systemd timer, Railway cron, k8s CronJob).
// Corre una sola vez y termina con exit 0 en éxito, exit 1 en falla.

import { WallbitClient } from '@wallbit-lab/sdk';
import { ConfigError, loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { createFxService } from './fx/factory.js';
import { createLogger } from './logger.js';
import { runWeeklySnapshot } from './cron/weekly.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const db = createDb(config.databaseUrl);
  const fx = createFxService(db, logger);
  const wallbit = new WallbitClient({
    apiKey: config.wallbitApiKey,
    ...(config.wallbitBaseUrl !== undefined ? { baseUrl: config.wallbitBaseUrl } : {}),
  });

  const result = await runWeeklySnapshot({ config, db, fx, wallbit, logger });

  console.log('[cron] weekly snapshot completado', result);
  process.exit(0);
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error('[cron] Fallo inesperado:', err);
  process.exit(1);
});
