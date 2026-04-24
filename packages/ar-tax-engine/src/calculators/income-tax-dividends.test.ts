import { describe, it, expect } from 'vitest';
import { projectIncomeTaxDividends } from './income-tax-dividends.js';
import type { DividendWithFx } from '../types.js';

function makeDividend(overrides: Partial<DividendWithFx> = {}): DividendWithFx {
  return {
    payDate: '2026-03-15',
    symbol: 'AAPL',
    amountUsd: 100,
    whtUsdAmount: 30, // 30% WHT USA por default
    sourceTxUuid: 'tx-1',
    fxBnaCompradorAtPayDate: 1200,
    ...overrides,
  };
}

describe('projectIncomeTaxDividends', () => {
  describe('sin dividendos', () => {
    it('devuelve proyección vacía con impuesto 0', () => {
      const result = projectIncomeTaxDividends([], 2026);

      expect(result.incomeTaxArs).toBe(0);
      expect(result.totalGrossArs).toBe(0);
      expect(result.netTaxArs).toBe(0);
    });
  });

  describe('alícuota marginal', () => {
    it('aplica alícuota correcta para total en primer tramo Art. 94', () => {
      // 1 dividendo de 100 USD × 1200 = 120.000 ARS → primer tramo (5%)
      const div = makeDividend({ amountUsd: 100, whtUsdAmount: 0, fxBnaCompradorAtPayDate: 1200 });
      const result = projectIncomeTaxDividends([div], 2026);

      expect(result.totalGrossArs).toBeCloseTo(120_000, -1);
      expect(result.marginalRateUsed).toBe(0.05);
      // 120.000 × 5% = 6.000
      expect(result.incomeTaxArs).toBeCloseTo(6_000, -1);
    });

    it('alícuota marginal correcta en borde de tramo', () => {
      // Total justo en el borde del tramo 1: 870.000 ARS exactos.
      const div = makeDividend({ amountUsd: 725, whtUsdAmount: 0, fxBnaCompradorAtPayDate: 1200 });
      // 725 × 1200 = 870.000
      const result = projectIncomeTaxDividends([div], 2026);

      expect(result.totalGrossArs).toBeCloseTo(870_000, -1);
      expect(result.marginalRateUsed).toBe(0.05);
    });

    it('multiple dividendos acumulan correctamente', () => {
      const divs = [
        makeDividend({ amountUsd: 500, whtUsdAmount: 150, fxBnaCompradorAtPayDate: 1200 }),
        makeDividend({ amountUsd: 300, whtUsdAmount: 90, fxBnaCompradorAtPayDate: 1200, sourceTxUuid: 'tx-2' }),
      ];
      const result = projectIncomeTaxDividends(divs, 2026);

      expect(result.totalGrossArs).toBeCloseTo(960_000, -1); // 800 × 1200
      expect(result.dividends).toHaveLength(2);
    });
  });

  describe('crédito fiscal WHT', () => {
    it('WHT crédito se aplica y no da resultado negativo', () => {
      const div = makeDividend({ amountUsd: 100, whtUsdAmount: 30 });
      const result = projectIncomeTaxDividends([div], 2026);

      expect(result.foreignTaxCreditArs).toBeGreaterThanOrEqual(0);
      expect(result.netTaxArs).toBeGreaterThanOrEqual(0);
    });

    it('WHT mayor al impuesto AR → crédito limitado al impuesto AR (no negativo)', () => {
      // WHT del 50% sobre dividendo pequeño puede superar el impuesto AR.
      const div = makeDividend({ amountUsd: 100, whtUsdAmount: 50, fxBnaCompradorAtPayDate: 1200 });
      const result = projectIncomeTaxDividends([div], 2026);

      expect(result.netTaxArs).toBe(0);
      expect(result.foreignTaxCreditArs).toBeLessThanOrEqual(result.incomeTaxArs + 1); // +1 por redondeo
    });

    it('WHT = 0 → crédito 0', () => {
      const div = makeDividend({ whtUsdAmount: 0 });
      const result = projectIncomeTaxDividends([div], 2026);

      expect(result.foreignTaxCreditArs).toBe(0);
      expect(result.netTaxArs).toBe(result.incomeTaxArs);
    });
  });

  describe('período sin tabla cargada', () => {
    it('período sin tabla → warning en el resultado', () => {
      // 2023 no tiene tabla cargada, debe usar fallback + warning.
      const div = makeDividend({ fxBnaCompradorAtPayDate: 400 });
      const result = projectIncomeTaxDividends([div], 2023);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.incomeTaxArs).toBeGreaterThanOrEqual(0);
    });
  });
});
