import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { TradeOrderSchema, type TradeSide, type TradeType } from '../types.js';

// TODO(verify-api): shape de la respuesta de una orden. Probable que incluya
// timestamps (createdAt, filledAt) y fees, pero los dejamos opcionales hasta confirmar.
const PlacedTradeSchema = z.object({
  id: z.string(),
  status: z.string(),
  order: TradeOrderSchema,
  createdAt: z.string().datetime().optional(),
  filledAt: z.string().datetime().optional(),
  fees: z.string().optional(),
});
export type PlacedTrade = z.infer<typeof PlacedTradeSchema>;

export interface PlaceTradeInput {
  readonly symbol: string;
  readonly type: TradeType;
  readonly side: TradeSide;
  readonly quantity: string;
  readonly limitPrice?: string;
  readonly stopPrice?: string;
}

export class TradesResource {
  constructor(private readonly http: HttpClient) {}

  async place(input: PlaceTradeInput): Promise<PlacedTrade> {
    // TODO(verify-api): path exacto y naming de los campos del body (snake_case vs camelCase).
    return this.http.request({
      method: 'POST',
      path: '/v1/trades',
      body: input,
      schema: PlacedTradeSchema,
    });
  }
}
