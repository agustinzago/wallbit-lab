// RecurrenceDetector: dado un conjunto de transacciones, detecta cargos
// recurrentes agrupando por descriptor (con fuzzy simple) y clasificando la
// cadencia por mediana de días entre cobros.
//
// Diseño intencional:
// - Fuzzy basado en substring (a.includes(b) con guard de longitud mínima) en
//   lugar de Levenshtein/n-gram. Los descriptores de tarjeta son caóticos pero
//   el ruido típico es "NETFLIX.COM" vs "NETFLIX" vs "NETFLIX*EU", que este
//   match ya cubre. Un algoritmo más sofisticado se paga con falsos positivos.
// - Mediana (no promedio) de gap para cadencia: un cargo fallido y re-intentado
//   puede dejar un gap anómalo de 3 días que corrompe el promedio.
// - Irregulares sin aumento se descartan: son compras repetidas normales
//   (Uber, Amazon) y no lo que el producto quiere alertar.

import type { Transaction } from '@wallbit-lab/sdk';
import type { RecurrenceCadence, RecurringCharge, TransactionOccurrence } from './types.js';

const DEFAULT_PRICE_INCREASE_THRESHOLD = 8;

const MONTHLY_MIN_GAP_DAYS = 25;
const MONTHLY_MAX_GAP_DAYS = 35;
const ANNUAL_MIN_GAP_DAYS = 340;
const ANNUAL_MAX_GAP_DAYS = 390;

// Guard para que el fuzzy no agrupe descriptors por matches triviales tipo
// "FEE" o "TRF". Por debajo de 5 chars exigimos match exacto.
const FUZZY_MIN_LENGTH = 5;

// Stablecoins y USD que tratamos 1:1 en reporting. Otras monedas se ignoran
// por ahora (señal débil, riesgo de mezclar ARS con USD).
const USD_LIKE = new Set(['USD', 'USDT', 'USDC']);

// Tipos de transacción que consideramos "cargos" candidatos a recurrencia.
// Incluimos WITHDRAWAL_* por si el usuario paga suscripciones via transferencia
// recurrente (ej. servicios locales). Excluimos DEPOSIT, TRADE, REWARD, etc.
function isChargeType(type: string): boolean {
  const t = type.toUpperCase();
  if (t === 'CARD_SPENT') return true;
  if (t.includes('CARD_PAYMENT') || t.includes('CARD_PURCHASE')) return true;
  if (t.startsWith('WITHDRAWAL')) return true;
  if (t === 'FEE') return true;
  return false;
}

// Devuelve el descriptor legible preferido. `merchantName` gana cuando la API lo
// expone; en su defecto usamos `external_address`. Si nada está seteado, usamos
// el tipo como último recurso para no descartar la transacción en silencio.
function extractDescriptor(tx: Transaction): string | null {
  const merchantName = (tx as { merchantName?: string | null }).merchantName;
  if (typeof merchantName === 'string' && merchantName.trim().length > 0) {
    return merchantName.trim();
  }
  if (typeof tx.external_address === 'string' && tx.external_address.trim().length > 0) {
    return tx.external_address.trim();
  }
  return null;
}

export interface RecurrenceDetectorOptions {
  readonly priceIncreaseThreshold?: number;
  readonly now?: () => Date;
}

export class RecurrenceDetector {
  private readonly priceIncreaseThreshold: number;
  private readonly now: () => Date;

  constructor(options: RecurrenceDetectorOptions = {}) {
    this.priceIncreaseThreshold =
      options.priceIncreaseThreshold ?? DEFAULT_PRICE_INCREASE_THRESHOLD;
    this.now = options.now ?? ((): Date => new Date());
  }

  detect(transactions: readonly Transaction[]): RecurringCharge[] {
    const occurrencesByGroup = this.groupByDescriptor(transactions);
    const nowMs = this.now().getTime();

    const charges: RecurringCharge[] = [];
    for (const group of occurrencesByGroup.values()) {
      if (group.occurrences.length < 2) continue;

      const sorted = [...group.occurrences].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const cadence = detectCadence(sorted);

      const firstAmount = sorted[0]!.amount;
      const lastAmount = sorted[sorted.length - 1]!.amount;
      const averageAmount =
        sorted.reduce((acc, o) => acc + o.amount, 0) / sorted.length;

      const priceIncreasePercent =
        firstAmount > 0 ? ((lastAmount - firstAmount) / firstAmount) * 100 : undefined;
      const hasPriceIncrease =
        priceIncreasePercent !== undefined &&
        priceIncreasePercent > this.priceIncreaseThreshold;

      // Filtramos irregulares sin aumento: no son zombies, son compras repetidas.
      if (cadence === 'irregular' && !hasPriceIncrease) continue;

      const lastSeenAt = sorted[sorted.length - 1]!.date;
      const daysSinceLastCharge = Math.floor(
        (nowMs - lastSeenAt.getTime()) / 86_400_000,
      );

      charges.push({
        merchantDescriptor: group.canonicalDescriptor,
        rawDescriptor: group.canonicalDescriptor,
        cadence,
        occurrences: sorted,
        averageAmount: round2(averageAmount),
        lastAmount: round2(lastAmount),
        firstSeenAt: sorted[0]!.date,
        lastSeenAt,
        ...(priceIncreasePercent !== undefined
          ? { priceIncreasePercent: round2(priceIncreasePercent) }
          : {}),
        hasPriceIncrease,
        daysSinceLastCharge,
      });
    }

    // Orden estable: primero los de mayor monto promedio. Ayuda a que el consumer
    // priorice visualmente los cargos más caros.
    return charges.sort((a, b) => b.averageAmount - a.averageAmount);
  }

  private groupByDescriptor(
    transactions: readonly Transaction[],
  ): Map<string, { canonicalDescriptor: string; occurrences: TransactionOccurrence[] }> {
    const groups = new Map<
      string,
      { canonicalDescriptor: string; occurrences: TransactionOccurrence[] }
    >();

    for (const tx of transactions) {
      if (!isChargeType(tx.type)) continue;
      const descriptor = extractDescriptor(tx);
      if (descriptor === null) continue;
      const currency = tx.source_currency.code;
      if (!USD_LIKE.has(currency)) continue;

      const amount = Math.abs(tx.source_amount);
      if (amount <= 0) continue;

      const date = new Date(tx.created_at);
      if (Number.isNaN(date.getTime())) continue;

      const occurrence: TransactionOccurrence = {
        transactionId: tx.uuid,
        date,
        amount,
        currency,
      };

      const existingKey = findMatchingKey(groups, descriptor);
      if (existingKey !== null) {
        groups.get(existingKey)!.occurrences.push(occurrence);
      } else {
        groups.set(descriptor.toLowerCase(), {
          canonicalDescriptor: descriptor,
          occurrences: [occurrence],
        });
      }
    }

    return groups;
  }
}

// Busca una key existente que matchee fuzzy con `descriptor`. El match es
// case-insensitive, y si ambos strings son >= FUZZY_MIN_LENGTH, admite que uno
// contenga al otro. Devuelve null si no hay match.
function findMatchingKey(
  groups: Map<string, { canonicalDescriptor: string; occurrences: TransactionOccurrence[] }>,
  descriptor: string,
): string | null {
  const lower = descriptor.toLowerCase();
  if (groups.has(lower)) return lower;

  for (const key of groups.keys()) {
    if (key === lower) return key;
    const shorter = key.length < lower.length ? key : lower;
    const longer = key.length < lower.length ? lower : key;
    if (shorter.length < FUZZY_MIN_LENGTH) continue;
    if (longer.includes(shorter)) return key;
  }
  return null;
}

function detectCadence(sorted: readonly TransactionOccurrence[]): RecurrenceCadence {
  if (sorted.length < 2) return 'irregular';

  const gapsDays: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i]!.date.getTime() - sorted[i - 1]!.date.getTime();
    gapsDays.push(gapMs / 86_400_000);
  }

  const median = medianOf(gapsDays);

  if (median >= MONTHLY_MIN_GAP_DAYS && median <= MONTHLY_MAX_GAP_DAYS) return 'monthly';

  // Anual: sólo si hay 1-2 gaps (es decir, 2-3 ocurrencias) y todos caen en ventana anual.
  if (gapsDays.length <= 2 && gapsDays.every((g) => g >= ANNUAL_MIN_GAP_DAYS && g <= ANNUAL_MAX_GAP_DAYS)) {
    return 'annual';
  }

  return 'irregular';
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
