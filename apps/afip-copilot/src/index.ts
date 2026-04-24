// Entry point de afip-copilot. Orquesta: config → DB → FX → Wallbit → TelegramRuntime.
// Solo usa console.log en este archivo (convención repo: no console.log en packages).

import { WallbitClient } from '@wallbit-lab/sdk';
import { ConfigError, loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { createFxService } from './fx/factory.js';
import { createLogger } from './logger.js';
import { TelegramRuntime } from './telegram/runtime.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const db = createDb(config.databaseUrl);
  const fx = createFxService(db, logger);
  const wallbit = new WallbitClient({
    apiKey: config.wallbitApiKey,
    ...(config.wallbitBaseUrl !== undefined ? { baseUrl: config.wallbitBaseUrl } : {}),
  });

  const runtime = new TelegramRuntime({ config, db, fx, wallbit, logger });

  process.on('SIGTERM', () => runtime.stop());
  process.on('SIGINT', () => runtime.stop());

  console.log('[afip-copilot] Bot arrancando, escuchando chat_id', config.telegramChatId);

  await runtime.run();
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error('[afip-copilot] Fallo inesperado:', err);
  process.exit(1);
});
