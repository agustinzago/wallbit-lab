// Implementación in-memory de FxRateStore. Se usa en tests.

import type { FxQuote, FxRateStore, FxSide } from './types.js';

export class InMemoryFxStore implements FxRateStore {
  private readonly cache = new Map<string, FxQuote>();

  async get(params: { date: string; side: FxSide }): Promise<FxQuote | null> {
    return this.cache.get(storeKey(params.date, params.side)) ?? null;
  }

  async set(quote: FxQuote): Promise<void> {
    this.cache.set(storeKey(quote.date, quote.side), quote);
  }

  /** Utilidad para tests: retorna cuántos valores hay en cache. */
  size(): number {
    return this.cache.size;
  }

  /** Limpia el cache. */
  clear(): void {
    this.cache.clear();
  }
}

function storeKey(date: string, side: FxSide): string {
  return `${date}:${side}`;
}
