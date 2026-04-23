// GET /api/public/v1/account-details?country=US|EU&currency=USD|EUR
//
// No es un "get user profile": devuelve los datos bancarios que hay que usar para
// transferirle plata a la cuenta del user (ACH si US, SEPA si EU). Sólo US y EU
// están soportados en la API pública por ahora.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { AccountDetailsSchema, type AccountDetails } from '../types.js';

const GetAccountDetailsResponseSchema = z.object({
  data: AccountDetailsSchema,
});

export type AccountCountry = 'US' | 'EU';
export type AccountCurrency = 'USD' | 'EUR';

export interface GetAccountDetailsParams {
  readonly country?: AccountCountry;
  readonly currency?: AccountCurrency;
}

export class AccountDetailsResource {
  constructor(private readonly http: HttpClient) {}

  async get(params: GetAccountDetailsParams = {}): Promise<AccountDetails> {
    const res = await this.http.request({
      path: '/v1/account-details',
      query: {
        country: params.country,
        currency: params.currency,
      },
      schema: GetAccountDetailsResponseSchema,
    });
    return res.data;
  }
}
