// Tipos públicos del package fx-ars.

export type FxSide = 'buyer' | 'seller';

export interface FxQuote {
  readonly date: string; // ISO Y-m-d
  readonly currency: 'USD';
  readonly side: FxSide;
  readonly rate: number; // ARS por 1 USD
  readonly source: 'bcra' | 'bna' | 'manual';
  readonly fetchedAt: Date;
}

export interface FxRateStore {
  get(params: { date: string; side: FxSide }): Promise<FxQuote | null>;
  set(quote: FxQuote): Promise<void>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
