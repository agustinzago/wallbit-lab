// GET /api/public/v1/wallets
//
// IMPORTANTE: la API pública NO expone balance por wallet. Son direcciones de
// depósito, nada más. El saldo "real" de USDT/USDC está en /balance/checking.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  WalletSchema,
  type Wallet,
  type WalletCurrency,
  type WalletNetwork,
} from '../types.js';

const GetWalletsResponseSchema = z.object({
  data: z.array(WalletSchema),
});

export interface GetWalletsParams {
  readonly currency?: WalletCurrency;
  readonly network?: WalletNetwork;
}

export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  async getAll(params: GetWalletsParams = {}): Promise<Wallet[]> {
    const res = await this.http.request({
      path: '/v1/wallets',
      query: {
        currency: params.currency,
        network: params.network,
      },
      schema: GetWalletsResponseSchema,
    });
    return res.data;
  }
}
