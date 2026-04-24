// Tests del MerchantClassifier. El mock de generateContent es una función
// simple (string) => Promise<string>, sin dependencia de ningún SDK externo.

import { describe, expect, it, vi } from 'vitest';
import { MerchantClassifier } from './classifier.js';

function fakeGenerate(
  response: string,
): { fn: (prompt: string) => Promise<string>; mock: ReturnType<typeof vi.fn> } {
  const mock = vi.fn().mockResolvedValue(response);
  return { fn: mock as (prompt: string) => Promise<string>, mock };
}

function fakeJson(obj: object): string {
  return JSON.stringify(obj);
}

describe('MerchantClassifier', () => {
  it('resuelve "NETFLIX.COM" desde el diccionario sin llamar a la API', async () => {
    const { fn, mock } = fakeGenerate('');
    const classifier = new MerchantClassifier({ geminiApiKey: 'test', generateContent: fn });

    const info = await classifier.classify('NETFLIX.COM');

    expect(info.normalizedName).toBe('Netflix');
    expect(info.category).toBe('entertainment');
    expect(info.functionalGroup).toBe('video-streaming');
    expect(info.confidence).toBe('high');
    expect(mock).not.toHaveBeenCalled();

    const stats = classifier.getStats();
    expect(stats.dictionaryHits).toBe(1);
    expect(stats.apiCalls).toBe(0);
  });

  it('cachea el segundo lookup del mismo descriptor', async () => {
    const { fn } = fakeGenerate('');
    const classifier = new MerchantClassifier({ geminiApiKey: 'test', generateContent: fn });

    await classifier.classify('SPOTIFY');
    await classifier.classify('SPOTIFY');

    const stats = classifier.getStats();
    expect(stats.dictionaryHits).toBe(1);
    expect(stats.cacheHits).toBe(1);
  });

  it('llama a Gemini cuando el descriptor no está en el diccionario', async () => {
    const { fn, mock } = fakeGenerate(
      fakeJson({
        normalizedName: 'Raycast Pro',
        category: 'productivity',
        isSaasSubscription: true,
        functionalGroup: 'launcher',
        confidence: 'high',
      }),
    );
    const classifier = new MerchantClassifier({ geminiApiKey: 'test', generateContent: fn });

    const info = await classifier.classify('RAYCAST*PRO');

    expect(mock).toHaveBeenCalledTimes(1);
    expect(info.normalizedName).toBe('Raycast Pro');
    expect(info.category).toBe('productivity');
    expect(info.functionalGroup).toBe('launcher');
  });

  it('devuelve fallback con category=unknown cuando la API falla', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    const classifier = new MerchantClassifier({
      geminiApiKey: 'test',
      generateContent: fn as (prompt: string) => Promise<string>,
    });

    const info = await classifier.classify('WEIRD*DESCRIPTOR');

    expect(info.category).toBe('unknown');
    expect(info.confidence).toBe('low');
    expect(info.isSaasSubscription).toBe(false);
    expect(classifier.getStats().apiFailures).toBe(1);
  });
});
