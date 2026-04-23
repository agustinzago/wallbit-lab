// Re-exports públicos del SDK. Todo lo que no está acá se considera interno.

export { WallbitClient } from './client.js';
export type { WallbitClientConfig } from './config.js';

export {
  WallbitError,
  WallbitAuthError,
  WallbitPreconditionError,
  // Alias legacy mientras actualizamos consumidores.
  WallbitKycError,
  WallbitNotFoundError,
  WallbitValidationError,
  WallbitRateLimitError,
  WallbitServerError,
  WallbitNetworkError,
} from './errors.js';
export type { WallbitErrorOptions } from './errors.js';

export {
  CurrencyCodeSchema,
  CheckingBalanceSchema,
  StocksPositionSchema,
  TransactionSchema,
  TransactionCurrencyRefSchema,
  TradeSchema,
  TradeDirectionSchema,
  OrderTypeSchema,
  TimeInForceSchema,
  AssetSchema,
  AssetCategorySchema,
  AssetDividendSchema,
  WalletSchema,
  WalletCurrencySchema,
  WalletNetworkSchema,
  AccountBucketSchema,
  AccountDetailsSchema,
  AccountDetailsAddressSchema,
  ExchangeRateSchema,
  FeeSettingSchema,
  FeeTypeSchema,
  CardSchema,
  CardStatusSchema,
  CardTypeSchema,
  RiskProfileSchema,
  RoboAdvisorAssetSchema,
  PortfolioPerformanceSchema,
  PortfolioAllocationSchema,
  PortfolioTypeSchema,
  ChestCategorySchema,
  RoboAdvisorPortfolioSchema,
  RoboAdvisorTransactionSchema,
  RoboAdvisorTransactionTypeSchema,
  RoboAdvisorTransactionStatusSchema,
} from './types.js';
export type {
  CurrencyCode,
  CheckingBalance,
  StocksPosition,
  Transaction,
  TransactionType,
  TransactionCurrencyRef,
  Trade,
  TradeDirection,
  OrderType,
  TimeInForce,
  Asset,
  AssetCategory,
  AssetDividend,
  Wallet,
  WalletCurrency,
  WalletNetwork,
  AccountBucket,
  AccountDetails,
  AccountDetailsAddress,
  ExchangeRate,
  FeeSetting,
  FeeType,
  Card,
  CardStatus,
  CardType,
  RiskProfile,
  RoboAdvisorAsset,
  PortfolioPerformance,
  PortfolioAllocation,
  PortfolioType,
  ChestCategory,
  RoboAdvisorPortfolio,
  RoboAdvisorTransaction,
  RoboAdvisorTransactionType,
  RoboAdvisorTransactionStatus,
  Paginated,
} from './types.js';

export type {
  ListTransactionsParams,
  ListTransactionsResult,
  TransactionsPageLimit,
} from './endpoints/transactions.js';
export type { PlaceTradeInput } from './endpoints/trades.js';
export type { InternalTransferInput } from './endpoints/operations.js';
export type { GetWalletsParams } from './endpoints/wallets.js';
export type { ListAssetsParams, ListAssetsResult } from './endpoints/assets.js';
export type {
  AccountCountry,
  AccountCurrency,
  GetAccountDetailsParams,
} from './endpoints/accountDetails.js';
export type { GetRateParams } from './endpoints/rates.js';
export type { GetFeesParams } from './endpoints/fees.js';
export type {
  RoboAdvisorDepositInput,
  RoboAdvisorWithdrawInput,
} from './endpoints/roboadvisor.js';
