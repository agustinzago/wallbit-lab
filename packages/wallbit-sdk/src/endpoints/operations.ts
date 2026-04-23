// POST /api/public/v1/operations/internal
//
// Mueve fondos entre cuenta corriente (DEFAULT) y cuenta de inversión (INVESTMENT).
// La spec declara el response como `Transaction` directo, sin wrapper `data`.
// Si en la práctica viene con wrapper, ajustar acá — pero respetamos lo documentado.

import type { HttpClient } from '../http.js';
import {
  TransactionSchema,
  type AccountBucket,
  type Transaction,
} from '../types.js';

export interface InternalTransferInput {
  readonly currency: string;
  readonly from: AccountBucket;
  readonly to: AccountBucket;
  // La spec: mínimo 1, máximo 999999. Validamos en cliente antes del network hop.
  readonly amount: number;
}

export class OperationsResource {
  constructor(private readonly http: HttpClient) {}

  async internalTransfer(input: InternalTransferInput): Promise<Transaction> {
    if (input.from === input.to) {
      throw new Error('OperationsResource.internalTransfer: `from` y `to` no pueden ser el mismo bucket.');
    }
    if (!Number.isFinite(input.amount) || input.amount < 1 || input.amount > 999_999) {
      throw new RangeError(
        'OperationsResource.internalTransfer: `amount` debe estar en [1, 999999].',
      );
    }
    return this.http.request({
      method: 'POST',
      path: '/v1/operations/internal',
      body: {
        currency: input.currency,
        from: input.from,
        to: input.to,
        amount: input.amount,
      },
      schema: TransactionSchema,
    });
  }
}
