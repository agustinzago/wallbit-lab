import { describe, it, expect, vi } from 'vitest';
import { PortfolioConsolidator } from './consolidator.js';
import type { WallbitClient } from '@wallbit-lab/sdk';
import type { AppConfig } from '../config.js';

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    wallbitApiKey: 'key',
    wallbitBaseUrl: undefined,
    telegramBotToken: 'token',
    telegramChatId: '123',
    databaseUrl: 'postgres://localhost/test',
    fiscalYear: 2025,
    contribuyenteCumplidor: false,
    reibpAdherido: false,
    costBasisMethod: 'FIFO',
    dryRun: true,
    logLevel: 'info',
    cashArBankArs: undefined,
    titulosPublicosArArs: undefined,
    dividendTxTypes: ['DIVIDEND'],
    taxpayerName: undefined,
    taxpayerCuit: undefined,
    ...overrides,
  };
}

function makeWallbitClient(overrides: Partial<{
  checkingBalances: { currency: string; balance: number }[];
  stocksPositions: { symbol: string; shares: number }[];
  roboPortfolios: { cash: number; assets: { symbol: string; shares: number; price: number }[] }[];
  assetPrices: Record<string, number>;
}> = {}): WallbitClient {
  const {
    checkingBalances = [{ currency: 'USD', balance: 10_000 }],
    stocksPositions = [],
    roboPortfolios = [],
    assetPrices = {},
  } = overrides;

  return {
    balance: {
      getChecking: vi.fn().mockResolvedValue(checkingBalances),
      getStocks: vi.fn().mockResolvedValue(stocksPositions),
    },
    roboAdvisor: {
      getBalance: vi.fn().mockResolvedValue(roboPortfolios),
    },
    assets: {
      getBySymbol: vi.fn().mockImplementation((symbol: string) => {
        const price = assetPrices[symbol];
        if (price === undefined) throw new Error(`No price for ${symbol}`);
        return Promise.resolve({ symbol, price });
      }),
    },
  } as unknown as WallbitClient;
}

describe('PortfolioConsolidator', () => {
  it('consolida cash USD desde checking', async () => {
    const client = makeWallbitClient({
      checkingBalances: [{ currency: 'USD', balance: 50_000 }],
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.usdCashBroker).toBeCloseTo(50_000);
    expect(snapshot.positions).toHaveLength(0);
  });

  it('suma el cash USD desde las 3 fuentes (checking, stocks, roboAdvisor)', async () => {
    const client = makeWallbitClient({
      checkingBalances: [{ currency: 'USD', balance: 10_000 }],
      stocksPositions: [{ symbol: 'USD', shares: 5_000 }],
      roboPortfolios: [{ cash: 2_000, assets: [] }],
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.usdCashBroker).toBeCloseTo(17_000);
  });

  it('incluye posiciones de acciones de stocks', async () => {
    const client = makeWallbitClient({
      checkingBalances: [],
      stocksPositions: [{ symbol: 'AAPL', shares: 100 }],
      assetPrices: { AAPL: 200 },
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.positions).toHaveLength(1);
    expect(snapshot.positions[0]?.symbol).toBe('AAPL');
    expect(snapshot.positions[0]?.shares).toBe(100);
    expect(snapshot.positions[0]?.priceUsd).toBe(200);
  });

  it('consolida holdings de roboadvisor', async () => {
    const client = makeWallbitClient({
      checkingBalances: [],
      stocksPositions: [],
      roboPortfolios: [
        {
          cash: 1_000,
          assets: [
            { symbol: 'SPY', shares: 10, price: 500 },
            { symbol: 'QQQ', shares: 5, price: 400 },
          ],
        },
      ],
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.usdCashBroker).toBeCloseTo(1_000);
    expect(snapshot.positions).toHaveLength(2);
  });

  it('agrega shares de símbolos que aparecen en múltiples fuentes', async () => {
    const client = makeWallbitClient({
      checkingBalances: [],
      stocksPositions: [{ symbol: 'AAPL', shares: 50 }],
      roboPortfolios: [{ cash: 0, assets: [{ symbol: 'AAPL', shares: 30, price: 200 }] }],
      assetPrices: { AAPL: 200 },
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.positions).toHaveLength(1);
    expect(snapshot.positions[0]?.shares).toBeCloseTo(80);
  });

  it('ignora monedas no USD en checking', async () => {
    const client = makeWallbitClient({
      checkingBalances: [
        { currency: 'USD', balance: 10_000 },
        { currency: 'ARS', balance: 500_000 },
      ],
    });

    const consolidator = new PortfolioConsolidator(client, makeConfig(), makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.usdCashBroker).toBeCloseTo(10_000);
  });

  it('pasa cashArBank y titulosPublicosAr desde config', async () => {
    const client = makeWallbitClient({ checkingBalances: [] });
    const config = makeConfig({ cashArBankArs: 1_000_000, titulosPublicosArArs: 500_000 });

    const consolidator = new PortfolioConsolidator(client, config, makeLogger());
    const snapshot = await consolidator.snapshot();

    expect(snapshot.cashArBank).toBe(1_000_000);
    expect(snapshot.titulosPublicosAr).toBe(500_000);
  });
});
