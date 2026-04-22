// Tests básicos del SDK. Mockeamos `fetch` global con vi.stubGlobal para no depender
// de msw. Cubrimos: header de auth, retry en 429, mapeo de error en 401.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallbitClient } from './client.js';
import { WallbitAuthError } from './errors.js';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WallbitClient', () => {
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ balances: [] }));

    const client = new WallbitClient({ apiKey: 'test-key-123' });
    await client.balance.getChecking();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['X-API-Key']).toBe('test-key-123');
  });

  it('reintenta en 429 y devuelve OK en el segundo intento', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ balances: [] }));

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
});
