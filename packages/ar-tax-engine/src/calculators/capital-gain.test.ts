import { describe, it, expect } from 'vitest';
import { simulateSale } from './capital-gain.js';
import type { CostBasisLot, SaleSimulationInput } from '../types.js';

function makeLot(
  id: string,
  purchaseDate: string,
  shares: number,
  priceUsd: number,
  fxBnaVendedorAtPurchase: number,
): CostBasisLot {
  return {
    lotId: id,
    symbol: 'AAPL',
    purchaseDate,
    shares,
    remainingShares: shares,
    priceUsd,
    fxBnaVendedorAtPurchase,
  };
}

describe('simulateSale', () => {
  const lot1 = makeLot('lot-1', '2024-01-15', 100, 150, 1000); // cost basis: 100 × 150 × 1000 = 15.000.000 ARS
  const lot2 = makeLot('lot-2', '2024-06-01', 50, 180, 1100);  // cost basis: 50 × 180 × 1100 = 9.900.000 ARS

  describe('FIFO sobre lotes heterogéneos', () => {
    it('vende del lote más antiguo primero', () => {
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 100,
        currentPriceUsd: 200,
        lots: [lot2, lot1], // desordenados — deben reordenarse por fecha
        method: 'FIFO',
        fxBnaVendedor: 1200,
      });

      expect(result.lotsConsumed).toHaveLength(1);
      expect(result.lotsConsumed[0]?.lotId).toBe('lot-1');
      expect(result.lotsConsumed[0]?.sharesTaken).toBe(100);
    });

    it('venta parcial consume solo lotes suficientes', () => {
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 50,
        currentPriceUsd: 200,
        lots: [lot1, lot2],
        method: 'FIFO',
        fxBnaVendedor: 1200,
      });

      expect(result.lotsConsumed).toHaveLength(1);
      expect(result.lotsConsumed[0]?.lotId).toBe('lot-1');
      expect(result.lotsConsumed[0]?.sharesTaken).toBe(50);
    });

    it('consume dos lotes si el primero no alcanza', () => {
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 120,
        currentPriceUsd: 200,
        lots: [lot1, lot2],
        method: 'FIFO',
        fxBnaVendedor: 1200,
      });

      expect(result.lotsConsumed).toHaveLength(2);
      expect(result.lotsConsumed[0]?.sharesTaken).toBe(100);
      expect(result.lotsConsumed[1]?.sharesTaken).toBe(20);
    });
  });

  describe('cálculo de ganancia y impuesto', () => {
    it('calcula ganancia y impuesto cedular 15% correctamente', () => {
      // 100 shares × 200 USD × 1200 TC = 24.000.000 ARS (proceeds)
      // cost basis: 100 × 150 × 1000 = 15.000.000 ARS
      // ganancia: 9.000.000 ARS
      // impuesto: 9.000.000 × 15% = 1.350.000 ARS
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 100,
        currentPriceUsd: 200,
        lots: [lot1],
        method: 'FIFO',
        fxBnaVendedor: 1200,
      });

      expect(result.capitalGainArs).toBeCloseTo(9_000_000, -2);
      expect(result.cedularTaxArs).toBeCloseTo(1_350_000, -2);
      expect(result.netProceedsArs).toBeCloseTo(24_000_000 - 1_350_000, -2);
    });

    it('ganancia negativa (quebranto) → cedularTaxArs: 0 + warning', () => {
      // Compró a 150, vende a 100 → pérdida.
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 100,
        currentPriceUsd: 100,
        lots: [lot1],
        method: 'FIFO',
        fxBnaVendedor: 1000,
      });

      expect(result.capitalGainArs).toBeLessThan(0);
      expect(result.cedularTaxArs).toBe(0);
      expect(result.warnings.some((w) => w.includes('quebranto') || w.includes('Quebranto'))).toBe(true);
    });
  });

  describe('casos edge', () => {
    it('shares > remaining total → warning, calcula con máximo disponible', () => {
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 999,
        currentPriceUsd: 200,
        lots: [lot1], // solo 100 shares disponibles
        method: 'FIFO',
        fxBnaVendedor: 1200,
      });

      expect(result.warnings.some((w) => w.includes('excede'))).toBe(true);
      expect(result.lotsConsumed[0]?.sharesTaken).toBe(100);
    });

    it('lanza RangeError si sharesToSell <= 0', () => {
      expect(() =>
        simulateSale({
          symbol: 'AAPL',
          sharesToSell: 0,
          currentPriceUsd: 200,
          lots: [lot1],
          method: 'FIFO',
          fxBnaVendedor: 1200,
        }),
      ).toThrow(RangeError);
    });

    it('weighted_average distribuye cost por promedio', () => {
      const result = simulateSale({
        symbol: 'AAPL',
        sharesToSell: 50,
        currentPriceUsd: 200,
        lots: [lot1, lot2], // cost promedio diferente al FIFO
        method: 'weighted_average',
        fxBnaVendedor: 1200,
      });

      expect(result.cedularTaxArs).toBeGreaterThanOrEqual(0);
    });
  });
});
