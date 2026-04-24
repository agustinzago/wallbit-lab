// Calculadora de ganancia de capital cedular extranjera.
// Fuente: LIG Art. 94 §3 + Art. 132 (quebrantos específicos) + research §3.
//
// Aplica 15% flat sobre la ganancia neta en ARS.
// Cost basis usa FIFO (o promedio ponderado según el método configurado).

import { toCents, fromCents } from '../cents.js';
import type { SaleSimulation, SaleSimulationInput } from '../types.js';

const CEDULAR_RATE = 0.15; // Art. 94 §3 LIG
const NORMA = 'LIG Art. 94 §3 + Art. 158 (15% sobre ganancia neta en ARS, FIFO)';

export function simulateSale(input: SaleSimulationInput): SaleSimulation {
  const warnings: string[] = [];

  if (input.sharesToSell <= 0) {
    throw new RangeError('simulateSale: sharesToSell debe ser > 0');
  }

  // Validar que hay suficientes shares en los lotes.
  const totalAvailable = input.lots.reduce((sum, lot) => sum + lot.remainingShares, 0);
  if (input.sharesToSell > totalAvailable) {
    warnings.push(
      `Shares a vender (${input.sharesToSell}) excede el total en lotes (${totalAvailable}). Se calculará con el máximo disponible.`,
    );
  }

  const effectiveSharesToSell = Math.min(input.sharesToSell, totalAvailable);

  // Calcular proceeds en USD y ARS.
  const proceedsUsd = effectiveSharesToSell * input.currentPriceUsd;
  const proceedsCents = toCents(proceedsUsd * input.fxBnaVendedor);

  // Consumir lotes en orden FIFO.
  let sharesRemaining = effectiveSharesToSell;
  let costBasisCents = 0n;
  const lotsConsumed: Array<{ lotId: string; sharesTaken: number; costArs: number }> = [];

  const sortedLots =
    input.method === 'FIFO'
      ? [...input.lots].sort(
          (a, b) => Date.parse(a.purchaseDate) - Date.parse(b.purchaseDate),
        )
      : [...input.lots]; // weighted_average: se procesa igual (el cost promedio se aplica al final)

  if (input.method === 'weighted_average') {
    // Costo promedio ponderado: totalCost / totalShares.
    const totalCostCents = input.lots.reduce((sum, lot) => {
      const lotCostCents = toCents(lot.remainingShares * lot.priceUsd * lot.fxBnaVendedorAtPurchase);
      return sum + lotCostCents;
    }, 0n);
    const avgCostPerShareCents = totalAvailable > 0
      ? BigInt(Math.round(Number(totalCostCents) / totalAvailable))
      : 0n;

    costBasisCents = avgCostPerShareCents * BigInt(Math.round(effectiveSharesToSell * 1e8)) / BigInt(1e8);

    for (const lot of sortedLots) {
      if (sharesRemaining <= 0) break;
      const sharesTaken = Math.min(lot.remainingShares, sharesRemaining);
      const lotCostCents = avgCostPerShareCents * BigInt(Math.round(sharesTaken * 1e8)) / BigInt(1e8);
      lotsConsumed.push({ lotId: lot.lotId, sharesTaken, costArs: fromCents(lotCostCents) });
      sharesRemaining -= sharesTaken;
    }
  } else {
    // FIFO: consumir lotes desde el más antiguo.
    for (const lot of sortedLots) {
      if (sharesRemaining <= 0) break;

      const sharesTaken = Math.min(lot.remainingShares, sharesRemaining);
      // Cost basis en ARS del lot = shares × priceUsd × TC vendedor al momento de compra.
      const lotCostCents = toCents(sharesTaken * lot.priceUsd * lot.fxBnaVendedorAtPurchase);
      costBasisCents += lotCostCents;
      lotsConsumed.push({ lotId: lot.lotId, sharesTaken, costArs: fromCents(lotCostCents) });
      sharesRemaining -= sharesTaken;
    }
  }

  const gainCents = proceedsCents - costBasisCents;
  const capitalGainArs = fromCents(gainCents);
  const capitalGainUsd = input.fxBnaVendedor > 0 ? capitalGainArs / input.fxBnaVendedor : 0;

  // Si hay pérdida (quebranto), el impuesto cedular es 0.
  // El quebranto es específico: solo compensa ganancias del mismo tipo (art. 132 LIG).
  let cedularTaxArs = 0;
  if (gainCents > 0n) {
    cedularTaxArs = fromCents(BigInt(Math.round(Number(gainCents) * CEDULAR_RATE)));
  } else {
    warnings.push(
      'Quebranto específico (art. 132 LIG): pérdida de capital en fuente extranjera, arrastrable 5 años. No genera impuesto cedular.',
    );
  }

  const netProceedsArs = fromCents(proceedsCents) - cedularTaxArs;
  const netProceedsUsd = input.fxBnaVendedor > 0 ? netProceedsArs / input.fxBnaVendedor : 0;

  return {
    capitalGainUsd,
    capitalGainArs,
    cedularTaxArs,
    netProceedsUsd,
    netProceedsArs,
    lotsConsumed,
    normaAplicada: NORMA,
    warnings,
  };
}
