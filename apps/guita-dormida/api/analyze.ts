// Handler serverless para Vercel Cron. Misma lógica que el entry CLI pero
// expuesta como HTTP endpoint para que Vercel Cron la dispare en horario.
//
// Autenticación: Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Si la
// env var está seteada exigimos el header — en Hobby/Pro Vercel también filtra
// por defecto los requests que no vienen de su scheduler, pero el check explícito
// es defense-in-depth por si cambia ese default o querés trigger manual con curl.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { WallbitClient } from '@wallbit-lab/sdk';
import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { TelegramChannel } from '@wallbit-lab/notify';
import { IdleCapitalAnalyzer } from '../src/analyzer.js';
import { buildReport } from '../src/reporter.js';
import { ConfigError, loadConfig } from '../src/config.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret !== undefined && cronSecret.length > 0) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
  }

  try {
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

    if (!config.dryRun) {
      const telegram = new TelegramChannel({
        botToken: config.telegramBotToken,
        chatId: config.telegramChatId,
      });
      await telegram.send({ text: report, parseMode: 'Markdown' });
    }

    res.status(200).json({
      ok: true,
      dryRun: config.dryRun,
      analyzedAt: result.analyzedAt.toISOString(),
      totalIdleUSD: result.totalIdleUSD,
      totalOpportunityCost: result.totalOpportunityCost,
      hasIdle: result.hasIdle,
      idleAssetCount: result.idleAssets.length,
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      res.status(500).json({ ok: false, error: 'config', message: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    // eslint-disable-next-line no-console
    console.error('[guita-dormida/api] analyze failed:', err);
    res.status(500).json({ ok: false, error: 'analyze_failed', message });
  }
}
