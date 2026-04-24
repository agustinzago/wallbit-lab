import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FxService } from './service.js';
import { InMemoryFxStore } from './in-memory-store.js';
import { FxSourceError, FxNotFoundError } from './errors.js';
import type { FxQuote } from './types.js';

// Mock del módulo bna-client para que los tests no hagan llamadas de red.
vi.mock('./bna-client.js', () => ({
  fetchFromBna: vi.fn(),
}));

import { fetchFromBna } from './bna-client.js';

const mockFetchFromBna = vi.mocked(fetchFromBna);

function makeQuote(date: string, side: 'buyer' | 'seller', rate: number): FxQuote {
  return { date, currency: 'USD', side, rate, source: 'bna', fetchedAt: new Date() };
}

describe('FxService', () => {
  let store: InMemoryFxStore;
  let service: FxService;

  beforeEach(() => {
    store = new InMemoryFxStore();
    service = new FxService({ store });
    vi.clearAllMocks();
  });

  describe('getBnaDivisa', () => {
    it('devuelve del cache si existe (no llama a BNA)', async () => {
      const cached = makeQuote('2025-03-15', 'buyer', 1050);
      await store.set(cached);

      const result = await service.getBnaDivisa({ date: '2025-03-15', side: 'buyer' });

      expect(result).toEqual(cached);
      expect(mockFetchFromBna).not.toHaveBeenCalled();
    });

    it('fetchea del BNA en cache miss y guarda en store', async () => {
      mockFetchFromBna.mockResolvedValueOnce({ comprador: 1200, vendedor: 1250 });

      const result = await service.getBnaDivisa({ date: '2025-06-01', side: 'buyer' });

      expect(mockFetchFromBna).toHaveBeenCalledOnce();
      expect(result.rate).toBe(1200);
      expect(result.source).toBe('bna');

      // Verificar que se guardó en cache.
      const inCache = await store.get({ date: '2025-06-01', side: 'buyer' });
      expect(inCache?.rate).toBe(1200);
    });

    it('usa el lado "seller" correctamente', async () => {
      mockFetchFromBna.mockResolvedValueOnce({ comprador: 1200, vendedor: 1250 });

      const result = await service.getBnaDivisa({ date: '2025-06-01', side: 'seller' });

      expect(result.rate).toBe(1250);
    });

    it('lanza FxSourceError si BNA falla', async () => {
      mockFetchFromBna.mockRejectedValueOnce(new FxSourceError('bna', 'Sin conexión'));

      await expect(service.getBnaDivisa({ date: '2025-03-15', side: 'buyer' })).rejects.toThrow(
        FxSourceError,
      );
    });

    it('segunda llamada con la misma fecha usa cache (no llama BNA dos veces)', async () => {
      mockFetchFromBna.mockResolvedValue({ comprador: 1200, vendedor: 1250 });

      await service.getBnaDivisa({ date: '2025-06-01', side: 'buyer' });
      await service.getBnaDivisa({ date: '2025-06-01', side: 'buyer' });

      expect(mockFetchFromBna).toHaveBeenCalledOnce();
    });
  });

  describe('getLastBusinessDayBeforeYearEnd', () => {
    it('devuelve el 31/12 si tiene cotización', async () => {
      mockFetchFromBna.mockResolvedValueOnce({ comprador: 1200, vendedor: 1250 });

      const result = await service.getLastBusinessDayBeforeYearEnd(2025);

      expect(result.date).toBe('2025-12-31');
    });

    it('retrocede al día hábil anterior si el 31/12 no tiene cotización (fin de semana)', async () => {
      // 31/12 falla, 30/12 también, 29/12 tiene cotización.
      mockFetchFromBna
        .mockRejectedValueOnce(new FxSourceError('bna', 'Feriado'))
        .mockRejectedValueOnce(new FxSourceError('bna', 'Fin de semana'))
        .mockResolvedValueOnce({ comprador: 805, vendedor: 820 });

      const result = await service.getLastBusinessDayBeforeYearEnd(2023);

      expect(result.date).toBe('2023-12-29');
      expect(result.rate).toBe(805);
    });

    it('lanza FxNotFoundError si no hay cotización en 8 días', async () => {
      mockFetchFromBna.mockRejectedValue(new FxSourceError('bna', 'Sin datos'));

      await expect(service.getLastBusinessDayBeforeYearEnd(2025)).rejects.toThrow(FxNotFoundError);
    });
  });
});
