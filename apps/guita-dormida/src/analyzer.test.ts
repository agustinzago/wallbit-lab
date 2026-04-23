// Tests del IdleCapitalAnalyzer. Mockeamos WallbitClient y TransactionPoller
// con vi.fn() para no hacer requests reales; lo que probamos es la lógica de
// decisión.

import { describe, expect, it, vi } from 'vitest';
import type {
  CheckingBalance,
  StocksPosition,
  Transaction,
  WallbitClient,
} from '@wallbit-lab/sdk';
import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { IdleCapitalAnalyzer } from './analyzer.js';
import { buildReport } from './reporter.js';

interface MockSetup {
  readonly checking: CheckingBalance[];
  readonly stocks?: StocksPosition[];
  readonly transactions?: Transaction[];
}

function buildMocks(setup: MockSetup): { client: WallbitClient; poller: TransactionPoller } {
  const client = {
    balance: {
      getChecking: vi.fn().mockResolvedValue(setup.checking),
      getStocks: vi.fn().mockResolvedValue(setup.stocks ?? []),
    },
  } as unknown as WallbitClient;

  const poller = {
    fetchRecent: vi.fn().mockResolvedValue(setup.transactions ?? []),
  } as unknown as TransactionPoller;

  return { client, poller };
}

// Construye transacciones de egreso USD que suman a un gasto mensual dado.
// Si analysisDays = 30 y queremos burn = X, inyectamos X en egresos.
function buildEgressTxs(totalUsd: number, days = 30): Transaction[] {
  const now = Date.now();
  return [
    {
      uuid: 'tx-egress-1',
      type: 'CARD_PAYMENT',
      external_address: null,
      source_currency: { code: 'USD', alias: 'USD' },
      dest_currency: { code: 'USD', alias: 'USD' },
      source_amount: totalUsd,
      dest_amount: totalUsd,
      status: 'COMPLETED',
      created_at: new Date(now - 1_000 * 60 * 60 * 24 * Math.floor(days / 2)).toISOString(),
      comment: null,
    },
  ];
}

describe('IdleCapitalAnalyzer', () => {
  it('detecta USD 3500 como ocioso cuando saldo=5000 y gasto mensual=1000', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 5000 }],
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
      checking: [{ currency: 'USD', balance: 800 }],
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

  it('trata USDT en checking 1:1 con USD y lo reporta si supera el colchón', async () => {
    const { client, poller } = buildMocks({
      checking: [
        { currency: 'USD', balance: 300 },
        { currency: 'USDT', balance: 2500 },
      ],
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
    const usdt = result.idleAssets.find(
      (a) => a.category === 'checking' && a.currency === 'USDT',
    );
    expect(usdt).toBeDefined();
    expect(usdt?.amount).toBeGreaterThan(0);
  });

  it('detecta cash sin invertir en cuenta INVESTMENT (symbol: USD, shares > threshold)', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 100 }],
      stocks: [
        { symbol: 'AAPL', shares: 5 },
        { symbol: 'USD', shares: 1500 },
      ],
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
    const cash = result.idleAssets.find((a) => a.category === 'investment_cash');
    expect(cash).toBeDefined();
    expect(cash?.amount).toBe(1500);
  });

  it('no reporta cuando el cash en INVESTMENT está por debajo del threshold', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 100 }],
      stocks: [{ symbol: 'USD', shares: 400 }],
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
    expect(result.idleAssets.find((a) => a.category === 'investment_cash')).toBeUndefined();
  });

  it('usa MIN_BUFFER_USD (200) como piso cuando no hay transacciones (burn=0)', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 800 }],
      transactions: [],
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 100,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    // burn=0 → buffer candidato sería 0*1.5=0, pero el piso es 200.
    expect(result.recommendedBufferUSD).toBe(200);
    expect(result.monthlyBurnRateUSD).toBe(0);
    // 800 - 200 = 600 > threshold 100 → debe reportar.
    const asset = result.idleAssets.find((a) => a.category === 'checking');
    expect(asset?.amount).toBe(600);
  });

  it('normaliza burn rate a 30 días cuando analysisDays es 60', async () => {
    // En 60 días gastamos 2000 USD → normalizado a 30 días = 1000/mes.
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 10_000 }],
      transactions: buildEgressTxs(2000, 60),
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 60,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    expect(result.monthlyBurnRateUSD).toBe(1000);
    expect(result.recommendedBufferUSD).toBe(1500);
    // 10000 - 1500 = 8500 de exceso.
    expect(result.idleAssets.find((a) => a.category === 'checking')?.amount).toBe(8500);
  });

  it('ignora DEPOSIT y TRADE al calcular burn rate (no son egresos)', async () => {
    const now = Date.now();
    const nonEgressTxs: Transaction[] = [
      {
        uuid: 'tx-deposit',
        type: 'DEPOSIT',
        external_address: null,
        source_currency: { code: 'USD', alias: 'USD' },
        dest_currency: { code: 'USD', alias: 'USD' },
        source_amount: 5000,
        dest_amount: 5000,
        status: 'COMPLETED',
        created_at: new Date(now - 86_400_000).toISOString(),
        comment: null,
      },
      {
        uuid: 'tx-trade',
        type: 'TRADE',
        external_address: null,
        source_currency: { code: 'USD', alias: 'USD' },
        dest_currency: { code: 'USD', alias: 'USD' },
        source_amount: 1000,
        dest_amount: 1000,
        status: 'COMPLETED',
        created_at: new Date(now - 86_400_000).toISOString(),
        comment: null,
      },
    ];

    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 5000 }],
      transactions: nonEgressTxs,
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    // Depósitos y trades no cuentan como gasto — burn rate = 0.
    expect(result.monthlyBurnRateUSD).toBe(0);
  });

  it('cuenta WITHDRAWAL_LOCAL como egreso al calcular burn rate', async () => {
    const now = Date.now();
    const withdrawalTx: Transaction[] = [
      {
        uuid: 'tx-withdrawal',
        type: 'WITHDRAWAL_LOCAL',
        external_address: 'Juan Perez',
        source_currency: { code: 'USD', alias: 'USD' },
        dest_currency: { code: 'USD', alias: 'USD' },
        source_amount: 800,
        dest_amount: 800,
        status: 'COMPLETED',
        created_at: new Date(now - 86_400_000).toISOString(),
        comment: null,
      },
    ];

    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 5000 }],
      transactions: withdrawalTx,
    });

    const analyzer = new IdleCapitalAnalyzer({
      client,
      poller,
      analysisDays: 30,
      idleThresholdUsd: 500,
      checkingBufferMultiplier: 1.5,
    });

    const result = await analyzer.analyze();

    expect(result.monthlyBurnRateUSD).toBe(800);
    expect(result.recommendedBufferUSD).toBe(1200);
  });

  it('calcula opportunityCost correctamente (5% anual sobre los días)', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 5000 }],
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

    // idle=3500, days=30 → 3500 * (0.05/365) * 30 ≈ 14.38
    const asset = result.idleAssets.find((a) => a.category === 'checking');
    expect(asset?.opportunityCost).toBeCloseTo(14.38, 1);
    expect(result.totalIdleUSD).toBe(3500);
    expect(result.totalOpportunityCost).toBeCloseTo(14.38, 1);
  });

  it('cuando hasIdle=false, el reporte no menciona "Capital ocioso"', async () => {
    const { client, poller } = buildMocks({
      checking: [{ currency: 'USD', balance: 300 }],
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
