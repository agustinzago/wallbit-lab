import { z } from 'zod';
import type { HttpClient } from '../http.js';

// TODO(verify-api): Wallbit podría exponer wallets cripto por red (BTC/ETH/TRX/etc.)
// o por currency. Confirmar naming y si incluyen balance o solo address.
const WalletSchema = z.object({
  id: z.string(),
  network: z.string(),
  address: z.string(),
  currency: z.string(),
  balance: z.string().optional(),
  label: z.string().optional(),
});
export type Wallet = z.infer<typeof WalletSchema>;

const GetWalletsResponseSchema = z.object({
  wallets: z.array(WalletSchema),
});

export class WalletsResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Wallet[]> {
    const res = await this.http.request({
      path: '/v1/wallets',
      schema: GetWalletsResponseSchema,
    });
    return res.wallets;
  }
}
