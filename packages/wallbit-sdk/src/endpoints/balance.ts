import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { BalanceSchema, type Balance } from '../types.js';

// TODO(verify-api): path y envelope exactos. Es posible que la API devuelva un array
// plano en lugar de `{ balances: [...] }`, o que separe por currency en sub-recursos.
const GetCheckingBalanceResponseSchema = z.object({
  balances: z.array(BalanceSchema),
});

// TODO(verify-api): shape de posiciones de stocks; los nombres de campos pueden variar
// (quantity vs units, averagePrice vs avgCost, etc.).
const StocksPositionSchema = z.object({
  symbol: z.string(),
  quantity: z.string(),
  averagePrice: z.string().optional(),
  marketValue: z.string().optional(),
  currency: z.string().optional(),
});
export type StocksPosition = z.infer<typeof StocksPositionSchema>;

const GetStocksBalanceResponseSchema = z.object({
  positions: z.array(StocksPositionSchema),
});

export class BalanceResource {
  constructor(private readonly http: HttpClient) {}

  async getChecking(): Promise<Balance[]> {
    const res = await this.http.request({
      path: '/v1/balance/checking',
      schema: GetCheckingBalanceResponseSchema,
    });
    return res.balances;
  }

  async getStocks(): Promise<StocksPosition[]> {
    const res = await this.http.request({
      path: '/v1/balance/stocks',
      schema: GetStocksBalanceResponseSchema,
    });
    return res.positions;
  }
}
