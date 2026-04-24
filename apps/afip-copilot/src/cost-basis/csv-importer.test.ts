import { describe, it, expect, vi } from 'vitest';
import type { Db } from '../db/client.js';
import { CsvImporter } from './csv-importer.js';

const CSV_VALID = [
  'date,symbol,shares,price_usd,side',
  '2023-06-15,AAPL,100,185.50,BUY',
  '2024-01-10,SPY,50,470.00,BUY',
  '2024-03-20,VOO,20,400.00,BUY',
].join('\n');

const CSV_WITH_SELL = [
  'date,symbol,shares,price_usd,side',
  '2023-06-15,AAPL,100,185.50,BUY',
  '2024-03-20,AAPL,30,200.00,SELL',
].join('\n');

const CSV_CORRUPTO = [
  'date,symbol,shares,price_usd,side',
  '2023-06-15,AAPL,-5,185.50,BUY', // shares negativo
  '2023-06-16,AAPL,abc,185.50,BUY', // shares inválido
].join('\n');

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeDb(existingIds: Set<string> = new Set()) {
  const inserted: string[] = [];

  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          const lastValues = insertMock.mock.calls.at(-1)?.[0];
          const id = typeof lastValues === 'object' && lastValues !== null ? String((lastValues as Record<string, unknown>)['id'] ?? '') : '';
          if (existingIds.has(id)) return Promise.resolve([]);
          inserted.push(id);
          return Promise.resolve([{ id }]);
        }),
      }),
    }),
  });

  const lots: Array<{ id: string; symbol: string; remainingShares: string; purchaseDate: string; source: string }> = [];

  const selectMock = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(lots),
      }),
    }),
  });

  const updateMock = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  return {
    insert: insertMock,
    select: selectMock,
    update: updateMock,
    _inserted: inserted,
    _lots: lots,
  };
}

describe('CsvImporter', () => {
  describe('CSV válido', () => {
    it('inserta N lots correctamente', async () => {
      const db = makeDb();
      const importer = new CsvImporter(db as unknown as Db, makeLogger());
      const result = await importer.import(CSV_VALID);

      expect(result.rowsProcessed).toBe(3);
      expect(result.inserted).toBe(3);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('CSV corrupto', () => {
    it('rechaza filas inválidas con warnings, sin insertar', async () => {
      const db = makeDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer = new CsvImporter(db as any, makeLogger());
      const result = await importer.import(CSV_CORRUPTO);

      expect(result.inserted).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('CSV con SELL', () => {
    it('procesa un SELL consumiendo lotes FIFO', async () => {
      const db = makeDb();
      // Simular que hay lotes para AAPL en la DB.
      db._lots.push({
        id: 'csv-abc123',
        symbol: 'AAPL',
        remainingShares: '100',
        purchaseDate: '2023-06-15',
        source: 'manual_csv',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer = new CsvImporter(db as any, makeLogger());
      const result = await importer.import(CSV_WITH_SELL);

      // 1 BUY insertado + SELL procesado
      expect(result.inserted).toBe(2); // BUY cuenta 1, SELL consumido cuenta 1
      expect(db.update).toHaveBeenCalled();
    });

    it('SELL sin BUY previo → warning', async () => {
      const csv = ['date,symbol,shares,price_usd,side', '2024-03-20,MSFT,10,400.00,SELL'].join('\n');
      const db = makeDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer = new CsvImporter(db as any, makeLogger());
      const result = await importer.import(csv);

      expect(result.warnings.some((w) => w.includes('MSFT'))).toBe(true);
    });
  });

  describe('idempotencia', () => {
    it('segunda importación del mismo CSV → 0 inserts (todo skipped)', async () => {
      const db = makeDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer = new CsvImporter(db as any, makeLogger());
      const r1 = await importer.import(CSV_VALID);
      expect(r1.inserted).toBe(3);

      // Segunda vez: todos los IDs ya existen.
      const existingIds = new Set(db._inserted);
      const db2 = makeDb(existingIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer2 = new CsvImporter(db2 as any, makeLogger());
      const r2 = await importer2.import(CSV_VALID);

      expect(r2.inserted).toBe(0);
      expect(r2.skipped).toBe(3);
    });
  });

  describe('CSV vacío', () => {
    it('CSV sin datos devuelve warning', async () => {
      const db = makeDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importer = new CsvImporter(db as any, makeLogger());
      const result = await importer.import('date,symbol,shares,price_usd,side');

      expect(result.inserted).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
