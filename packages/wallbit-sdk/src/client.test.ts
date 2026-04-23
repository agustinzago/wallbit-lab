// Tests del SDK. Mockeamos `fetch` global con vi.stubGlobal para no depender de
// msw. Los bodies de respuesta son los ejemplos textuales de la OpenAPI spec.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallbitClient } from './client.js';
import {
  WallbitAuthError,
  WallbitNotFoundError,
  WallbitPreconditionError,
  WallbitValidationError,
} from './errors.js';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WallbitClient — auth & transporte', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('envía el header X-API-Key en cada request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const client = new WallbitClient({ apiKey: 'test-key-123' });
    await client.balance.getChecking();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['X-API-Key']).toBe('test-key-123');
  });

  it('no incluye Content-Type en requests GET (sin body)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    const client = new WallbitClient({ apiKey: 'k' });
    await client.balance.getChecking();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type']).toBeUndefined();
  });

  it('reintenta en 429 y devuelve OK en el segundo intento', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const client = new WallbitClient({ apiKey: 'k' });
    const balances = await client.balance.getChecking();

    expect(balances).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('lanza WallbitAuthError cuando la API devuelve 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const client = new WallbitClient({ apiKey: 'bad' });
    await expect(client.balance.getChecking()).rejects.toBeInstanceOf(WallbitAuthError);
  });

  it('lanza WallbitPreconditionError en 412 (KYC / account locked / migrating)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Your investment account is locked' }, 412),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    await expect(
      client.operations.internalTransfer({
        currency: 'USD',
        from: 'DEFAULT',
        to: 'INVESTMENT',
        amount: 100,
      }),
    ).rejects.toBeInstanceOf(WallbitPreconditionError);
  });

  it('lanza WallbitNotFoundError en 404 (ej. rates sin par)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'not found' }, 404));
    const client = new WallbitClient({ apiKey: 'k' });
    await expect(
      client.rates.get({ sourceCurrency: 'XYZ', destCurrency: 'USD' }),
    ).rejects.toBeInstanceOf(WallbitNotFoundError);
  });

  it('lanza WallbitValidationError cuando el body no matchea el schema', async () => {
    // Falta `data` en la respuesta → el schema de checking balance explota al parsear.
    fetchMock.mockResolvedValueOnce(jsonResponse({ wallets: [] }));
    const client = new WallbitClient({ apiKey: 'k' });
    await expect(client.balance.getChecking()).rejects.toBeInstanceOf(WallbitValidationError);
  });
});

describe('WallbitClient — endpoints reales (parse de responses de ejemplo)', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('balance.getChecking parsea el ejemplo multi-currency de la spec', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ currency: 'USD', balance: 1000.5 }] }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const balances = await client.balance.getChecking();
    expect(balances).toEqual([{ currency: 'USD', balance: 1000.5 }]);
  });

  it('balance.getStocks parsea el ejemplo de portfolio con cash (symbol USD)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { symbol: 'AAPL', shares: 10.5 },
          { symbol: 'TSLA', shares: 5.25 },
          { symbol: 'USD', shares: 500 },
        ],
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const positions = await client.balance.getStocks();
    expect(positions).toHaveLength(3);
    expect(positions[2]).toEqual({ symbol: 'USD', shares: 500 });
  });

  it('wallets.getAll parsea el ejemplo de la spec (sin balance, con currency_code)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            network: 'ethereum',
            currency_code: 'USDT',
          },
        ],
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const wallets = await client.wallets.getAll();
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.currency_code).toBe('USDT');
    expect(wallets[0]?.network).toBe('ethereum');
  });

  it('transactions.list parsea el doble envelope data.data y expone paginación', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          data: [
            {
              uuid: '550e8400-e29b-41d4-a716-446655440000',
              type: 'WITHDRAWAL_LOCAL',
              external_address: 'Juan Perez',
              source_currency: { code: 'USD', alias: 'USD' },
              dest_currency: { code: 'USD', alias: 'USD' },
              source_amount: 100,
              dest_amount: 100,
              status: 'COMPLETED',
              created_at: '2024-01-15T10:30:00.000000Z',
              comment: null,
            },
          ],
          pages: 5,
          current_page: 1,
          count: 50,
        },
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const result = await client.transactions.list({ page: 1, limit: 10 });
    expect(result.pages).toBe(5);
    expect(result.currentPage).toBe(1);
    expect(result.count).toBe(50);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.items[0]?.source_amount).toBe(100);
  });

  it('transactions.list serializa from_date/to_date en la query', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { data: [], pages: 0, current_page: 1, count: 0 } }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    await client.transactions.list({ fromDate: '2024-01-01', toDate: '2024-12-31' });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('from_date=2024-01-01');
    expect(url).toContain('to_date=2024-12-31');
  });

  it('trades.place envía body con snake_case y parsea data wrap', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          symbol: 'AAPL',
          direction: 'BUY',
          amount: 100,
          shares: 0.5847953,
          status: 'REQUESTED',
          order_type: 'MARKET',
          created_at: '2024-01-15T10:30:00.000000Z',
          updated_at: '2024-01-15T10:30:00.000000Z',
        },
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const trade = await client.trades.place({
      symbol: 'AAPL',
      direction: 'BUY',
      orderType: 'MARKET',
      amount: 100,
    });
    expect(trade.status).toBe('REQUESTED');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      symbol: 'AAPL',
      direction: 'BUY',
      currency: 'USD',
      order_type: 'MARKET',
      amount: 100,
    });
  });

  it('trades.place valida amount XOR shares del lado del cliente', async () => {
    const client = new WallbitClient({ apiKey: 'k' });
    await expect(
      client.trades.place({
        symbol: 'AAPL',
        direction: 'BUY',
        orderType: 'MARKET',
        amount: 100,
        shares: 1,
      }),
    ).rejects.toThrow(/exactamente uno/);
  });

  it('operations.internalTransfer pega a /operations/internal (no internal-transfer)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        uuid: 'tx-1',
        type: 'INTERNAL_TRANSFER',
        external_address: null,
        source_currency: { code: 'USD', alias: 'USD' },
        dest_currency: { code: 'USD', alias: 'USD' },
        source_amount: 100,
        dest_amount: 100,
        status: 'COMPLETED',
        created_at: '2024-01-15T10:30:00Z',
        comment: null,
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const tx = await client.operations.internalTransfer({
      currency: 'USD',
      from: 'DEFAULT',
      to: 'INVESTMENT',
      amount: 100,
    });
    expect(tx.uuid).toBe('tx-1');

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.endsWith('/v1/operations/internal')).toBe(true);
    expect(url).not.toContain('internal-transfer');
  });

  it('rates.get parsea identity pair (rate 1, updated_at null)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          source_currency: 'USD',
          dest_currency: 'USD',
          pair: 'USDUSD',
          rate: 1,
          updated_at: null,
        },
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const rate = await client.rates.get({ sourceCurrency: 'USD', destCurrency: 'USD' });
    expect(rate.rate).toBe(1);
    expect(rate.updated_at).toBeNull();
  });

  it('fees.get devuelve null cuando data es [] y FeeSetting cuando viene poblado', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            fee_type: 'TRADE',
            tier: 'LEVEL1',
            percentage_fee: '0.5',
            fixed_fee_usd: '0.00',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const client = new WallbitClient({ apiKey: 'k' });
    const populated = await client.fees.get({ type: 'TRADE' });
    expect(populated?.tier).toBe('LEVEL1');
    const empty = await client.fees.get({ type: 'TRADE' });
    expect(empty).toBeNull();
  });

  it('assets.list mapea el envelope paginado a items/pages/currentPage/count', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            price: 175.5,
            asset_type: 'Stock',
            exchange: 'NASDAQ',
            sector: 'Technology',
            market_cap_m: '2750000',
            description: 'Apple Inc. designs...',
            logo_url: 'https://static.atomicvest.com/AAPL.svg',
          },
        ],
        pages: 15,
        current_page: 1,
        count: 150,
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const result = await client.assets.list({ category: 'TECHNOLOGY' });
    expect(result.count).toBe(150);
    expect(result.items[0]?.symbol).toBe('AAPL');
  });

  it('assets.getBySymbol parsea el envelope data', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          price: 175.5,
          logo_url: 'https://x/AAPL.svg',
        },
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const asset = await client.assets.getBySymbol('AAPL');
    expect(asset.symbol).toBe('AAPL');
  });

  it('cards.list parsea array envuelto', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            uuid: 'card-1',
            status: 'ACTIVE',
            card_type: 'VIRTUAL',
            card_network: 'visa',
            card_last4: '1234',
            expiration: '2029-01-01',
          },
        ],
      }),
    );
    const client = new WallbitClient({ apiKey: 'k' });
    const cards = await client.cards.list();
    expect(cards).toHaveLength(1);
    expect(cards[0]?.status).toBe('ACTIVE');
  });

  it('roboAdvisor.deposit valida mínimo 10 USD en cliente', async () => {
    const client = new WallbitClient({ apiKey: 'k' });
    await expect(
      client.roboAdvisor.deposit({ roboAdvisorId: 1, amount: 5, from: 'DEFAULT' }),
    ).rejects.toThrow(/mínimo es 10/);
  });
});
