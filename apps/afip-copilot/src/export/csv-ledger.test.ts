import { describe, it, expect, vi } from 'vitest';
import { buildCsvLedger } from './csv-ledger.js';

function makeDb(rows: Array<{
  payDate: string;
  symbol: string;
  amountUsd: string;
  fxBnaComprador: string;
  amountArs: string;
  whtUsd: string;
  sourceTxUuid: string;
}>) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

describe('buildCsvLedger', () => {
  it('genera header correcto', async () => {
    const db = makeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await buildCsvLedger(db as any, 2025);
    const [header] = csv.split('\n');
    expect(header).toContain('fecha_pago');
    expect(header).toContain('monto_usd');
    expect(header).toContain('tc_bna_comprador');
    expect(header).toContain('uuid_wallbit');
  });

  it('CSV vacío (solo header) cuando no hay dividendos', async () => {
    const db = makeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await buildCsvLedger(db as any, 2025);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1); // solo header
  });

  it('genera una fila por dividendo con valores correctos', async () => {
    const rows = [
      {
        payDate: '2025-03-15',
        symbol: 'AAPL',
        amountUsd: '12.5',
        fxBnaComprador: '1250.00',
        amountArs: '15625.00',
        whtUsd: '3.75',
        sourceTxUuid: 'abc-123',
      },
    ];
    const db = makeDb(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await buildCsvLedger(db as any, 2025);
    const lines = csv.split('\n').filter(Boolean);

    expect(lines).toHaveLength(2); // header + 1 fila
    expect(lines[1]).toContain('2025-03-15');
    expect(lines[1]).toContain('AAPL');
    expect(lines[1]).toContain('abc-123');
  });

  it('round-trip: parsear el CSV generado devuelve los mismos valores', async () => {
    const rows = [
      {
        payDate: '2025-03-15',
        symbol: 'SPY',
        amountUsd: '50.00',
        fxBnaComprador: '1200.00',
        amountArs: '60000.00',
        whtUsd: '15.00',
        sourceTxUuid: 'tx-xyz',
      },
    ];
    const db = makeDb(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await buildCsvLedger(db as any, 2025);

    const [headerLine, dataLine] = csv.split('\n');
    const headers = (headerLine ?? '').split(',');
    const cells = (dataLine ?? '').split(',');

    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = cells[i] ?? ''; });

    expect(record['simbolo']).toBe('SPY');
    expect(record['fecha_pago']).toBe('2025-03-15');
    expect(Number(record['monto_usd'])).toBeCloseTo(50, 5);
  });

  it('incluye el campo norma_aplicada en cada fila', async () => {
    const rows = [
      {
        payDate: '2025-06-01',
        symbol: 'BRK',
        amountUsd: '100.00',
        fxBnaComprador: '1300.00',
        amountArs: '130000.00',
        whtUsd: '0.00',
        sourceTxUuid: 'tx-norma',
      },
    ];
    const db = makeDb(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await buildCsvLedger(db as any, 2025);
    // El campo norma_aplicada debe aparecer en la fila de datos.
    expect(csv).toContain('LIG Art.94');
    // Números usan punto decimal (no coma) para compatibilidad con Excel/LibreOffice.
    expect(csv).toContain('100.00000000');
  });
});
