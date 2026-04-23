// POST /api/public/v1/trades
//
// Reglas del body según la spec:
// - `amount` XOR `shares` (exclusivos).
// - `limit_price` requerido para LIMIT y STOP_LIMIT.
// - `stop_price` requerido para STOP y STOP_LIMIT.
// - `time_in_force` requerido para LIMIT.
// Validamos en cliente lo que podemos para fallar antes del network hop.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  TradeSchema,
  type OrderType,
  type TimeInForce,
  type Trade,
  type TradeDirection,
} from '../types.js';

const CreateTradeResponseSchema = z.object({
  data: TradeSchema,
});

export interface PlaceTradeInput {
  readonly symbol: string;
  readonly direction: TradeDirection;
  // Único valor soportado hoy por la API, lo dejamos configurable por si abren más.
  readonly currency?: 'USD' | (string & {});
  readonly orderType: OrderType;
  readonly amount?: number;
  readonly shares?: number;
  readonly limitPrice?: number;
  readonly stopPrice?: number;
  readonly timeInForce?: TimeInForce;
}

export class TradesResource {
  constructor(private readonly http: HttpClient) {}

  async place(input: PlaceTradeInput): Promise<Trade> {
    validatePlaceTradeInput(input);

    const body: Record<string, unknown> = {
      symbol: input.symbol,
      direction: input.direction,
      currency: input.currency ?? 'USD',
      order_type: input.orderType,
    };
    if (input.amount !== undefined) body['amount'] = input.amount;
    if (input.shares !== undefined) body['shares'] = input.shares;
    if (input.limitPrice !== undefined) body['limit_price'] = input.limitPrice;
    if (input.stopPrice !== undefined) body['stop_price'] = input.stopPrice;
    if (input.timeInForce !== undefined) body['time_in_force'] = input.timeInForce;

    const res = await this.http.request({
      method: 'POST',
      path: '/v1/trades',
      body,
      schema: CreateTradeResponseSchema,
    });
    return res.data;
  }
}

function validatePlaceTradeInput(input: PlaceTradeInput): void {
  const hasAmount = input.amount !== undefined;
  const hasShares = input.shares !== undefined;
  if (hasAmount === hasShares) {
    throw new Error('TradesResource.place: debés pasar exactamente uno entre `amount` o `shares`.');
  }
  if (input.orderType === 'LIMIT' || input.orderType === 'STOP_LIMIT') {
    if (input.limitPrice === undefined) {
      throw new Error(`TradesResource.place: \`limitPrice\` requerido para ${input.orderType}.`);
    }
  }
  if (input.orderType === 'STOP' || input.orderType === 'STOP_LIMIT') {
    if (input.stopPrice === undefined) {
      throw new Error(`TradesResource.place: \`stopPrice\` requerido para ${input.orderType}.`);
    }
  }
  if (input.orderType === 'LIMIT' && input.timeInForce === undefined) {
    throw new Error('TradesResource.place: `timeInForce` requerido para LIMIT.');
  }
}
