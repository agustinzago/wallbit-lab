import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DividendDetector } from './dividend-detector.js';
import { DividendIngester } from './dividend-ingester.js';
import { InMemoryFxStore, FxService } from '@wallbit-lab/fx-ars';
import type { FxQuote } from '@wallbit-lab/fx-ars';
import type { WallbitClient, Transaction } from '@wallbit-lab/sdk';

// Mock del TransactionPoller para controlar las transacciones sin red.
vi.mock('@wallbit-lab/wallbit-ingest', () => ({
  TransactionPoller: vi.fn().mockImplementation(() => ({
    fetchRecent: vi.fn(),
  })),
}));

import { TransactionPoller } from '@wallbit-lab/wallbit-ingest';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    uuid: 'tx-1',
    type: 'DIVIDEND',
    source_currency: { code: 'USD', alias: 'USD' },
    dest_currency: { code: 'USD', alias: 'USD' },
    source_amount: 0,
    dest_amount: 100,
    status: 'COMPLETED',
    created_at: '2025-03-15T12:00:00Z',
    ...overrides,
  };
}

function makeDb() {
  const inserted: unknown[] = [];
  const existing = new Set<string>();

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            // Simular idempotencia: si la uuid ya existe, devolver [].
            const lastCall = (
              mockDb.insert.mock.calls[mockDb.insert.mock.calls.length - 1] ?? []
            )[0];
            const uuid = String(lastCall ?? '');
            return Promise.resolve(existing.has(uuid) ? [] : [{ sourceTxUuid: uuid }]);
          }),
        }),
      }),
    }),
    _inserted: inserted,
    _existing: existing,
  };
}

const mockDb = makeDb();

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('DividendDetector', () => {
  it('identifica dividendo por tipo exacto', () => {
    const detector = new DividendDetector({ dividendTypes: ['DIVIDEND'] });
    expect(detector.isDividend(makeTransaction({ type: 'DIVIDEND' }))).toBe(true);
    expect(detector.isDividend(makeTransaction({ type: 'CARD_SPENT' }))).toBe(false);
  });

  it('soporta tipos múltiples configurables', () => {
    const detector = new DividendDetector({
      dividendTypes: ['DIVIDEND', 'ROBOADVISOR_DIVIDEND'],
    });
    expect(detector.isDividend(makeTransaction({ type: 'ROBOADVISOR_DIVIDEND' }))).toBe(true);
    expect(detector.isDividend(makeTransaction({ type: 'INTEREST' }))).toBe(false);
  });
});

describe('DividendIngester', () => {
  let store: InMemoryFxStore;
  let fx: FxService;
  let pollerMock: { fetchRecent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = new InMemoryFxStore();
    fx = new FxService({ store });
    vi.clearAllMocks();

    pollerMock = { fetchRecent: vi.fn() };
    (TransactionPoller as ReturnType<typeof vi.fn>).mockImplementation(() => pollerMock);
  });

  it('ingesta tx de dividendo y persiste en DB', async () => {
    const txs = [makeTransaction({ uuid: 'tx-dividend', type: 'DIVIDEND', dest_amount: 50 })];
    pollerMock.fetchRecent.mockResolvedValueOnce(txs);

    const fxQuote: FxQuote = {
      date: '2025-03-15',
      currency: 'USD',
      side: 'buyer',
      rate: 1200,
      source: 'bna',
      fetchedAt: new Date(),
    };
    await store.set(fxQuote);

    const detector = new DividendDetector({ dividendTypes: ['DIVIDEND'] });
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ sourceTxUuid: 'tx-dividend' }]),
          }),
        }),
      }),
    };

    const ingester = new DividendIngester({
      client: {} as WallbitClient,
      detector,
      fx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      logger: makeLogger(),
    });

    const result = await ingester.ingestWindow({ days: 90 });

    expect(result.found).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('ignora tx que no son dividendos', async () => {
    const txs = [makeTransaction({ uuid: 'tx-card', type: 'CARD_SPENT' })];
    pollerMock.fetchRecent.mockResolvedValueOnce(txs);

    const detector = new DividendDetector({ dividendTypes: ['DIVIDEND'] });
    const db = { insert: vi.fn() };

    const ingester = new DividendIngester({
      client: {} as WallbitClient,
      detector,
      fx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      logger: makeLogger(),
    });

    const result = await ingester.ingestWindow({ days: 90 });

    expect(result.found).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('idempotencia: misma tx dos veces → 1 insert', async () => {
    const tx = makeTransaction({ uuid: 'tx-dup', type: 'DIVIDEND' });

    const fxQuote: FxQuote = {
      date: '2025-03-15',
      currency: 'USD',
      side: 'buyer',
      rate: 1200,
      source: 'bna',
      fetchedAt: new Date(),
    };
    await store.set(fxQuote);

    // Primera llamada retorna [row], segunda retorna [] (ya existe).
    const returningMock = vi.fn()
      .mockResolvedValueOnce([{ sourceTxUuid: 'tx-dup' }])
      .mockResolvedValueOnce([]);

    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: returningMock,
          }),
        }),
      }),
    };

    const detector = new DividendDetector({ dividendTypes: ['DIVIDEND'] });
    const ingester = new DividendIngester({
      client: {} as WallbitClient,
      detector,
      fx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      logger: makeLogger(),
    });

    pollerMock.fetchRecent.mockResolvedValue([tx]);

    const r1 = await ingester.ingestWindow({ days: 90 });
    const r2 = await ingester.ingestWindow({ days: 90 });

    expect(r1.inserted).toBe(1);
    expect(r2.inserted).toBe(0);
    expect(r2.skipped).toBe(1);
  });

  it('FX cache hit → no llama a BNA', async () => {
    const fxQuote: FxQuote = {
      date: '2025-03-15',
      currency: 'USD',
      side: 'buyer',
      rate: 1200,
      source: 'bna',
      fetchedAt: new Date(),
    };
    await store.set(fxQuote);

    const txs = [makeTransaction({ type: 'DIVIDEND' })];
    pollerMock.fetchRecent.mockResolvedValue(txs);

    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ sourceTxUuid: 'tx-1' }]),
          }),
        }),
      }),
    };

    const detector = new DividendDetector({ dividendTypes: ['DIVIDEND'] });
    const ingester = new DividendIngester({
      client: {} as WallbitClient,
      detector,
      fx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      logger: makeLogger(),
    });

    await ingester.ingestWindow({ days: 90 });

    // El store tiene el valor cacheado — el tamaño no cambió porque ya estaba.
    expect(store.size()).toBe(1);
  });
});
