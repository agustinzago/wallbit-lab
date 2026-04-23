// GET /api/public/v1/balance/checking
// GET /api/public/v1/balance/stocks
//
// Ambos devuelven `{ data: [...] }`. Devolvemos el array sin el wrapper; si el
// usuario necesita el wrapper, lo reconstruye trivialmente.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  CheckingBalanceSchema,
  StocksPositionSchema,
  type CheckingBalance,
  type StocksPosition,
} from '../types.js';

const GetCheckingBalanceResponseSchema = z.object({
  data: z.array(CheckingBalanceSchema),
});

const GetStocksBalanceResponseSchema = z.object({
  data: z.array(StocksPositionSchema),
});

export class BalanceResource {
  constructor(private readonly http: HttpClient) {}

  // Sólo devuelve currencies con balance > 0. Para un user nuevo puede ser [].
  async getChecking(): Promise<CheckingBalance[]> {
    const res = await this.http.request({
      path: '/v1/balance/checking',
      schema: GetCheckingBalanceResponseSchema,
    });
    return res.data;
  }

  // El cash disponible en la cuenta INVESTMENT aparece como un item con
  // `symbol: "USD"` dentro del mismo array. Sólo devuelve posiciones con shares > 0.
  async getStocks(): Promise<StocksPosition[]> {
    const res = await this.http.request({
      path: '/v1/balance/stocks',
      schema: GetStocksBalanceResponseSchema,
    });
    return res.data;
  }
}
