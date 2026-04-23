// GET /api/public/v1/rates?source_currency=X&dest_currency=Y
//
// Retorna el par guardado en la tabla de exchange rates. Si source == dest,
// devuelve `rate: 1` con `updated_at: null` (no hay fila real). Si el par no
// existe, la API responde 404 → WallbitNotFoundError.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { ExchangeRateSchema, type ExchangeRate } from '../types.js';

const GetRateResponseSchema = z.object({
  data: ExchangeRateSchema,
});

export interface GetRateParams {
  readonly sourceCurrency: string;
  readonly destCurrency: string;
}

export class RatesResource {
  constructor(private readonly http: HttpClient) {}

  async get(params: GetRateParams): Promise<ExchangeRate> {
    const res = await this.http.request({
      path: '/v1/rates',
      query: {
        source_currency: params.sourceCurrency,
        dest_currency: params.destCurrency,
      },
      schema: GetRateResponseSchema,
    });
    return res.data;
  }
}
