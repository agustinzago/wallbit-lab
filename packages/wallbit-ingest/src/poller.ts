// TransactionPoller: wrapper sobre `client.transactions.list()` con dedup por
// uuid y paginación offset-based. Se usa como primitiva por cualquier app que
// necesite leer transacciones recientes sin preocuparse por las páginas.
//
// Wallbit expone paginación con `page`/`limit` + metadata `pages`/`current_page`/
// `count`. No hay cursores. El filtro de fecha es por día (Y-m-d), no por
// timestamp — eso hay que tenerlo en cuenta al acotar ventanas chicas.

import type { WallbitClient, Transaction } from '@wallbit-lab/sdk';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

// Valores de limit que acepta la API (enum 10|20|50). Cualquier otro valor → 422.
export type TransactionsPageLimit = 10 | 20 | 50;

export interface TransactionPollerOptions {
  readonly client: WallbitClient;
  readonly logger?: Logger;
  readonly pageSize?: TransactionsPageLimit;
  /** Tope de páginas defensivo — corta si la API se vuelve loca con el count. */
  readonly maxPages?: number;
}

export interface FetchRecentParams {
  readonly days: number;
}

// Default conservador: la spec enumera `10|20|50` pero la API rechaza 50 en
// algunos tiers. Arrancamos con 10 y el consumidor sube si su tier lo permite.
const DEFAULT_PAGE_SIZE: TransactionsPageLimit = 10;
const DEFAULT_MAX_PAGES = 50;

export class TransactionPoller {
  private readonly client: WallbitClient;
  private readonly logger: Logger | undefined;
  private readonly pageSize: TransactionsPageLimit;
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

    const fromDate = toYmd(new Date(Date.now() - params.days * 86_400_000));
    const toDate = toYmd(new Date());
    this.logger?.debug('ingest: fetch recent', { days: params.days, fromDate, toDate });

    const newOnes: Transaction[] = [];
    let page = 1;

    for (let fetched = 0; fetched < this.maxPages; fetched++) {
      const res = await this.client.transactions.list({
        page,
        limit: this.pageSize,
        fromDate,
        toDate,
      });

      for (const tx of res.items) {
        if (this.seen.has(tx.uuid)) continue;
        this.seen.set(tx.uuid, tx);
        newOnes.push(tx);
      }

      if (res.items.length === 0) break;
      if (res.currentPage >= res.pages) break;
      page = res.currentPage + 1;
    }

    this.logger?.info('ingest: fetched transactions', {
      newCount: newOnes.length,
      cachedTotal: this.seen.size,
    });

    // Devolver toda la ventana conocida, ordenada por fecha desc. Los consumidores
    // esperan la ventana completa cada vez, no solo lo nuevo de esta llamada.
    const fromMs = Date.parse(`${fromDate}T00:00:00Z`);
    return [...this.seen.values()]
      .filter((tx) => Date.parse(tx.created_at) >= fromMs)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  /** Limpia el cache. Útil en tests. */
  reset(): void {
    this.seen.clear();
  }
}

function toYmd(date: Date): string {
  const iso = date.toISOString();
  // "2026-04-23T12:34:56.789Z" → "2026-04-23".
  return iso.slice(0, 10);
}
