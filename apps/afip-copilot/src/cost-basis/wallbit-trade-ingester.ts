// Ingestor incremental de trades desde Wallbit.
// Convierte BUY/SELL a cost basis lots en la DB.
// TODO(verify-api): confirmar qué Transaction.type usa Wallbit para BUY/SELL de acciones.

import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import type { FxService } from '@wallbit-lab/fx-ars';
import type { WallbitClient } from '@wallbit-lab/sdk';
import { costBasisLots } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { Logger } from '../logger.js';

// TODO(verify-api): ajustar estos tipos cuando se confirme con la API real.
const BUY_TYPES = ['BUY', 'ROBOADVISOR_BUY', 'STOCK_BUY'];
const SELL_TYPES = ['SELL', 'ROBOADVISOR_SELL', 'STOCK_SELL'];

export interface WallbitTradeIngesterOptions {
  readonly client: WallbitClient;
  readonly fx: FxService;
  readonly db: Db;
  readonly logger: Logger;
}

export interface TradeIngestResult {
  readonly buyInserted: number;
  readonly sellProcessed: number;
  readonly skipped: number;
}

export class WallbitTradeIngester {
  private readonly poller: TransactionPoller;

  constructor(private readonly opts: WallbitTradeIngesterOptions) {
    this.poller = new TransactionPoller({ client: opts.client, logger: opts.logger });
  }

  async ingestWindow(params: { days: number }): Promise<TradeIngestResult> {
    const txs = await this.poller.fetchRecent({ days: params.days });
    const trades = txs.filter(
      (tx) => BUY_TYPES.includes(tx.type) || SELL_TYPES.includes(tx.type),
    );

    this.opts.logger.info('trade-ingester: trades encontrados', { total: trades.length });

    let buyInserted = 0;
    let sellProcessed = 0;
    let skipped = 0;

    for (const tx of trades) {
      const tradeDate = tx.created_at.slice(0, 10);
      const isBuy = BUY_TYPES.includes(tx.type);

      if (isBuy) {
        let fxRate = 0;
        try {
          const fxQuote = await this.opts.fx.getBnaDivisa({ date: tradeDate, side: 'seller' });
          fxRate = fxQuote.rate;
        } catch {
          this.opts.logger.warn('trade-ingester: sin FX para BUY, usando 0', {
            txUuid: tx.uuid,
            date: tradeDate,
          });
        }

        // TODO(verify-api): confirmar campos de símbolo y shares en la transaction.
        // Por ahora extraemos del comment o usamos 'UNKNOWN'.
        const symbol = 'UNKNOWN'; // TODO(verify-api)
        const shares = tx.dest_amount; // TODO(verify-api): confirmar
        const priceUsd = 0; // TODO(verify-api)

        const res = await this.opts.db
          .insert(costBasisLots)
          .values({
            id: `wallbit-${tx.uuid}`,
            symbol,
            purchaseDate: tradeDate,
            shares: String(shares),
            remainingShares: String(shares),
            priceUsd: String(priceUsd),
            fxBnaVendedor: String(fxRate),
            source: 'wallbit_trade',
            sourceRef: tx.uuid,
          })
          .onConflictDoNothing()
          .returning();

        if (res.length > 0) buyInserted++;
        else skipped++;
      } else {
        // SELL: leer símbolo y shares del tx, consumir lotes FIFO.
        // TODO(verify-api): implementar cuando se confirme el shape del tx de venta.
        sellProcessed++;
      }
    }

    return { buyInserted, sellProcessed, skipped };
  }
}
