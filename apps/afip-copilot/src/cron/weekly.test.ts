import { describe, it, expect, vi } from 'vitest';
import { formatWeeklyReport } from './reporter.js';

function makeSnapshot(overrides: Partial<{
  id: string;
  patrimonioUsd: string;
  patrimonioArs: string;
  bpProjectedArs: string;
  dividendsYtdArs: string;
  incomeTaxYtdArs: string;
  payload: Record<string, unknown>;
  snapshotAt: Date;
  fiscalYear: number;
}> = {}) {
  return {
    id: 'snap-1',
    snapshotAt: new Date('2025-04-20'),
    fiscalYear: 2025,
    patrimonioUsd: '200000',
    patrimonioArs: '240000000',
    bpProjectedArs: '500000',
    dividendsYtdArs: '1000000',
    incomeTaxYtdArs: '50000',
    payload: { tramo: 1 },
    ...overrides,
  };
}

describe('formatWeeklyReport', () => {
  it('genera el reporte con datos del snapshot actual', () => {
    const report = formatWeeklyReport({
      current: makeSnapshot(),
      previous: null,
      fiscalYear: 2025,
      newDividendCount: 3,
      nextReportDate: '2025-04-27',
    });

    expect(report).toContain('200');
    expect(report).toContain('2025');
    expect(report).toContain('2025-04-27');
  });

  it('muestra deltas cuando hay snapshot anterior', () => {
    const current = makeSnapshot({ patrimonioUsd: '220000', bpProjectedArs: '600000', payload: { tramo: 2 } });
    const previous = makeSnapshot({ patrimonioUsd: '200000', bpProjectedArs: '500000', payload: { tramo: 1 } });

    const report = formatWeeklyReport({
      current,
      previous,
      fiscalYear: 2025,
      newDividendCount: 1,
      nextReportDate: '2025-04-27',
    });

    expect(report).toContain('+'); // delta positivo
    expect(report).toContain('cambió de tramo');
  });

  it('reporta 0 deltas cuando los snapshots son iguales', () => {
    const snap = makeSnapshot({ patrimonioUsd: '200000', bpProjectedArs: '500000', payload: { tramo: 1 } });

    const report = formatWeeklyReport({
      current: snap,
      previous: makeSnapshot({ patrimonioUsd: '200000', bpProjectedArs: '500000', payload: { tramo: 1 } }),
      fiscalYear: 2025,
      newDividendCount: 0,
      nextReportDate: '2025-04-27',
    });

    // Sin cambio de tramo.
    expect(report).not.toContain('cambió de tramo');
  });

  it('alerta cuando BP subió mucho', () => {
    const report = formatWeeklyReport({
      current: makeSnapshot({ bpProjectedArs: '20000000' }),
      previous: makeSnapshot({ bpProjectedArs: '0' }),
      fiscalYear: 2025,
      newDividendCount: 0,
      nextReportDate: '2025-04-27',
    });

    expect(report).toContain('⚠️');
  });
});
