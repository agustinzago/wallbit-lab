// Config de cazador-zombies. Toda la configuración viene de variables de
// entorno y se valida con zod al arrancar. Si falta algo requerido, falla
// rápido con un mensaje útil.

import { z } from 'zod';

const BoolString = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((v) => v === 'true' || v === '1');

const NumString = z
  .string()
  .refine((v) => v.length > 0 && Number.isFinite(Number(v)), 'debe ser un número')
  .transform((v) => Number(v));

const ConfigSchema = z.object({
  WALLBIT_API_KEY: z.string().min(1, 'WALLBIT_API_KEY es requerido'),
  WALLBIT_API_BASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY es requerido'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN es requerido'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID es requerido'),
  ANALYSIS_DAYS: NumString.optional(),
  PRICE_INCREASE_THRESHOLD: NumString.optional(),
  DRY_RUN: BoolString.optional(),
});

export interface AppConfig {
  readonly wallbitApiKey: string;
  readonly wallbitBaseUrl: string | undefined;
  readonly geminiApiKey: string;
  readonly telegramBotToken: string;
  readonly telegramChatId: string;
  readonly analysisDays: number;
  readonly priceIncreaseThreshold: number;
  readonly dryRun: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse({
    WALLBIT_API_KEY: env['WALLBIT_API_KEY'],
    WALLBIT_API_BASE_URL: env['WALLBIT_API_BASE_URL'],
    GEMINI_API_KEY: env['GEMINI_API_KEY'],
    TELEGRAM_BOT_TOKEN: env['TELEGRAM_BOT_TOKEN'],
    TELEGRAM_CHAT_ID: env['TELEGRAM_CHAT_ID'],
    ANALYSIS_DAYS: env['ANALYSIS_DAYS'],
    PRICE_INCREASE_THRESHOLD: env['PRICE_INCREASE_THRESHOLD'],
    DRY_RUN: env['DRY_RUN'],
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new ConfigError(
      [
        'Config inválida. Revisá tus variables de entorno (copiá .env.example a .env y completá):',
        issues,
        '',
        'Requeridas: WALLBIT_API_KEY, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.',
      ].join('\n'),
    );
  }

  const data = parsed.data;
  return {
    wallbitApiKey: data.WALLBIT_API_KEY,
    wallbitBaseUrl: data.WALLBIT_API_BASE_URL,
    geminiApiKey: data.GEMINI_API_KEY,
    telegramBotToken: data.TELEGRAM_BOT_TOKEN,
    telegramChatId: data.TELEGRAM_CHAT_ID,
    analysisDays: data.ANALYSIS_DAYS ?? 90,
    priceIncreaseThreshold: data.PRICE_INCREASE_THRESHOLD ?? 8,
    dryRun: data.DRY_RUN ?? true,
  };
}
