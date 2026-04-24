// Tests del RecurrenceDetector. Probamos la lógica de agrupamiento (fuzzy por
// substring), clasificación de cadencia y detección de aumentos, sin tocar la
// API de Wallbit.

import { describe, expect, it } from 'vitest';
import type { Transaction } from '@wallbit-lab/sdk';
import { RecurrenceDetector } from './detector.js';

const NOW = new Date('2026-04-23T12:00:00Z');

function makeTx(
  uuid: string,
  descriptor: string,
  amount: number,
  daysAgo: number,
  type = 'CARD_SPENT',
): Transaction {
  const created = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return {
    uuid,
    type,
    external_address: descriptor,
    source_currency: { code: 'USD', alias: 'USD' },
    dest_currency: { code: 'USD', alias: 'USD' },
    source_amount: amount,
    dest_amount: amount,
    status: 'COMPLETED',
    created_at: created.toISOString(),
    comment: null,
  };
}

describe('RecurrenceDetector', () => {
  it('detecta cadencia mensual con 3 cobros separados por ~30 días', () => {
    const txs = [
      makeTx('n1', 'NETFLIX', 15.99, 0),
      makeTx('n2', 'NETFLIX', 15.99, 30),
      makeTx('n3', 'NETFLIX', 15.99, 60),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(1);
    expect(charges[0]!.cadence).toBe('monthly');
    expect(charges[0]!.occurrences).toHaveLength(3);
    expect(charges[0]!.hasPriceIncrease).toBe(false);
  });

  it('detecta cadencia anual con 2 cobros separados por ~365 días', () => {
    const txs = [
      makeTx('a1', 'JETBRAINS', 149, 365),
      makeTx('a2', 'JETBRAINS', 149, 0),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(1);
    expect(charges[0]!.cadence).toBe('annual');
  });

  it('detecta hasPriceIncrease cuando los montos son $10, $10, $13', () => {
    const txs = [
      makeTx('p1', 'OBSCURE SAAS', 10, 60),
      makeTx('p2', 'OBSCURE SAAS', 10, 30),
      makeTx('p3', 'OBSCURE SAAS', 13, 0),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(1);
    expect(charges[0]!.hasPriceIncrease).toBe(true);
    expect(charges[0]!.priceIncreasePercent).toBeCloseTo(30, 1);
  });

  it('agrupa descriptores "NETFLIX.COM" y "netflix" en el mismo RecurringCharge', () => {
    const txs = [
      makeTx('nf1', 'NETFLIX.COM', 15.99, 60),
      makeTx('nf2', 'netflix', 15.99, 30),
      makeTx('nf3', 'NETFLIX.COM', 15.99, 0),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(1);
    expect(charges[0]!.occurrences).toHaveLength(3);
  });

  it('filtra cargos irregulares sin aumento (ej. 3 compras en Amazon en fechas random)', () => {
    // Montos iguales en ambos extremos → priceIncrease = 0. Gaps de 7 y 8 días
    // → irregular. Amazon así no debe aparecer como zombie.
    const txs = [
      makeTx('am1', 'AMAZON MKTPLACE', 25, 3),
      makeTx('am2', 'AMAZON MKTPLACE', 40, 11),
      makeTx('am3', 'AMAZON MKTPLACE', 25, 18),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(0);
  });

  it('ignora transacciones que no son cargos (DEPOSIT, TRADE)', () => {
    const txs = [
      makeTx('d1', 'SALARY', 1000, 60, 'DEPOSIT'),
      makeTx('d2', 'SALARY', 1000, 30, 'DEPOSIT'),
      makeTx('t1', 'AAPL', 500, 15, 'TRADE'),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);
    expect(charges).toHaveLength(0);
  });

  it('ignora grupos con una sola ocurrencia', () => {
    const txs = [makeTx('once', 'ONETIME SVC', 99, 5)];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);
    expect(charges).toHaveLength(0);
  });

  it('calcula daysSinceLastCharge correctamente', () => {
    const txs = [
      makeTx('s1', 'SPOTIFY', 9.99, 90),
      makeTx('s2', 'SPOTIFY', 9.99, 60),
    ];
    const detector = new RecurrenceDetector({ now: () => NOW });
    const charges = detector.detect(txs);

    expect(charges).toHaveLength(1);
    expect(charges[0]!.daysSinceLastCharge).toBe(60);
  });
});
