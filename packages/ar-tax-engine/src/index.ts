// Re-exports públicos del package ar-tax-engine.

export { projectBienesPersonales } from './calculators/bp.js';
export { projectIncomeTaxDividends } from './calculators/income-tax-dividends.js';
export { simulateSale } from './calculators/capital-gain.js';
export { computeForeignTaxCredit } from './calculators/foreign-tax-credit.js';
export type { ForeignTaxCreditInput, ForeignTaxCreditResult } from './calculators/foreign-tax-credit.js';

export { getBpRule, BP_RULES } from './rules/bp-rules.js';
export type { BpRuleSet, BpTranche } from './rules/bp-rules.js';

export { getArt94Rule, ART94_RULES } from './rules/art94-rules.js';
export type { Art94RuleSet, Art94Tranche } from './rules/art94-rules.js';

export { FX_CRITERIA } from './rules/fx-rules.js';
export type { FxCriterion, DateCriterion, LocalFxSide } from './rules/fx-rules.js';

export { TaxEngineError, UnsupportedPeriodError } from './errors.js';

export type {
  FiscalYear,
  StockPosition,
  PortfolioSnapshot,
  BpProjectionInput,
  BpProjection,
  CostBasisLot,
  SaleSimulationInput,
  SaleSimulation,
  DividendWithFx,
  DividendTaxed,
  IncomeTaxDividendProjection,
} from './types.js';
