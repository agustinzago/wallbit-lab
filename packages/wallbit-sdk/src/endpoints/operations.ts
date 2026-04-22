import { z } from 'zod';
import type { HttpClient } from '../http.js';

// TODO(verify-api): shape exacta de la respuesta y naming de buckets.
const InternalTransferResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string().datetime().optional(),
});
export type InternalTransferResult = z.infer<typeof InternalTransferResponseSchema>;

export type AccountBucket = 'DEFAULT' | 'INVESTMENT';

export interface InternalTransferInput {
  readonly from: AccountBucket;
  readonly to: AccountBucket;
  readonly amount: string;
  readonly currency: string;
}

export class OperationsResource {
  constructor(private readonly http: HttpClient) {}

  async internalTransfer(input: InternalTransferInput): Promise<InternalTransferResult> {
    if (input.from === input.to) {
      throw new Error('internalTransfer: `from` y `to` no pueden ser el mismo bucket.');
    }
    return this.http.request({
      method: 'POST',
      path: '/v1/operations/internal-transfer',
      body: input,
      schema: InternalTransferResponseSchema,
    });
  }
}
