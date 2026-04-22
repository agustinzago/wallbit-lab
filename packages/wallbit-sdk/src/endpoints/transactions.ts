import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { TransactionSchema, type Transaction } from '../types.js';

// TODO(verify-api): formato de paginación. Puede ser cursor-based (nextCursor),
// offset/limit, o link headers estilo GitHub. Ajustar cuando probemos.
const ListTransactionsResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  nextCursor: z.string().nullable().optional(),
});

export interface ListTransactionsParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface ListTransactionsResult {
  readonly transactions: Transaction[];
  readonly nextCursor: string | null;
}

export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ListTransactionsParams = {}): Promise<ListTransactionsResult> {
    const res = await this.http.request({
      path: '/v1/transactions',
      query: {
        limit: params.limit,
        cursor: params.cursor,
        from: params.from,
        to: params.to,
      },
      schema: ListTransactionsResponseSchema,
    });
    return {
      transactions: res.transactions,
      nextCursor: res.nextCursor ?? null,
    };
  }
}
