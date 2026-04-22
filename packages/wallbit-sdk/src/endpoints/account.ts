import { z } from 'zod';
import type { HttpClient } from '../http.js';

// TODO(verify-api): campos disponibles de la cuenta y nombres exactos (ej. kycLevel,
// verificationStatus, etc.).
const AccountDetailsSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  kycStatus: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});
export type AccountDetails = z.infer<typeof AccountDetailsSchema>;

export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  async getDetails(): Promise<AccountDetails> {
    return this.http.request({
      path: '/v1/account',
      schema: AccountDetailsSchema,
    });
  }
}
