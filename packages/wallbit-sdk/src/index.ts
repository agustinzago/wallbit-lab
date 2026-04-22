// Re-exports públicos del SDK. Todo lo que no está acá se considera interno.

export { WallbitClient } from './client.js';
export type { WallbitClientConfig } from './config.js';

export {
  WallbitError,
  WallbitAuthError,
  WallbitKycError,
  WallbitValidationError,
  WallbitRateLimitError,
  WallbitServerError,
  WallbitNetworkError,
} from './errors.js';
export type { WallbitErrorOptions } from './errors.js';

export {
  CurrencySchema,
  TransactionTypeSchema,
  TransactionSchema,
  BalanceSchema,
  AssetSchema,
  AssetCategorySchema,
  TradeOrderSchema,
  TradeSideSchema,
  TradeTypeSchema,
} from './types.js';
export type {
  Currency,
  TransactionType,
  Transaction,
  Balance,
  Asset,
  AssetCategory,
  TradeOrder,
  TradeSide,
  TradeType,
} from './types.js';

export type {
  ListTransactionsParams,
  ListTransactionsResult,
} from './endpoints/transactions.js';
export type { PlaceTradeInput, PlacedTrade } from './endpoints/trades.js';
export type {
  InternalTransferInput,
  InternalTransferResult,
  AccountBucket,
} from './endpoints/operations.js';
export type { Wallet } from './endpoints/wallets.js';
export type { AccountDetails } from './endpoints/account.js';
export type { StocksPosition } from './endpoints/balance.js';
