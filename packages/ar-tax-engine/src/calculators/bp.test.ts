import { describe, it, expect } from 'vitest';
import { projectBienesPersonales } from './bp.js';
import { UnsupportedPeriodError } from '../errors.js';
import type { BpProjectionInput, PortfolioSnapshot } from '../types.js';

const EMPTY_PORTFOLIO: PortfolioSnapshot = {
  valuationDate: '2025-12-31',
  usdCashBroker: 0,
  positions: [],
};

function makeInput(
  overrides: Partial<Omit<BpProjectionInput, 'portfolio'>> & { portfolio?: Partial<PortfolioSnapshot> } = {},
): BpProjectionInput {
  const { portfolio: portfolioOverride, ...rest } = overrides;
  return {
    period: 2025,
    portfolio: { ...EMPTY_PORTFOLIO, ...portfolioOverride },
    fxBnaComprador: 1200,
    isCumplidor: false,
    isReibpAdherido: false,
    ...rest,
  };
}

describe('projectBienesPersonales', () => {
  describe('bajo MNI', () => {
    it('portfolio bajo MNI 2025 → impuesto 0 y tramo 0', () => {
      // 200k USD × 1200 ARS = 240.000.000 ARS < MNI 384.728.044,57
      const result = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 200_000 } }),
      );

      expect(result.impuestoArs).toBe(0);
      expect(result.tramo).toBe(0);
      expect(result.excedenteArs).toBe(0);
    });

    it('portfolio en 0 → impuesto 0', () => {
      const result = projectBienesPersonales(makeInput());
      expect(result.impuestoArs).toBe(0);
      expect(result.tramo).toBe(0);
    });
  });

  describe('cálculo de tramos 2025', () => {
    it('tramo 1: excedente en primer tramo (0,5%)', () => {
      // Para caer en el primer tramo de 2025: excedente ≤ 108.214.688,96
      // Portfolio: 320k USD × 1200 = 384.000.000, excedente ≈ 0 (cerca del MNI)
      // Para excedente seguro en tramo 1: 340k USD × 1200 = 408.000.000
      // excedente = 408.000.000 - 384.728.044,57 = 23.271.955,43
      const result = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 340_000 } }),
      );

      expect(result.tramo).toBe(1);
      expect(result.impuestoArs).toBeGreaterThan(0);
      // 23.271.955,43 × 0,5% ≈ 116.359,78
      expect(result.impuestoArs).toBeCloseTo(23_271_955.43 * 0.005, -2);
    });

    it('tramo 2: excedente en segundo tramo (0,75%)', () => {
      // excedente > 108.214.688,96 → tramo 2
      // Portfolio: 500k USD × 1200 = 600.000.000, excedente = 215.271.955,43
      const result = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 500_000 } }),
      );

      expect(result.tramo).toBe(2);
      expect(result.impuestoArs).toBeGreaterThan(541_073);
    });

    it('tramo 3: excedente supera el segundo tramo (1%)', () => {
      // excedente > 234.436.919,76 → tramo 3
      // Portfolio: 700k USD × 1200 = 840.000.000, excedente = 455.271.955,43
      const result = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 700_000 } }),
      );

      expect(result.tramo).toBe(3);
      expect(result.impuestoArs).toBeGreaterThan(1_487_740);
    });
  });

  describe('flag isCumplidor', () => {
    it('cumplidor aplica tabla diferenciada (alícuotas reducidas)', () => {
      const general = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 500_000 }, isCumplidor: false }),
      );
      const cumplidor = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 500_000 }, isCumplidor: true }),
      );

      // La tabla cumplidor tiene alícuotas menores (0% en tramo 1, 0,25% en tramo 2...).
      expect(cumplidor.impuestoArs).toBeLessThan(general.impuestoArs);
    });
  });

  describe('flag isReibpAdherido', () => {
    it('REIBP adherido → impuesto 0 + warning', () => {
      const result = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 700_000 }, isReibpAdherido: true }),
      );

      expect(result.impuestoArs).toBe(0);
      expect(result.warnings.some((w) => w.includes('REIBP'))).toBe(true);
    });

    it('REIBP adherido con isReibpAdherido: false → calcula impuesto normalmente', () => {
      const result = projectBienesPersonales(
        makeInput({
          period: 2025,
          portfolio: { usdCashBroker: 700_000 },
          isReibpAdherido: false,
        }),
      );

      // Sin REIBP, el impuesto se calcula normalmente.
      expect(result.impuestoArs).toBeGreaterThan(0);
    });
  });

  describe('período no soportado', () => {
    it('lanza UnsupportedPeriodError para período sin reglas', () => {
      expect(() =>
        projectBienesPersonales(makeInput({ period: 2020 })),
      ).toThrow(UnsupportedPeriodError);
    });
  });

  describe('período estimado', () => {
    it('isEstimated 2025 → propaga warning', () => {
      const result = projectBienesPersonales(makeInput({ portfolio: { usdCashBroker: 500_000 } }));

      expect(result.warnings.some((w) => w.toLowerCase().includes('estimado'))).toBe(true);
    });
  });

  describe('activos exentos', () => {
    it('cashArBank no suma a la base imponible', () => {
      // Sin cash banco: 340k USD → tramo 1
      const withoutBank = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 340_000 } }),
      );

      // Con mucho cash en banco (exento): base debe ser la misma.
      const withBank = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 340_000, cashArBank: 50_000_000 } }),
      );

      // La base imponible en ARS no debe cambiar por cashArBank.
      expect(withBank.valuatedAssetsArs).toBe(withoutBank.valuatedAssetsArs);
      expect(withBank.impuestoArs).toBe(withoutBank.impuestoArs);
    });

    it('titulosPublicosAr no suma a la base imponible', () => {
      const withoutTitulos = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 340_000 } }),
      );
      const withTitulos = projectBienesPersonales(
        makeInput({ portfolio: { usdCashBroker: 340_000, titulosPublicosAr: 100_000_000 } }),
      );

      expect(withTitulos.valuatedAssetsArs).toBe(withoutTitulos.valuatedAssetsArs);
    });
  });

  describe('portfolio con positions', () => {
    it('suma positions al cálculo de la base imponible', () => {
      const result = projectBienesPersonales(
        makeInput({
          portfolio: {
            usdCashBroker: 0,
            positions: [{ symbol: 'AAPL', shares: 1000, priceUsd: 200 }], // 200k USD
          },
        }),
      );

      // 200k USD × 1200 = 240M ARS < MNI → impuesto 0.
      expect(result.impuestoArs).toBe(0);
      expect(result.valuatedAssetsArs).toBeCloseTo(240_000_000, -3);
    });
  });
});
