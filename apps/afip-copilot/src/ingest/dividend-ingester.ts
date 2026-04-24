// Ingesta idempotente de dividendos.
// Cada transacción dividendo se persiste con su FX bloqueado al pay_date.
// Idempotencia garantizada por ON CONFLICT DO NOTHING en source_tx_uuid.

import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import type { FxService } from '@wallbit-lab/fx-ars';
import type { WallbitClient } from '@wallbit-lab/sdk';
import { dividendLedger } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { Logger } from '../logger.js';
import type { DividendDetector } from './dividend-detector.js';

export interface DividendIngesterOptions {
  readonly client: WallbitClient;
  readonly detector: DividendDetector;
  readonly fx: FxService;
  readonly db: Db;
  readonly logger: Logger;
}

export interface IngestResult {
  readonly found: number;
  readonly inserted: number;
  readonly skipped: number;
}

export class DividendIngester {
  private readonly poller: TransactionPoller;

  constructor(private readonly opts: DividendIngesterOptions) {
    this.poller = new TransactionPoller({ client: opts.client, logger: opts.logger });
  }

  async ingestWindow(params: { days: number }): Promise<IngestResult> {
    const txs = await this.poller.fetchRecent({ days: params.days });
    const dividends = txs.filter((tx) => this.opts.detector.isDividend(tx));

    this.opts.logger.info('ingest: dividendos encontrados', {
      total: txs.length,
      dividends: dividends.length,
    });

    let inserted = 0;
    let skipped = 0;

    for (const tx of dividends) {
      const payDate = this.opts.detector.extractPayDate(tx);

      let fxRate: number;
      try {
        const fxQuote = await this.opts.fx.getBnaDivisa({ date: payDate, side: 'buyer' });
        fxRate = fxQuote.rate;
      } catch (err) {
        this.opts.logger.warn('ingest: no se pudo obtener FX para dividendo, saltando', {
          txUuid: tx.uuid,
          payDate,
          err: err instanceof Error ? err.message : String(err),
        });
        skipped++;
        continue;
      }

      // TODO(verify-api): confirmar qué campo tiene el monto del dividendo.
      // Hipótesis: dest_amount (monto recibido en la cuenta destino).
      const amountUsd = tx.dest_amount;
      const amountArs = Math.round(amountUsd * fxRate * 100) / 100;

      const symbol = this.opts.detector.extractSymbol(tx) ?? 'UNKNOWN';

      const payload = {
        sourceTxUuid: tx.uuid,
        payDate,
        symbol,
        amountUsd: String(amountUsd),
        fxBnaComprador: String(fxRate),
        amountArs: String(amountArs),
        whtUsd: '0', // TODO(verify-api): si Wallbit expone WHT, capturarlo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawTx: tx as Record<string, any>,
      };

      const res = await this.opts.db
        .insert(dividendLedger)
        .values(payload)
        .onConflictDoNothing()
        .returning();

      if (res.length > 0) {
        inserted++;
        this.opts.logger.debug('ingest: dividendo persistido', { uuid: tx.uuid, symbol, amountUsd });
      } else {
        skipped++;
      }
    }

    return { found: dividends.length, inserted, skipped };
  }
}
