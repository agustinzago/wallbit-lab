// MerchantClassifier: dado un descriptor crudo (ej. "CLOUDFLR*WORKERS"), devuelve
// un MerchantInfo con nombre legible, categoría y grupo funcional para detectar
// duplicados.
//
// Estrategia de tres capas, en orden:
//  1. Cache en memoria (Map<descriptor, MerchantInfo>) — idempotente por sesión.
//  2. Diccionario hardcodeado — cubre merchants comunes sin consumir tokens.
//  3. Gemini Flash — fallback para descriptores desconocidos. Si falla, devolvemos
//     un MerchantInfo de baja confianza con category 'unknown' (no throw).
//
// El contador de llamadas reales al modelo se expone con `getStats()` para que la
// app pueda loguear cuánto costó el análisis en tokens.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { lookupMerchant } from './dictionary.js';
import type { Logger, MerchantInfo, ServiceCategory } from './types.js';

const GEMINI_MODEL = 'gemini-2.0-flash';

const VALID_CATEGORIES: readonly ServiceCategory[] = [
  'productivity',
  'ai_tools',
  'cloud_storage',
  'entertainment',
  'development',
  'design',
  'communication',
  'security',
  'finance',
  'unknown',
];

const ClassificationResponseSchema = z.object({
  normalizedName: z.string().min(1),
  category: z.string(),
  isSaasSubscription: z.union([z.boolean(), z.string()]),
  functionalGroup: z.string().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

export interface MerchantClassifierOptions {
  readonly geminiApiKey: string;
  readonly logger?: Logger;
  readonly model?: string;
  // Inyectable para tests: reemplaza la llamada real a Gemini con una función
  // simple (prompt: string) => Promise<string>. Sin dependencia del SDK en tests.
  readonly generateContent?: (prompt: string) => Promise<string>;
}

export interface ClassifierStats {
  readonly cacheHits: number;
  readonly dictionaryHits: number;
  readonly apiCalls: number;
  readonly apiFailures: number;
}

export class MerchantClassifier {
  private readonly generateContent: (prompt: string) => Promise<string>;
  private readonly logger: Logger | undefined;
  private readonly cache = new Map<string, MerchantInfo>();
  private cacheHits = 0;
  private dictionaryHits = 0;
  private apiCalls = 0;
  private apiFailures = 0;

  constructor(options: MerchantClassifierOptions) {
    this.logger = options.logger;

    if (options.generateContent !== undefined) {
      this.generateContent = options.generateContent;
    } else {
      const genAI = new GoogleGenerativeAI(options.geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: options.model ?? GEMINI_MODEL,
      });
      this.generateContent = async (prompt: string): Promise<string> => {
        const result = await geminiModel.generateContent(prompt);
        return result.response.text();
      };
    }
  }

  async classify(descriptor: string): Promise<MerchantInfo> {
    const key = descriptor.trim();

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.cacheHits += 1;
      return cached;
    }

    const dictEntry = lookupMerchant(key);
    if (dictEntry !== undefined) {
      this.dictionaryHits += 1;
      const info: MerchantInfo = {
        rawDescriptor: key,
        ...dictEntry,
        confidence: 'high',
      };
      this.cache.set(key, info);
      return info;
    }

    const info = await this.classifyWithGemini(key);
    this.cache.set(key, info);
    return info;
  }

  getStats(): ClassifierStats {
    return {
      cacheHits: this.cacheHits,
      dictionaryHits: this.dictionaryHits,
      apiCalls: this.apiCalls,
      apiFailures: this.apiFailures,
    };
  }

  private async classifyWithGemini(descriptor: string): Promise<MerchantInfo> {
    this.apiCalls += 1;
    try {
      const text = await this.generateContent(buildPrompt(descriptor));
      const parsed = parseClassification(text);

      const info: MerchantInfo = {
        rawDescriptor: descriptor,
        normalizedName: parsed.normalizedName,
        category: normalizeCategory(parsed.category),
        isSaasSubscription: coerceBool(parsed.isSaasSubscription),
        ...(parsed.functionalGroup !== undefined && parsed.functionalGroup !== null
          ? { functionalGroup: parsed.functionalGroup }
          : {}),
        confidence: parsed.confidence ?? 'medium',
      };
      return info;
    } catch (err) {
      this.apiFailures += 1;
      this.logger?.warn('merchant-classifier: clasificación vía Gemini falló', {
        descriptor,
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        rawDescriptor: descriptor,
        normalizedName: descriptor,
        category: 'unknown',
        isSaasSubscription: false,
        confidence: 'low',
      };
    }
  }
}

function buildPrompt(descriptor: string): string {
  return [
    'You are a payment descriptor classifier. Given a raw payment descriptor from a bank transaction, identify the service.',
    '',
    `Descriptor: "${descriptor}"`,
    '',
    'Respond ONLY with a JSON object, no markdown, no explanation:',
    '{',
    '  "normalizedName": "Human readable service name",',
    '  "category": "one of: productivity|ai_tools|cloud_storage|entertainment|development|design|communication|security|finance|unknown",',
    '  "isSaasSubscription": true or false,',
    '  "functionalGroup": "short slug like note-taking, ai-assistant, vpn, music-streaming or null if not applicable",',
    '  "confidence": "high|medium|low"',
    '}',
  ].join('\n');
}

function parseClassification(raw: string): z.infer<typeof ClassificationResponseSchema> {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const json: unknown = JSON.parse(stripped);
  return ClassificationResponseSchema.parse(json);
}

function normalizeCategory(raw: string): ServiceCategory {
  const lower = raw.toLowerCase();
  return (VALID_CATEGORIES as readonly string[]).includes(lower)
    ? (lower as ServiceCategory)
    : 'unknown';
}

function coerceBool(raw: boolean | string): boolean {
  if (typeof raw === 'boolean') return raw;
  return raw.toLowerCase() === 'true';
}
