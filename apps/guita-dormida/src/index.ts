// Entry point de guita-dormida. Orquesta: config → SDK → ingest → analyzer →
// reporter → canal de notificación. Exit code 0 en éxito, 1 en cualquier falla.

import { WallbitClient } from '@wallbit-lab/sdk';
import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { ConsoleChannel, TelegramChannel, type NotificationChannel } from '@wallbit-lab/notify';
import { IdleCapitalAnalyzer } from './analyzer.js';
import { buildReport } from './reporter.js';
import { ConfigError, loadConfig } from './config.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const client = new WallbitClient({
    apiKey: config.wallbitApiKey,
    ...(config.wallbitBaseUrl !== undefined ? { baseUrl: config.wallbitBaseUrl } : {}),
  });

  const poller = new TransactionPoller({ client });

  const analyzer = new IdleCapitalAnalyzer({
    client,
    poller,
    analysisDays: config.analysisDays,
    idleThresholdUsd: config.idleThresholdUsd,
    checkingBufferMultiplier: config.checkingBufferMultiplier,
  });

  const result = await analyzer.analyze();
  const report = buildReport(result);

  const consoleChannel = new ConsoleChannel();
  await consoleChannel.send({ text: report, parseMode: 'Markdown' });

  if (!config.dryRun) {
    const telegram: NotificationChannel = new TelegramChannel({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
    });
    await telegram.send({ text: report, parseMode: 'Markdown' });
    // eslint-disable-next-line no-console
    console.log('[guita-dormida] Reporte enviado por Telegram.');
  } else {
    // eslint-disable-next-line no-console
    console.log('[guita-dormida] DRY_RUN activo: no se mandó Telegram.');
  }
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    // eslint-disable-next-line no-console
    console.error(err.message);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error('[guita-dormida] Fallo inesperado:', err);
  process.exit(1);
});
