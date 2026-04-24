// Tests del ZombieHunter. Mockeamos TransactionPoller y MerchantClassifier
// con vi.fn() para no tocar la red. Los merchants comunes (NETFLIX, OPENAI,
// ANTHROPIC, SPOTIFY) los resolvemos con un classifier fake que devuelve
// MerchantInfo basado en el descriptor.

import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@wallbit-lab/sdk';
import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import type {
  ClassifierStats,
  MerchantClassifier,
  MerchantInfo,
} from '@wallbit-lab/merchant-classifier';
import { ZombieHunter } from './hunter.js';

const NOW = new Date('2026-04-23T12:00:00Z');

function makeTx(
  uuid: string,
  descriptor: string,
  amount: number,
  daysAgo: number,
): Transaction {
  const created = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return {
    uuid,
    type: 'CARD_SPENT',
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

// Classifier fake: devuelve MerchantInfo según reglas simples sobre el
// descriptor. Útil para probar la lógica de hunter sin llamar a Claude ni
// depender del diccionario real.
function fakeClassifier(): MerchantClassifier {
  const rules: Array<{ match: string; info: Omit<MerchantInfo, 'rawDescriptor'> }> = [
    {
      match: 'netflix',
      info: {
        normalizedName: 'Netflix',
        category: 'entertainment',
        isSaasSubscription: true,
        functionalGroup: 'video-streaming',
        confidence: 'high',
      },
    },
    {
      match: 'openai',
      info: {
        normalizedName: 'ChatGPT / OpenAI',
        category: 'ai_tools',
        isSaasSubscription: true,
        functionalGroup: 'ai-assistant',
        confidence: 'high',
      },
    },
    {
      match: 'anthropic',
      info: {
        normalizedName: 'Claude / Anthropic',
        category: 'ai_tools',
        isSaasSubscription: true,
        functionalGroup: 'ai-assistant',
        confidence: 'high',
      },
    },
    {
      match: 'spotify',
      info: {
        normalizedName: 'Spotify',
        category: 'entertainment',
        isSaasSubscription: true,
        functionalGroup: 'music-streaming',
        confidence: 'high',
      },
    },
    {
      match: 'github',
      info: {
        normalizedName: 'GitHub',
        category: 'development',
        isSaasSubscription: true,
        functionalGroup: 'code-hosting',
        confidence: 'high',
      },
    },
  ];

  const classify = vi.fn(async (descriptor: string): Promise<MerchantInfo> => {
    const lower = descriptor.toLowerCase();
    const rule = rules.find((r) => lower.includes(r.match));
    if (rule !== undefined) return { rawDescriptor: descriptor, ...rule.info };
    return {
      rawDescriptor: descriptor,
      normalizedName: descriptor,
      category: 'unknown',
      isSaasSubscription: false,
      confidence: 'low',
    };
  });

  const stats: ClassifierStats = {
    cacheHits: 0,
    dictionaryHits: 0,
    apiCalls: 0,
    apiFailures: 0,
  };

  return {
    classify,
    getStats: () => stats,
  } as unknown as MerchantClassifier;
}

function buildPoller(transactions: Transaction[]): TransactionPoller {
  return {
    fetchRecent: vi.fn().mockResolvedValue(transactions),
  } as unknown as TransactionPoller;
}

describe('ZombieHunter', () => {
  it('detecta silent_price_increase en Netflix ($15, $15, $17.99)', async () => {
    const txs = [
      makeTx('n1', 'NETFLIX', 15, 60),
      makeTx('n2', 'NETFLIX', 15, 30),
      makeTx('n3', 'NETFLIX', 17.99, 0),
    ];
    const hunter = new ZombieHunter({
      poller: buildPoller(txs),
      classifier: fakeClassifier(),
      analysisDays: 90,
      priceIncreaseThreshold: 8,
      now: () => NOW,
    });
    const result = await hunter.hunt();
    const z = result.zombies.find((z) => z.type === 'silent_price_increase');
    expect(z).toBeDefined();
    expect(z?.merchantInfo.normalizedName).toBe('Netflix');
    expect(z?.charge.priceIncreasePercent).toBeCloseTo(19.93, 1);
    expect(z?.annualCostUSD).toBeCloseTo(17.99 * 12, 1);
  });

  it('detecta functional_duplicate entre OPENAI y ANTHROPIC (ambos ai-assistant)', async () => {
    const txs = [
      // OpenAI mensual
      makeTx('o1', 'OPENAI', 20, 30),
      makeTx('o2', 'OPENAI', 20, 0),
      // Anthropic mensual
      makeTx('a1', 'ANTHROPIC', 20, 30),
      makeTx('a2', 'ANTHROPIC', 20, 0),
    ];
    const hunter = new ZombieHunter({
      poller: buildPoller(txs),
      classifier: fakeClassifier(),
      analysisDays: 30,
      priceIncreaseThreshold: 8,
      now: () => NOW,
    });
    const result = await hunter.hunt();
    const dups = result.zombies.filter((z) => z.type === 'functional_duplicate');
    expect(dups.length).toBe(2);
    const names = dups.map((d) => d.merchantInfo.normalizedName).sort();
    expect(names).toEqual(['ChatGPT / OpenAI', 'Claude / Anthropic']);
  });

  it('detecta potential_unused para Spotify sin cobros en > 45 días', async () => {
    // Cobros hace 90 y 60 días, ninguno reciente.
    const txs = [
      makeTx('s1', 'SPOTIFY', 9.99, 90),
      makeTx('s2', 'SPOTIFY', 9.99, 60),
    ];
    const hunter = new ZombieHunter({
      poller: buildPoller(txs),
      classifier: fakeClassifier(),
      analysisDays: 120,
      priceIncreaseThreshold: 8,
      now: () => NOW,
    });
    const result = await hunter.hunt();
    const unused = result.zombies.find((z) => z.type === 'potential_unused');
    expect(unused).toBeDefined();
    expect(unused?.merchantInfo.normalizedName).toBe('Spotify');
    expect(unused?.confidence).toBe('low');
  });

  it('no marca zombies cuando hay una suscripción regular sin aumento', async () => {
    const txs = [
      makeTx('g1', 'GITHUB', 10, 60),
      makeTx('g2', 'GITHUB', 10, 30),
      makeTx('g3', 'GITHUB', 10, 0),
    ];
    const hunter = new ZombieHunter({
      poller: buildPoller(txs),
      classifier: fakeClassifier(),
      analysisDays: 90,
      priceIncreaseThreshold: 8,
      now: () => NOW,
    });
    const result = await hunter.hunt();
    expect(result.zombies).toHaveLength(0);
    expect(result.totalSubscriptionsFound).toBe(1);
    expect(result.totalMonthlyUSD).toBe(10);
    expect(result.totalAnnualUSD).toBe(120);
  });

  it('computa potentialAnnualSavingsUSD como suma de annualCost de zombies', async () => {
    const txs = [
      makeTx('n1', 'NETFLIX', 10, 60),
      makeTx('n2', 'NETFLIX', 10, 30),
      makeTx('n3', 'NETFLIX', 15, 0), // +50%
    ];
    const hunter = new ZombieHunter({
      poller: buildPoller(txs),
      classifier: fakeClassifier(),
      analysisDays: 90,
      priceIncreaseThreshold: 8,
      now: () => NOW,
    });
    const result = await hunter.hunt();
    expect(result.potentialAnnualSavingsUSD).toBeCloseTo(15 * 12, 1);
  });
});
