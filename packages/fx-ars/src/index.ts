// Re-exports públicos del package fx-ars.

export { FxService } from './service.js';
export type { FxServiceOptions } from './service.js';

export type { FxQuote, FxSide, FxRateStore, Logger } from './types.js';

export { FxError, FxNotFoundError, FxSourceError } from './errors.js';

export { InMemoryFxStore } from './in-memory-store.js';

export { fetchFromBna } from './bna-client.js';
export type { BnaQuote } from './bna-client.js';

export { fetchFromBcra } from './bcra-client.js';
export type { BcraQuote } from './bcra-client.js';

export { fetchDolares, midRate } from './dolar-api.js';
export type { DolarApiResult, CotizacionUSD, DolarCasa } from './dolar-api.js';
