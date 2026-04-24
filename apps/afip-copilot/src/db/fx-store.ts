// Implementación de FxRateStore contra Drizzle + Postgres.
// Esta es la implementación concreta que usa afip-copilot en producción.
// Los tests usan InMemoryFxStore del package fx-ars.

import { eq, and } from 'drizzle-orm';
import type { FxQuote, FxRateStore, FxSide } from '@wallbit-lab/fx-ars';
import type { Db } from './client.js';
import { fxRatesDaily } from './schema.js';

export class PostgresFxStore implements FxRateStore {
  constructor(private readonly db: Db) {}

  async get(params: { date: string; side: FxSide }): Promise<FxQuote | null> {
    const rows = await this.db
      .select()
      .from(fxRatesDaily)
      .where(
        and(
          eq(fxRatesDaily.date, params.date),
          eq(fxRatesDaily.currency, 'USD'),
          eq(fxRatesDaily.side, params.side),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      date: row.date,
      currency: 'USD',
      side: row.side as FxSide,
      rate: Number(row.rate),
      source: row.source as FxQuote['source'],
      fetchedAt: row.fetchedAt,
    };
  }

  async set(quote: FxQuote): Promise<void> {
    await this.db
      .insert(fxRatesDaily)
      .values({
        date: quote.date,
        currency: quote.currency,
        side: quote.side,
        rate: String(quote.rate),
        source: quote.source,
        fetchedAt: quote.fetchedAt,
      })
      .onConflictDoNothing();
  }
}
