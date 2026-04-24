// Tipos públicos del motor fiscal argentino.
// Los montos son siempre números JS (floats). Los cálculos internos usan
// centavos enteros para evitar drift de IEEE-754; los outputs se convierten
// de vuelta a pesos/dólares antes de ser devueltos.

export type FiscalYear = number;

export interface StockPosition {
  readonly symbol: string;
  readonly shares: number;
  readonly priceUsd: number; // al valuationDate
}

export interface PortfolioSnapshot {
  readonly valuationDate: string; // Y-m-d
  readonly usdCashBroker: number;
  readonly positions: readonly StockPosition[];
  /** Saldo en caja de ahorro banco argentino — exento de BP (art. 21 Ley 23.966). */
  readonly cashArBank?: number;
  /** Títulos públicos argentinos — exentos de BP (Ley 23.576). */
  readonly titulosPublicosAr?: number;
}

export interface BpProjectionInput {
  readonly period: FiscalYear;
  readonly portfolio: PortfolioSnapshot;
  /** TC BNA comprador divisa al último día hábil previo al 31/12. */
  readonly fxBnaComprador: number;
  readonly isCumplidor: boolean;
  readonly isReibpAdherido: boolean;
}

export interface BpProjection {
  readonly period: FiscalYear;
  /** Activos valuados en ARS (base imponible antes de deducir MNI). */
  readonly valuatedAssetsArs: number;
  readonly mniArs: number;
  /** Base imponible neta (valuatedAssetsArs - MNI). 0 si está bajo el MNI. */
  readonly excedenteArs: number;
  /** 0 = bajo MNI, 1-3 = tramos de la escala. */
  readonly tramo: 0 | 1 | 2 | 3;
  readonly impuestoArs: number;
  readonly impuestoUsd: number;
  readonly normaAplicada: string;
  readonly warnings: readonly string[];
}

export interface CostBasisLot {
  readonly lotId: string;
  readonly symbol: string;
  readonly purchaseDate: string; // Y-m-d
  readonly shares: number;
  readonly remainingShares: number;
  readonly priceUsd: number;
  /** TC BNA vendedor al momento de la compra (para calcular cost basis en ARS). */
  readonly fxBnaVendedorAtPurchase: number;
}

export interface SaleSimulationInput {
  readonly symbol: string;
  readonly sharesToSell: number;
  readonly currentPriceUsd: number;
  readonly lots: readonly CostBasisLot[];
  readonly method: 'FIFO' | 'weighted_average';
  /** TC BNA vendedor del día de la venta hipotética. */
  readonly fxBnaVendedor: number;
}

export interface SaleSimulation {
  readonly capitalGainUsd: number;
  readonly capitalGainArs: number;
  readonly cedularTaxArs: number;
  readonly netProceedsUsd: number;
  readonly netProceedsArs: number;
  readonly lotsConsumed: readonly {
    readonly lotId: string;
    readonly sharesTaken: number;
    readonly costArs: number;
  }[];
  readonly normaAplicada: string;
  readonly warnings: readonly string[];
}

export interface DividendWithFx {
  readonly payDate: string;
  readonly symbol: string;
  readonly amountUsd: number;
  /** WHT retenida en origen (default 30% USA si no se informa). */
  readonly whtUsdAmount: number;
  readonly sourceTxUuid: string;
  /** TC BNA comprador al pay_date — debe venir pre-calculado por el llamador. */
  readonly fxBnaCompradorAtPayDate: number;
}

export interface DividendTaxed extends DividendWithFx {
  readonly amountArs: number;
  readonly taxArs: number;
  readonly whtCreditArs: number;
}

export interface IncomeTaxDividendProjection {
  readonly period: FiscalYear;
  readonly dividends: readonly DividendTaxed[];
  readonly totalGrossArs: number;
  readonly marginalRateUsed: number;
  readonly incomeTaxArs: number;
  readonly foreignTaxCreditArs: number;
  readonly netTaxArs: number;
  readonly warnings: readonly string[];
}
