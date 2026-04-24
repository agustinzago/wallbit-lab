// Runner del snapshot semanal.
// Pipeline: ingest dividendos → ingest trades → consolidar → proyectar BP →
//           calcular Art.94 YTD → persistir snapshot → comparar → enviar reporte.

import { randomUUID } from 'crypto';
import { desc, gte, lte, and } from 'drizzle-orm';
import { projectBienesPersonales, projectIncomeTaxDividends } from '@wallbit-lab/ar-tax-engine';
import type { DividendWithFx } from '@wallbit-lab/ar-tax-engine';
import type { FxService } from '@wallbit-lab/fx-ars';
import type { WallbitClient } from '@wallbit-lab/sdk';
import { TelegramChannel } from '@wallbit-lab/notify';
import { splitForTelegram } from '@wallbit-lab/notify';
import type { Db } from '../db/client.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { dividendLedger, taxSnapshots } from '../db/schema.js';
import { PortfolioConsolidator } from '../portfolio/consolidator.js';
import { DividendDetector } from '../ingest/dividend-detector.js';
import { DividendIngester } from '../ingest/dividend-ingester.js';
import { WallbitTradeIngester } from '../cost-basis/wallbit-trade-ingester.js';
import { formatWeeklyReport } from './reporter.js';

export interface WeeklySnapshotOptions {
  readonly config: AppConfig;
  readonly db: Db;
  readonly fx: FxService;
  readonly wallbit: WallbitClient;
  readonly logger: Logger;
}

export interface WeeklySnapshotResult {
  readonly snapshotId: string;
  readonly dividendsIngested: number;
  readonly tradesIngested: number;
  readonly bpProjectedArs: number;
}

export async function runWeeklySnapshot(opts: WeeklySnapshotOptions): Promise<WeeklySnapshotResult> {
  const { config, db, fx, wallbit, logger } = opts;

  // Paso 1: ingestar dividendos de los últimos 7 días.
  const detector = new DividendDetector({ dividendTypes: config.dividendTxTypes });
  const divIngester = new DividendIngester({ client: wallbit, detector, fx, db, logger });
  const divResult = await divIngester.ingestWindow({ days: 7 });
  logger.info('cron: dividendos ingestados', { found: divResult.found, inserted: divResult.inserted });

  // Paso 2: ingestar trades de los últimos 7 días.
  const tradeIngester = new WallbitTradeIngester({ client: wallbit, fx, db, logger });
  const tradeResult = await tradeIngester.ingestWindow({ days: 7 });
  logger.info('cron: trades ingestados', { buyInserted: tradeResult.buyInserted, skipped: tradeResult.skipped });

  // Paso 3: consolidar portfolio.
  const consolidator = new PortfolioConsolidator(wallbit, config, logger);
  const portfolio = await consolidator.snapshot();

  // Paso 4: TC del día.
  const today = portfolio.valuationDate;
  const fxQuote = await fx.getBnaDivisa({ date: today, side: 'buyer' });

  // Paso 5: proyectar BP.
  const bpProjection = projectBienesPersonales({
    period: config.fiscalYear,
    portfolio,
    fxBnaComprador: fxQuote.rate,
    isCumplidor: config.contribuyenteCumplidor,
    isReibpAdherido: config.reibpAdherido,
  });

  // Paso 6: dividendos YTD para Art. 94.
  const fromDate = `${config.fiscalYear}-01-01`;
  const toDate = `${config.fiscalYear}-12-31`;
  const divRows = await db
    .select()
    .from(dividendLedger)
    .where(and(gte(dividendLedger.payDate, fromDate), lte(dividendLedger.payDate, toDate)));

  const dividendsForEngine: DividendWithFx[] = divRows.map((row) => ({
    payDate: row.payDate,
    symbol: row.symbol,
    amountUsd: Number(row.amountUsd),
    whtUsdAmount: Number(row.whtUsd),
    sourceTxUuid: row.sourceTxUuid,
    fxBnaCompradorAtPayDate: Number(row.fxBnaComprador),
  }));

  const incomeTaxProjection = projectIncomeTaxDividends(dividendsForEngine, config.fiscalYear);

  const totalUsd =
    portfolio.usdCashBroker +
    portfolio.positions.reduce((sum, p) => sum + p.shares * p.priceUsd, 0);

  // Paso 7: persistir snapshot.
  const snapshotId = randomUUID();
  await db.insert(taxSnapshots).values({
    id: snapshotId,
    snapshotAt: new Date(),
    fiscalYear: config.fiscalYear,
    bpProjectedArs: String(bpProjection.impuestoArs),
    patrimonioArs: String(bpProjection.valuatedAssetsArs),
    patrimonioUsd: String(totalUsd),
    dividendsYtdArs: String(incomeTaxProjection.totalGrossArs),
    incomeTaxYtdArs: String(incomeTaxProjection.incomeTaxArs),
    payload: { tramo: bpProjection.tramo, warnings: bpProjection.warnings },
  });

  // Paso 8: obtener snapshot anterior.
  const prevSnapshots = await db
    .select()
    .from(taxSnapshots)
    .orderBy(desc(taxSnapshots.snapshotAt))
    .limit(2);

  const previousSnapshot = prevSnapshots.length >= 2 ? prevSnapshots[1] ?? null : null;

  // Paso 9: armar reporte y enviar por Telegram.
  const nextReportDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const currentSnapshot = prevSnapshots[0]!;

  const reportText = formatWeeklyReport({
    current: currentSnapshot,
    previous: previousSnapshot,
    fiscalYear: config.fiscalYear,
    newDividendCount: divResult.inserted,
    nextReportDate,
  });

  const channel = new TelegramChannel({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
    logger,
  });

  for (const chunk of splitForTelegram(reportText)) {
    await channel.send({ text: chunk, parseMode: 'Markdown' });
  }

  logger.info('cron: snapshot semanal completado', { snapshotId, bpProjectedArs: bpProjection.impuestoArs });

  return {
    snapshotId,
    dividendsIngested: divResult.inserted,
    tradesIngested: tradeResult.buyInserted,
    bpProjectedArs: bpProjection.impuestoArs,
  };
}
