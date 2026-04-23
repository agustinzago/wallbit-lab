// GET /api/public/v1/roboadvisor/balance   (portfolios con holdings)
// POST /api/public/v1/roboadvisor/deposit  (scope `trade`, min 10 USD)
// POST /api/public/v1/roboadvisor/withdraw (scope `trade`)

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  RoboAdvisorPortfolioSchema,
  RoboAdvisorTransactionSchema,
  type AccountBucket,
  type RoboAdvisorPortfolio,
  type RoboAdvisorTransaction,
} from '../types.js';

const GetRoboAdvisorBalanceResponseSchema = z.object({
  data: z.array(RoboAdvisorPortfolioSchema),
});

const RoboAdvisorTransactionResponseSchema = z.object({
  data: RoboAdvisorTransactionSchema,
});

export interface RoboAdvisorDepositInput {
  readonly roboAdvisorId: number;
  // La spec: mínimo 10 USD.
  readonly amount: number;
  readonly from: AccountBucket;
}

export interface RoboAdvisorWithdrawInput {
  readonly roboAdvisorId: number;
  readonly amount: number;
  // Destino del cash liberado: DEFAULT (checking) o INVESTMENT.
  readonly to: AccountBucket;
}

export class RoboAdvisorResource {
  constructor(private readonly http: HttpClient) {}

  // Sólo devuelve portfolios con risk profile asignado, balance > 0, o tx pendientes.
  async getBalance(): Promise<RoboAdvisorPortfolio[]> {
    const res = await this.http.request({
      path: '/v1/roboadvisor/balance',
      schema: GetRoboAdvisorBalanceResponseSchema,
    });
    return res.data;
  }

  async deposit(input: RoboAdvisorDepositInput): Promise<RoboAdvisorTransaction> {
    if (input.amount < 10) {
      throw new RangeError('RoboAdvisor.deposit: el mínimo es 10 USD.');
    }
    const res = await this.http.request({
      method: 'POST',
      path: '/v1/roboadvisor/deposit',
      body: {
        robo_advisor_id: input.roboAdvisorId,
        amount: input.amount,
        from: input.from,
      },
      schema: RoboAdvisorTransactionResponseSchema,
    });
    return res.data;
  }

  async withdraw(input: RoboAdvisorWithdrawInput): Promise<RoboAdvisorTransaction> {
    const res = await this.http.request({
      method: 'POST',
      path: '/v1/roboadvisor/withdraw',
      body: {
        robo_advisor_id: input.roboAdvisorId,
        amount: input.amount,
        to: input.to,
      },
      schema: RoboAdvisorTransactionResponseSchema,
    });
    return res.data;
  }
}
