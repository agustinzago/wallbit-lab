// FxService — orquesta cache + fuentes externas para cotizaciones BNA divisa USD.
//
// Fuente primaria: BNA scraper (cotización divisa, obligatoria para BP/Ganancias
// según art. 23 Ley 23.966).
// Fuente secundaria: BCRA API como referencia cruzada (no como fuente canónica).
// Cache: FxRateStore inyectada (Postgres en producción, in-memory en tests).

import { fetchFromBna } from './bna-client.js';
import { FxNotFoundError, FxSourceError } from './errors.js';
import type { FxQuote, FxRateStore, FxSide, Logger } from './types.js';

export interface FxServiceOptions {
  readonly store: FxRateStore;
  readonly logger?: Logger;
}

export class FxService {
  private readonly store: FxRateStore;
  private readonly logger: Logger | undefined;

  constructor(options: FxServiceOptions) {
    this.store = options.store;
    this.logger = options.logger;
  }

  /**
   * Devuelve la cotización BNA divisa para la fecha y lado dados.
   * Si está en cache, la devuelve directamente. Si no, la fetchea del BNA y la persiste.
   */
  async getBnaDivisa(params: { date: string; side: FxSide }): Promise<FxQuote> {
    const cached = await this.store.get(params);
    if (cached) {
      this.logger?.debug('fx: cache hit', { date: params.date, side: params.side });
      return cached;
    }

    this.logger?.debug('fx: cache miss, fetching BNA', { date: params.date, side: params.side });

    let bnaQuote: Awaited<ReturnType<typeof fetchFromBna>>;
    try {
      bnaQuote = await fetchFromBna(params.date);
    } catch (err) {
      throw new FxSourceError(
        'bna',
        err instanceof Error ? err.message : String(err),
        { cause: err },
      );
    }

    const rate = params.side === 'buyer' ? bnaQuote.comprador : bnaQuote.vendedor;

    const quote: FxQuote = {
      date: params.date,
      currency: 'USD',
      side: params.side,
      rate,
      source: 'bna',
      fetchedAt: new Date(),
    };

    await this.store.set(quote);
    this.logger?.info('fx: cotización guardada en cache', {
      date: params.date,
      side: params.side,
      rate,
    });

    return quote;
  }

  /**
   * Devuelve la cotización BNA al último día hábil previo al 31/12 del año dado.
   * Retrocede desde el 31 hasta encontrar un día que tenga cotización disponible.
   * Útil para calcular la base de BP al cierre del año fiscal.
   */
  async getLastBusinessDayBeforeYearEnd(year: number): Promise<FxQuote> {
    // Retroceder hasta 7 días en caso de feriados extendidos de fin de año.
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const date = new Date(Date.UTC(year, 11, 31 - dayOffset));
      const dateStr = date.toISOString().slice(0, 10);

      try {
        const quote = await this.getBnaDivisa({ date: dateStr, side: 'buyer' });
        this.logger?.info('fx: último día hábil previo al 31/12 encontrado', {
          year,
          date: dateStr,
        });
        return quote;
      } catch (err) {
        if (err instanceof FxSourceError) {
          this.logger?.debug('fx: sin cotización BNA, retrocediendo un día', {
            date: dateStr,
            reason: err.message,
          });
          continue;
        }
        throw err;
      }
    }

    throw new FxNotFoundError(
      `${year}-12-31`,
      'buyer',
      new Error(`No se encontró cotización BNA en los últimos 7 días hábiles de ${year}.`),
    );
  }
}
