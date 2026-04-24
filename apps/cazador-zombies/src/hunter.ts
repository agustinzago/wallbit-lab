// Núcleo del análisis de suscripciones. Orquesta tres pasos:
//  1. Recolectar: trae N días de transacciones y detecta patrones recurrentes.
//  2. Clasificar: para cada cargo recurrente, resuelve el MerchantInfo (cache →
//     diccionario → Claude Haiku). Se corre en batches de 5 para no saturar
//     Anthropic.
//  3. Cazar: convierte cada RecurringCharge enriquecido en uno o más Zombies
//     según tres reglas (aumento silencioso, duplicado funcional, posible no uso).

import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import type { MerchantClassifier, MerchantInfo } from '@wallbit-lab/merchant-classifier';
import type { RecurringCharge } from '@wallbit-lab/recurrence-engine';
import { RecurrenceDetector } from '@wallbit-lab/recurrence-engine';

export type ZombieType =
  | 'silent_price_increase'
  | 'functional_duplicate'
  | 'potential_unused';

export type ZombieConfidence = 'high' | 'medium' | 'low';

export interface Zombie {
  readonly type: ZombieType;
  readonly charge: RecurringCharge;
  readonly merchantInfo: MerchantInfo;
  readonly annualCostUSD: number;
  readonly duplicateOf?: string;
  readonly confidence: ZombieConfidence;
  readonly alertMessage: string;
}

export interface EnrichedCharge {
  readonly charge: RecurringCharge;
  readonly merchantInfo: MerchantInfo;
}

export interface HuntResult {
  readonly huntedAt: Date;
  readonly analyzedDays: number;
  readonly totalSubscriptionsFound: number;
  readonly totalMonthlyUSD: number;
  readonly totalAnnualUSD: number;
  readonly zombies: readonly Zombie[];
  readonly potentialAnnualSavingsUSD: number;
  readonly allCharges: readonly EnrichedCharge[];
  readonly classifierStats: {
    readonly cacheHits: number;
    readonly dictionaryHits: number;
    readonly apiCalls: number;
    readonly apiFailures: number;
  };
}

export interface ZombieHunterOptions {
  readonly poller: TransactionPoller;
  readonly classifier: MerchantClassifier;
  readonly analysisDays: number;
  readonly priceIncreaseThreshold: number;
  readonly now?: () => Date;
}

// Umbral de "saltó un ciclo": si el último cobro mensual fue hace más que esto,
// lo marcamos como potencialmente no usado.
const POTENTIAL_UNUSED_DAYS = 45;

// Tamaño de batch para las llamadas de clasificación. La API de Anthropic en
// tier gratuito tiene rate limits bajos; 5 es un compromiso razonable entre
// throughput y no saturar.
const CLASSIFICATION_BATCH_SIZE = 5;

export class ZombieHunter {
  private readonly poller: TransactionPoller;
  private readonly classifier: MerchantClassifier;
  private readonly analysisDays: number;
  private readonly priceIncreaseThreshold: number;
  private readonly now: () => Date;

  constructor(options: ZombieHunterOptions) {
    this.poller = options.poller;
    this.classifier = options.classifier;
    this.analysisDays = options.analysisDays;
    this.priceIncreaseThreshold = options.priceIncreaseThreshold;
    this.now = options.now ?? ((): Date => new Date());
  }

  async hunt(): Promise<HuntResult> {
    const transactions = await this.poller.fetchRecent({ days: this.analysisDays });
    const detector = new RecurrenceDetector({
      priceIncreaseThreshold: this.priceIncreaseThreshold,
      now: this.now,
    });
    const charges = detector.detect(transactions);

    const enriched = await this.classifyInBatches(charges);

    const zombies = this.findZombies(enriched);
    const totalMonthlyUSD = round2(
      enriched.reduce((acc, e) => acc + monthlyEquivalent(e.charge), 0),
    );
    const totalAnnualUSD = round2(totalMonthlyUSD * 12);
    const potentialAnnualSavingsUSD = round2(
      zombies.reduce((acc, z) => acc + z.annualCostUSD, 0),
    );

    const stats = this.classifier.getStats();

    return {
      huntedAt: this.now(),
      analyzedDays: this.analysisDays,
      totalSubscriptionsFound: enriched.length,
      totalMonthlyUSD,
      totalAnnualUSD,
      zombies,
      potentialAnnualSavingsUSD,
      allCharges: enriched,
      classifierStats: {
        cacheHits: stats.cacheHits,
        dictionaryHits: stats.dictionaryHits,
        apiCalls: stats.apiCalls,
        apiFailures: stats.apiFailures,
      },
    };
  }

  private async classifyInBatches(
    charges: readonly RecurringCharge[],
  ): Promise<EnrichedCharge[]> {
    const result: EnrichedCharge[] = [];
    for (let i = 0; i < charges.length; i += CLASSIFICATION_BATCH_SIZE) {
      const batch = charges.slice(i, i + CLASSIFICATION_BATCH_SIZE);
      const infos = await Promise.all(
        batch.map((c) => this.classifier.classify(c.merchantDescriptor)),
      );
      for (let j = 0; j < batch.length; j++) {
        result.push({ charge: batch[j]!, merchantInfo: infos[j]! });
      }
    }
    return result;
  }

  private findZombies(enriched: readonly EnrichedCharge[]): Zombie[] {
    const zombies: Zombie[] = [];
    const nowMs = this.now().getTime();

    // Regla a) aumento silencioso
    for (const e of enriched) {
      if (!e.charge.hasPriceIncrease) continue;
      const increase = e.charge.priceIncreasePercent ?? 0;
      const firstAmount = e.charge.occurrences[0]!.amount;
      zombies.push({
        type: 'silent_price_increase',
        charge: e.charge,
        merchantInfo: e.merchantInfo,
        annualCostUSD: round2(annualCost(e.charge)),
        confidence: 'high',
        alertMessage: `${e.merchantInfo.normalizedName} subió de USD ${fmt(firstAmount)} a USD ${fmt(e.charge.lastAmount)} (+${fmt(increase)}%).`,
      });
    }

    // Regla b) duplicados funcionales: grupos activos con ≥2 items y el mismo functionalGroup.
    const activeEnriched = enriched.filter((e) => {
      const daysSince = Math.floor((nowMs - e.charge.lastSeenAt.getTime()) / 86_400_000);
      return daysSince <= POTENTIAL_UNUSED_DAYS && e.merchantInfo.functionalGroup !== undefined;
    });

    const byGroup = new Map<string, EnrichedCharge[]>();
    for (const e of activeEnriched) {
      const g = e.merchantInfo.functionalGroup;
      if (g === undefined) continue;
      const list = byGroup.get(g) ?? [];
      list.push(e);
      byGroup.set(g, list);
    }

    for (const [group, items] of byGroup) {
      if (items.length < 2) continue;
      for (const self of items) {
        const others = items.filter((o) => o !== self);
        const otherNames = others.map((o) => o.merchantInfo.normalizedName).join(', ');
        zombies.push({
          type: 'functional_duplicate',
          charge: self.charge,
          merchantInfo: self.merchantInfo,
          annualCostUSD: round2(annualCost(self.charge)),
          duplicateOf: otherNames,
          confidence: 'medium',
          alertMessage: `${self.merchantInfo.normalizedName} y ${otherNames} pertenecen al mismo grupo funcional (${group}).`,
        });
      }
    }

    // Regla c) posible no usado: mensual cuyo último cobro es > POTENTIAL_UNUSED_DAYS.
    for (const e of enriched) {
      if (e.charge.cadence !== 'monthly') continue;
      const daysSince = Math.floor((nowMs - e.charge.lastSeenAt.getTime()) / 86_400_000);
      if (daysSince <= POTENTIAL_UNUSED_DAYS) continue;
      zombies.push({
        type: 'potential_unused',
        charge: e.charge,
        merchantInfo: e.merchantInfo,
        annualCostUSD: round2(annualCost(e.charge)),
        confidence: 'low',
        alertMessage: `${e.merchantInfo.normalizedName}: no detecté cobro en los últimos ${daysSince} días.`,
      });
    }

    return zombies;
  }
}

function annualCost(charge: RecurringCharge): number {
  if (charge.cadence === 'monthly') return charge.lastAmount * 12;
  if (charge.cadence === 'annual') return charge.lastAmount;
  return charge.averageAmount * 12;
}

function monthlyEquivalent(charge: RecurringCharge): number {
  if (charge.cadence === 'monthly') return charge.lastAmount;
  if (charge.cadence === 'annual') return charge.lastAmount / 12;
  return charge.averageAmount;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
