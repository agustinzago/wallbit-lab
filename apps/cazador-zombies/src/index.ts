// Entry point de cazador-zombies. Orquesta: config → SDK → ingest → classifier
// → hunter → reporter → canal de notificación. Exit code 0 en éxito, 1 en
// cualquier falla.

import { WallbitClient } from '@wallbit-lab/sdk';
import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { MerchantClassifier } from '@wallbit-lab/merchant-classifier';
import { ConsoleChannel, TelegramChannel, type NotificationChannel } from '@wallbit-lab/notify';
import { ZombieHunter } from './hunter.js';
import { buildReport } from './reporter.js';
import { ConfigError, loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const client = new WallbitClient({
    apiKey: config.wallbitApiKey,
    ...(config.wallbitBaseUrl !== undefined ? { baseUrl: config.wallbitBaseUrl } : {}),
  });

  const poller = new TransactionPoller({ client });
  const classifier = new MerchantClassifier({
    geminiApiKey: config.geminiApiKey,
  });

  const hunter = new ZombieHunter({
    poller,
    classifier,
    analysisDays: config.analysisDays,
    priceIncreaseThreshold: config.priceIncreaseThreshold,
  });

  const result = await hunter.hunt();
  const report = buildReport(result);

  const consoleChannel = new ConsoleChannel();
  await consoleChannel.send({ text: report, parseMode: 'Markdown' });

  const s = result.classifierStats;
  // eslint-disable-next-line no-console
  console.log(
    `[cazador-zombies] Clasificación: ${s.dictionaryHits} por diccionario, ${s.apiCalls} vía Claude Haiku (${s.apiFailures} fallidas), ${s.cacheHits} cache hits.`,
  );

  if (!config.dryRun) {
    const telegram: NotificationChannel = new TelegramChannel({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
    });
    await telegram.send({ text: report, parseMode: 'Markdown' });
    // eslint-disable-next-line no-console
    console.log('[cazador-zombies] Reporte enviado por Telegram.');
  } else {
    // eslint-disable-next-line no-console
    console.log('[cazador-zombies] DRY_RUN activo: no se mandó Telegram.');
  }
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    // eslint-disable-next-line no-console
    console.error(err.message);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error('[cazador-zombies] Fallo inesperado:', err);
  process.exit(1);
});
