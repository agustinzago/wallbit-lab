import {
  pgTable,
  text,
  numeric,
  timestamp,
  date,
  integer,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const fxRatesDaily = pgTable(
  'fx_rates_daily',
  {
    date: date('date').notNull(),
    currency: text('currency').notNull(),
    side: text('side').notNull(),
    rate: numeric('rate', { precision: 20, scale: 8 }).notNull(),
    source: text('source').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.date, t.currency, t.side] }) }),
);

export const dividendLedger = pgTable('dividend_ledger', {
  sourceTxUuid: text('source_tx_uuid').primaryKey(),
  payDate: date('pay_date').notNull(),
  symbol: text('symbol').notNull(),
  amountUsd: numeric('amount_usd', { precision: 20, scale: 8 }).notNull(),
  fxBnaComprador: numeric('fx_bna_comprador', { precision: 20, scale: 8 }).notNull(),
  amountArs: numeric('amount_ars', { precision: 20, scale: 2 }).notNull(),
  whtUsd: numeric('wht_usd', { precision: 20, scale: 8 }).notNull().default('0'),
  rawTx: jsonb('raw_tx').notNull(),
  insertedAt: timestamp('inserted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const costBasisLots = pgTable('cost_basis_lots', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  purchaseDate: date('purchase_date').notNull(),
  shares: numeric('shares', { precision: 20, scale: 8 }).notNull(),
  remainingShares: numeric('remaining_shares', { precision: 20, scale: 8 }).notNull(),
  priceUsd: numeric('price_usd', { precision: 20, scale: 8 }).notNull(),
  fxBnaVendedor: numeric('fx_bna_vendedor', { precision: 20, scale: 8 }).notNull(),
  source: text('source').notNull(), // 'wallbit_trade' | 'manual_csv'
  sourceRef: text('source_ref'),
  insertedAt: timestamp('inserted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxSnapshots = pgTable('tax_snapshots', {
  id: text('id').primaryKey(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
  fiscalYear: integer('fiscal_year').notNull(),
  bpProjectedArs: numeric('bp_projected_ars', { precision: 20, scale: 2 }).notNull(),
  patrimonioArs: numeric('patrimonio_ars', { precision: 20, scale: 2 }).notNull(),
  patrimonioUsd: numeric('patrimonio_usd', { precision: 20, scale: 2 }).notNull(),
  dividendsYtdArs: numeric('dividends_ytd_ars', { precision: 20, scale: 2 }).notNull(),
  incomeTaxYtdArs: numeric('income_tax_ytd_ars', { precision: 20, scale: 2 }).notNull(),
  payload: jsonb('payload').notNull(),
});

export const telegramOffset = pgTable('telegram_offset', {
  id: integer('id').primaryKey(), // siempre 1, tabla singleton
  lastUpdateId: integer('last_update_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
