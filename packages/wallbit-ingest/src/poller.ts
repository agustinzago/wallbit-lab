// TransactionPoller: wrapper sobre `client.transactions.list()` con dedup por id
// y paginación via `nextCursor`. Se usa como primitiva por cualquier app que
// necesite leer transacciones recientes sin preocuparse por cursores.

import type { WallbitClient, Transaction } from '@wallbit-lab/sdk';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface TransactionPollerOptions {
  readonly client: WallbitClient;
  readonly logger?: Logger;
  /** Page size para cada fetch paginado. Default 100 (valor seguro, ajustable). */
  readonly pageSize?: number;
  /** Tope de páginas para no loopear si la API no devuelve `nextCursor: null`. */
  readonly maxPages?: number;
}

export interface FetchRecentParams {
  readonly days: number;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 50;

export class TransactionPoller {
  private readonly client: WallbitClient;
  private readonly logger: Logger | undefined;
  private readonly pageSize: number;
  private readonly maxPages: number;
  // Cache en memoria (persistencia out of scope en v0.1). Vive mientras vive la instancia.
  private readonly seen = new Map<string, Transaction>();

  constructor(options: TransactionPollerOptions) {
    this.client = options.client;
    this.logger = options.logger;
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  }

  async fetchRecent(params: FetchRecentParams): Promise<Transaction[]> {
    if (!Number.isFinite(params.days) || params.days <= 0) {
      throw new RangeError(`TransactionPoller.fetchRecent: days inválido (${params.days}).`);
    }

    const from = new Date(Date.now() - params.days * 86_400_000).toISOString();
    this.logger?.debug('ingest: fetch recent', { days: params.days, from });

    let cursor: string | undefined;
    const newOnes: Transaction[] = [];

    for (let page = 0; page < this.maxPages; page++) {
      const res = await this.client.transactions.list({
        limit: this.pageSize,
        from,
        ...(cursor !== undefined ? { cursor } : {}),
      });

      for (const tx of res.transactions) {
        if (this.seen.has(tx.id)) continue;
        this.seen.set(tx.id, tx);
        newOnes.push(tx);
      }

      if (res.nextCursor === null || res.nextCursor === undefined) break;
      cursor = res.nextCursor;
    }

    this.logger?.info('ingest: fetched transactions', {
      newCount: newOnes.length,
      cachedTotal: this.seen.size,
    });

    // Devolver todas las transacciones conocidas dentro de la ventana, no sólo las nuevas
    // de esta llamada — los consumidores esperan la ventana completa cada vez.
    const fromMs = Date.parse(from);
    return [...this.seen.values()]
      .filter((tx) => Date.parse(tx.date) >= fromMs)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }

  /** Limpia el cache. Útil en tests. */
  reset(): void {
    this.seen.clear();
  }
}
