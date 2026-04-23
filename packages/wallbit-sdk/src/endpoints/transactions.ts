// GET /api/public/v1/transactions
//
// Paginación offset-based (`page` + `limit`). El envelope real es `{ data: {
// data: [...], pages, current_page, count } }` — doble "data" a propósito (el
// externo es el wrapper estándar, el interno es el array paginado).

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  TransactionSchema,
  type Paginated,
  type Transaction,
} from '../types.js';

const ListTransactionsResponseSchema = z.object({
  data: z.object({
    data: z.array(TransactionSchema),
    pages: z.number().int(),
    current_page: z.number().int(),
    count: z.number().int(),
  }),
});

// Sets fijos que permite la API. Cualquier otro valor termina en 422.
export type TransactionsPageLimit = 10 | 20 | 50;

export interface ListTransactionsParams {
  readonly page?: number;
  readonly limit?: TransactionsPageLimit;
  readonly status?: string;
  readonly type?: string;
  readonly currency?: string;
  // Formato ISO de fecha (Y-m-d). No ISO-datetime: la API sólo filtra por día.
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly fromAmount?: number;
  readonly toAmount?: number;
}

export type ListTransactionsResult = Paginated<Transaction>;

export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ListTransactionsParams = {}): Promise<ListTransactionsResult> {
    const res = await this.http.request({
      path: '/v1/transactions',
      query: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        type: params.type,
        currency: params.currency,
        from_date: params.fromDate,
        to_date: params.toDate,
        from_amount: params.fromAmount,
        to_amount: params.toAmount,
      },
      schema: ListTransactionsResponseSchema,
    });
    return {
      items: res.data.data,
      pages: res.data.pages,
      currentPage: res.data.current_page,
      count: res.data.count,
    };
  }
}
