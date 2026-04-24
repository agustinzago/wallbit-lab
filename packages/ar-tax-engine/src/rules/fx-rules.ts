// Criterios FX por tipo de operación — art. 158 LIG + research §5.1.
//
// Define qué lado (comprador/vendedor) y qué fecha usar para convertir USD→ARS
// en cada tipo de operación fiscal.

// FxSide es equivalente al del package fx-ars — se duplica aquí para mantener
// el engine sin deps transitivas de runtime (zero I/O, solo zod).
export type LocalFxSide = 'buyer' | 'seller';

export type DateCriterion =
  | 'pay_date'
  | 'trade_date'
  | 'last_business_day_before_31_12'
  | 'withholding_date';

export interface FxCriterion {
  readonly side: LocalFxSide;
  readonly dateCriterion: DateCriterion;
  readonly norma: string;
}

export const FX_CRITERIA: Record<string, FxCriterion> = {
  dividend: {
    side: 'buyer',
    dateCriterion: 'pay_date',
    norma: 'LIG art. 158 §1 + RG AFIP/ARCA — cotización comprador BNA divisa al fecha de pago',
  },
  capital_gain_sale: {
    side: 'seller',
    dateCriterion: 'trade_date',
    norma: 'LIG art. 158 §1 — cotización vendedor BNA divisa al fecha de la operación',
  },
  capital_gain_purchase: {
    side: 'seller',
    dateCriterion: 'trade_date',
    norma: 'LIG art. 158 §1 — cotización vendedor BNA divisa al fecha de compra (cost basis)',
  },
  bp_valuation: {
    side: 'buyer',
    dateCriterion: 'last_business_day_before_31_12',
    norma: 'Ley 23.966 art. 23 — cotización comprador BNA divisa al último día hábil previo al 31/12',
  },
  withholding_tax: {
    side: 'buyer',
    dateCriterion: 'withholding_date',
    norma: 'LIG art. 178 — cotización comprador BNA divisa a la fecha de retención',
  },
};

