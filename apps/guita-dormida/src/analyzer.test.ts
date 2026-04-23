// Tests del IdleCapitalAnalyzer. Mockeamos WallbitClient y TransactionPoller con
// vi.fn() para no hacer requests reales; lo que probamos es la lógica de decisión.

import { describe, expect, it, vi } from 'vitest';
import type { WallbitClient, Transaction } from '@wallbit-lab/sdk';
import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { IdleCapitalAnalyzer } from './analyzer.js';
import { buildReport } from './reporter.js';

interface MockSetup {
  readonly checking: Array<{ currency: string; total: string; available?: string }>;
  readonly stocks?: Array<{
    symbol: string;
    quantity: string;
    averagePrice?: string;
    marketValue?: string;
    currency?: string;
  }>;
  readonly wallets?: Array<{
    id: string;
    network: string;
    address: string;
    currency: string;
    balance?: string;
  }>;
  readonly transactions?: Transaction[];
}

function buildMocks(setup: MockSetup): { client: WallbitClient; poller: TransactionPoller } {
  const client = {
    balance: {
      getChecking: vi.fn().mockResolvedValue(
        setup.checking.map((c) => ({
          currency: c.currency,
          available: c.available ?? c.total,
          total: c.total,
        })),
      ),
      getStocks: vi.fn().mockResolvedValue(setup.stocks ?? []),
    },
    wallets: {
      getAll: vi.fn().mockResolvedValue(setup.wallets ?? []),
    },
  } as unknown as WallbitClient;

  const poller = {
    fetchRecent: vi.fn().mockResolvedValue(setup.transactions ?? []),
  } as unknown as TransactionPoller;

  return { client, poller };
}

// Helper para construir transacciones de egreso USD que suman a un gasto mensual
// dado. El analyzer normaliza a 30 días dividiendo por analysisDays * 30, así que si
// analysisDays = 30 y queremos un burn de X, debemos inyectar X en egresos.
function buildEgressTxs(totalUsd: number, days = 30): Transaction[] {
  const now = Date.now();
  return [
    {
      id: 'tx-egress-1',
      type: 'CARD_PAYMENT',
      currency: 'USD',
      amount: String(totalUsd),
      date: new Date(now - 1_000 * 60 * 60 * 24 * Math.floor(days / 2)).toISOString(),
      description: 'groceries',
    },
  ];
}

describe('IdleCapitalAnalyzer', () => {
  it('detecta USD 3500 como ocioso cuando saldo=5000 y gasto mensual=1000', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', total: '5000' }],
      transactions: buildEgressTxs(1000),
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    expect(result.hasIdle).toBe(true);
    expect(result.recommendedBufferUSD).toBe(1500);
    const checkingAsset = result.idleAssets.find((a) => a.category === 'checking');
    expect(checkingAsset).toBeDefined();
    expect(checkingAsset?.amount).toBe(3500);
    expect(checkingAsset?.currency).toBe('USD');
  });

  it('no detecta ocioso cuando saldo=800 y gasto mensual=1000', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', total: '800' }],
      transactions: buildEgressTxs(1000),
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    const checkingAsset = result.idleAssets.find((a) => a.category === 'checking');
    expect(checkingAsset).toBeUndefined();
  });

  it('detecta wallet USDT con balance 1000 sin movimiento como dormida', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', total: '100' }],
      transactions: buildEgressTxs(50),
      wallets: [
        {
          id: 'w1',
          network: 'TRON',
          address: 'TAbc123',
          currency: 'USDT',
          balance: '1000',
        },
      ],
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    const cryptoAsset = result.idleAssets.find((a) => a.category === 'crypto_wallet');
    expect(cryptoAsset).toBeDefined();
    expect(cryptoAsset?.amount).toBe(1000);
    expect(cryptoAsset?.currency).toBe('USDT');
  });

  it('cuando hasIdle=false, el reporte no menciona "Capital ocioso"', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', total: '300' }],
      transactions: buildEgressTxs(400),
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();
    const report = buildReport(result);

    expect(result.hasIdle).toBe(false);
    expect(report).not.toContain('Capital ocioso');
    expect(report).toContain('✅');
  });
});
