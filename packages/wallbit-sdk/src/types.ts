// Tipos públicos del SDK. Las shapes se derivan de schemas zod para tener validación
// en runtime + tipos estáticos en una sola fuente.
//
// TODO(verify-api): la API pública de Wallbit no documenta todos los shapes en detalle
// al momento de escribir esto. Los schemas acá son el "mejor esfuerzo" — hay que
// ajustar a medida que probemos contra la API real.

import { z } from 'zod';

export const CurrencySchema = z.enum(['USD', 'EUR', 'ARS', 'USDT', 'USDC', 'BTC', 'ETH']);
export type Currency = z.infer<typeof CurrencySchema>;

export const TransactionTypeSchema = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRADE',
  'DIVIDEND',
  'INTEREST',
  'INTERNAL_TRANSFER',
  'CARD_PAYMENT',
  'FEE',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// Los montos viajan como string decimal para evitar pérdida de precisión con floats.
export const TransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  currency: CurrencySchema,
  amount: z.string(),
  date: z.string().datetime(),
  description: z.string().optional(),
  merchantName: z.string().optional(),
  assetSymbol: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const BalanceSchema = z.object({
  currency: CurrencySchema,
  available: z.string(),
  pending: z.string().optional(),
  total: z.string(),
});
export type Balance = z.infer<typeof BalanceSchema>;

export const AssetCategorySchema = z.enum([
  'ETF',
  'STOCK',
  'ARGENTINA_ADR',
  'TREASURY_BILL',
  'DIVIDENDS',
  'CRYPTO',
  'BOND',
  'OTHER',
]);
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

export const AssetSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  category: AssetCategorySchema,
  price: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const TradeTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);
export type TradeType = z.infer<typeof TradeTypeSchema>;

export const TradeSideSchema = z.enum(['BUY', 'SELL']);
export type TradeSide = z.infer<typeof TradeSideSchema>;

export const TradeOrderSchema = z.object({
  symbol: z.string(),
  type: TradeTypeSchema,
  side: TradeSideSchema,
  quantity: z.string(),
  limitPrice: z.string().optional(),
  stopPrice: z.string().optional(),
});
export type TradeOrder = z.infer<typeof TradeOrderSchema>;
