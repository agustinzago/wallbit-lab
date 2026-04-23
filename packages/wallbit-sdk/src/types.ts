// Tipos públicos del SDK. Las shapes se derivan de schemas zod (runtime + estático
// en una sola fuente). El alineamiento es contra la OpenAPI pública de Wallbit
// en https://developer.wallbit.io/docs/api-reference/openapi.json.
//
// Principios:
// - Todos los responses vienen envueltos en `{ data: ... }`. Los tipos que se
//   exportan desde acá son los items *desenvueltos* — el "unwrap" se hace en los
//   endpoints.
// - Los montos viajan como `number` (float) porque la API devuelve floats, no
//   strings. La precisión es la del IEEE-754: para cálculos críticos conviene
//   acumular en enteros (centavos) del lado del consumidor.
// - Los enums que la spec declara cerrados se representan con `z.enum`. Los que
//   la API deja abiertos (ej. `Transaction.type`) se tipan como `z.string()`
//   para no rompernos cuando aparezcan valores nuevos.
// - `.passthrough()` donde la spec no agota la shape: así el schema no falla si
//   Wallbit agrega campos en minor releases.

import { z } from 'zod';

// ── Numeric coercion ────────────────────────────────────────────────────────
// En varias rutas la API responde montos como string en lugar de number (la
// OpenAPI spec dice `type: number` pero el backend los serializa como "1000.5").
// Ejemplos confirmados al momento: `/balance/checking.balance`. Para no
// rompernos con ese drift, todos los campos monetarios/cantitativos pasan por
// este helper en vez de usar `z.number()` directo.
const NumericSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}, z.number());

// ── Currencies ──────────────────────────────────────────────────────────────
// La spec enumera este set cerrado para el filtro de transactions. No incluye
// BTC/ETH: la API pública no trata activos cripto on-chain como currencies de
// transacción; sólo hay USDT/USDC como settlement para wallets.
export const CurrencyCodeSchema = z.enum([
  'USD',
  'EUR',
  'ARS',
  'MXN',
  'USDC',
  'USDT',
  'BOB',
  'COP',
  'PEN',
  'DOP',
  'BRL',
  'PHP',
  'CLP',
  'GTQ',
  'PAB',
  'CRC',
]);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

// ── Balance ─────────────────────────────────────────────────────────────────
// `/balance/checking` — una fila por currency con balance > 0.
export const CheckingBalanceSchema = z
  .object({
    currency: z.string(),
    balance: NumericSchema,
  })
  .passthrough();
export type CheckingBalance = z.infer<typeof CheckingBalanceSchema>;

// `/balance/stocks` — una fila por posición. El cash disponible en la cuenta
// de inversión aparece como un item con `symbol: "USD"`.
export const StocksPositionSchema = z
  .object({
    symbol: z.string(),
    shares: NumericSchema,
  })
  .passthrough();
export type StocksPosition = z.infer<typeof StocksPositionSchema>;

// ── Transactions ────────────────────────────────────────────────────────────
// El tipo `Transaction.type` es string libre en la spec (los ejemplos muestran
// `WITHDRAWAL_LOCAL`, `ROBOADVISOR_DEPOSIT`, `ROBOADVISOR_WITHDRAW`, etc., pero
// sin enum formal). Mantenemos string para no romper con valores nuevos.
export type TransactionType = string;

export const TransactionCurrencyRefSchema = z
  .object({
    code: z.string(),
    alias: z.string(),
  })
  .passthrough();
export type TransactionCurrencyRef = z.infer<typeof TransactionCurrencyRefSchema>;

export const TransactionSchema = z
  .object({
    uuid: z.string(),
    type: z.string(),
    external_address: z.string().nullable().optional(),
    source_currency: TransactionCurrencyRefSchema,
    dest_currency: TransactionCurrencyRefSchema,
    source_amount: NumericSchema,
    dest_amount: NumericSchema,
    status: z.string(),
    created_at: z.string(),
    comment: z.string().nullable().optional(),
  })
  .passthrough();
export type Transaction = z.infer<typeof TransactionSchema>;

// ── Trades ──────────────────────────────────────────────────────────────────
export const TradeDirectionSchema = z.enum(['BUY', 'SELL']);
export type TradeDirection = z.infer<typeof TradeDirectionSchema>;

export const OrderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const TimeInForceSchema = z.enum(['DAY', 'GTC']);
export type TimeInForce = z.infer<typeof TimeInForceSchema>;

export const TradeSchema = z
  .object({
    symbol: z.string(),
    direction: TradeDirectionSchema,
    amount: NumericSchema.nullable().optional(),
    shares: NumericSchema.nullable().optional(),
    status: z.string(),
    order_type: OrderTypeSchema,
    limit_price: NumericSchema.nullable().optional(),
    stop_price: NumericSchema.nullable().optional(),
    time_in_force: TimeInForceSchema.nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
export type Trade = z.infer<typeof TradeSchema>;

// ── Assets ──────────────────────────────────────────────────────────────────
// Las categorías válidas son query params de `/assets?category=...`. No vienen
// en la shape del Asset (aunque la API podría agregarlas más adelante).
export const AssetCategorySchema = z.enum([
  'MOST_POPULAR',
  'ETF',
  'DIVIDENDS',
  'TECHNOLOGY',
  'HEALTH',
  'CONSUMER_GOODS',
  'ENERGY_AND_WATER',
  'FINANCE',
  'REAL_ESTATE',
  'TREASURY_BILLS',
  'VIDEOGAMES',
  'ARGENTINA_ADR',
]);
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

export const AssetDividendSchema = z
  .object({
    amount: NumericSchema.nullable().optional(),
    yield: NumericSchema.nullable().optional(),
    ex_date: z.string().nullable().optional(),
    payment_date: z.string().nullable().optional(),
  })
  .passthrough();
export type AssetDividend = z.infer<typeof AssetDividendSchema>;

export const AssetSchema = z
  .object({
    symbol: z.string(),
    name: z.string(),
    price: NumericSchema,
    asset_type: z.string().nullable().optional(),
    exchange: z.string().nullable().optional(),
    sector: z.string().nullable().optional(),
    // `market_cap_m` y `employees` son string en la spec (decimales y conteos grandes
    // serializados como string). Los mantenemos tal cual.
    market_cap_m: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    description_es: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    ceo: z.string().nullable().optional(),
    employees: z.string().nullable().optional(),
    logo_url: z.string(),
    dividend: AssetDividendSchema.nullable().optional(),
  })
  .passthrough();
export type Asset = z.infer<typeof AssetSchema>;

// ── Wallets ─────────────────────────────────────────────────────────────────
// OJO: la API NO expone balance por wallet. Son solo direcciones de depósito.
export const WalletNetworkSchema = z.enum([
  'ethereum',
  'arbitrum',
  'solana',
  'polygon',
  'tron',
]);
export type WalletNetwork = z.infer<typeof WalletNetworkSchema>;

export const WalletCurrencySchema = z.enum(['USDT', 'USDC']);
export type WalletCurrency = z.infer<typeof WalletCurrencySchema>;

export const WalletSchema = z
  .object({
    address: z.string(),
    network: z.string(),
    currency_code: z.string(),
  })
  .passthrough();
export type Wallet = z.infer<typeof WalletSchema>;

// ── Accounts (internal buckets) ─────────────────────────────────────────────
// "DEFAULT" = cuenta corriente, "INVESTMENT" = cuenta de inversión (cash + stocks).
export const AccountBucketSchema = z.enum(['DEFAULT', 'INVESTMENT']);
export type AccountBucket = z.infer<typeof AccountBucketSchema>;

// ── Account details (bank) ──────────────────────────────────────────────────
export const AccountDetailsAddressSchema = z
  .object({
    street_line_1: z.string(),
    street_line_2: z.string().nullable().optional(),
    city: z.string(),
    state: z.string().optional(),
    postal_code: z.string(),
    country: z.string(),
  })
  .passthrough();
export type AccountDetailsAddress = z.infer<typeof AccountDetailsAddressSchema>;

export const AccountDetailsSchema = z
  .object({
    bank_name: z.string(),
    currency: z.string(),
    account_type: z.string(),
    account_number: z.string().nullable().optional(),
    routing_number: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
    bic: z.string().nullable().optional(),
    swift_code: z.string().nullable().optional(),
    holder_name: z.string(),
    beneficiary: z.string().nullable().optional(),
    memo: z.string().nullable().optional(),
    address: AccountDetailsAddressSchema.nullable().optional(),
  })
  .passthrough();
export type AccountDetails = z.infer<typeof AccountDetailsSchema>;

// ── Rates ───────────────────────────────────────────────────────────────────
export const ExchangeRateSchema = z
  .object({
    source_currency: z.string(),
    dest_currency: z.string(),
    pair: z.string(),
    rate: NumericSchema,
    // Null cuando source == dest (identity pair, sin fila en la tabla).
    updated_at: z.string().nullable(),
  })
  .passthrough();
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

// ── Fees ────────────────────────────────────────────────────────────────────
export const FeeTypeSchema = z.enum(['TRADE']);
export type FeeType = z.infer<typeof FeeTypeSchema>;

// Los valores de fee vienen como string (decimales serializados). No los
// convertimos a number acá para respetar la spec; el consumidor decide.
export const FeeSettingSchema = z
  .object({
    fee_type: z.string(),
    tier: z.string().nullable().optional(),
    percentage_fee: z.string(),
    fixed_fee_usd: z.string(),
  })
  .passthrough();
export type FeeSetting = z.infer<typeof FeeSettingSchema>;

// ── Cards ───────────────────────────────────────────────────────────────────
export const CardStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type CardStatus = z.infer<typeof CardStatusSchema>;

export const CardTypeSchema = z.enum(['VIRTUAL', 'PHYSICAL']);
export type CardType = z.infer<typeof CardTypeSchema>;

export const CardSchema = z
  .object({
    uuid: z.string(),
    status: CardStatusSchema,
    card_type: z.string(),
    card_network: z.string(),
    card_last4: z.string(),
    expiration: z.string().nullable().optional(),
  })
  .passthrough();
export type Card = z.infer<typeof CardSchema>;

// ── Robo Advisor ────────────────────────────────────────────────────────────
export const RiskProfileSchema = z
  .object({
    risk_level: z.number().int(),
    name: z.string(),
  })
  .passthrough();
export type RiskProfile = z.infer<typeof RiskProfileSchema>;

export const RoboAdvisorAssetSchema = z
  .object({
    symbol: z.string(),
    shares: NumericSchema,
    market_value: NumericSchema,
    price: NumericSchema,
    daily_variation_percentage: NumericSchema,
    weight: NumericSchema,
    logo: z.string(),
  })
  .passthrough();
export type RoboAdvisorAsset = z.infer<typeof RoboAdvisorAssetSchema>;

export const PortfolioPerformanceSchema = z
  .object({
    net_deposits: NumericSchema,
    net_profits: NumericSchema,
    total_deposits: NumericSchema,
    total_withdrawals: NumericSchema,
  })
  .passthrough();
export type PortfolioPerformance = z.infer<typeof PortfolioPerformanceSchema>;

export const PortfolioAllocationSchema = z
  .object({
    cash: NumericSchema,
    securities: NumericSchema,
  })
  .passthrough();
export type PortfolioAllocation = z.infer<typeof PortfolioAllocationSchema>;

export const PortfolioTypeSchema = z.enum(['ROBOADVISOR', 'CHEST']);
export type PortfolioType = z.infer<typeof PortfolioTypeSchema>;

export const ChestCategorySchema = z.enum([
  'HOUSING',
  'VEHICLE',
  'MASTERS',
  'RETIREMENT_PLAN',
  'PURCHASE',
  'EMERGENCIES',
  'VACATIONS',
  'CUSTOM',
]);
export type ChestCategory = z.infer<typeof ChestCategorySchema>;

export const RoboAdvisorPortfolioSchema = z
  .object({
    id: z.number().int(),
    label: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    portfolio_type: PortfolioTypeSchema,
    balance: NumericSchema,
    portfolio_value: NumericSchema,
    cash: NumericSchema,
    cash_available_withdrawal: NumericSchema,
    risk_profile: RiskProfileSchema.nullable().optional(),
    performance: PortfolioPerformanceSchema,
    assets: z.array(RoboAdvisorAssetSchema),
    allocation: PortfolioAllocationSchema,
    has_pending_transactions: z.boolean(),
  })
  .passthrough();
export type RoboAdvisorPortfolio = z.infer<typeof RoboAdvisorPortfolioSchema>;

export const RoboAdvisorTransactionTypeSchema = z.enum([
  'ROBOADVISOR_DEPOSIT',
  'ROBOADVISOR_WITHDRAW',
]);
export type RoboAdvisorTransactionType = z.infer<typeof RoboAdvisorTransactionTypeSchema>;

export const RoboAdvisorTransactionStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'UNCONFIRMED',
]);
export type RoboAdvisorTransactionStatus = z.infer<typeof RoboAdvisorTransactionStatusSchema>;

export const RoboAdvisorTransactionSchema = z
  .object({
    uuid: z.string(),
    type: RoboAdvisorTransactionTypeSchema,
    amount: NumericSchema,
    status: RoboAdvisorTransactionStatusSchema,
    created_at: z.string(),
  })
  .passthrough();
export type RoboAdvisorTransaction = z.infer<typeof RoboAdvisorTransactionSchema>;

// ── Paginación (helper genérico) ────────────────────────────────────────────
// `/transactions` y `/assets` devuelven las mismas 3 piezas de metadata
// (`pages`, `current_page`, `count`) junto al array. Abstraemos el shape.
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly pages: number;
  readonly currentPage: number;
  readonly count: number;
}
