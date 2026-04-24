// Config de afip-copilot. Toda la configuración viene de variables de entorno
// y se valida con zod al arrancar. Si falta algo requerido, falla rápido con
// un mensaje útil.

import { z } from 'zod';

const BoolString = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((v) => v === 'true' || v === '1');

const NumString = z
  .string()
  .refine((v) => v.length > 0 && Number.isFinite(Number(v)), 'debe ser un número')
  .transform((v) => Number(v));

// Como NumString pero acepta string vacío devolviéndolo como undefined.
// Útil para campos numéricos opcionales que en el .env se dejan en blanco.
const OptNumString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v))
  .pipe(z.string().refine((v) => Number.isFinite(Number(v)), 'debe ser un número').transform(Number).optional());

const ConfigSchema = z.object({
  WALLBIT_API_KEY: z.string().min(1, 'WALLBIT_API_KEY es requerido'),
  WALLBIT_API_BASE_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN es requerido'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID es requerido'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  FISCAL_YEAR: NumString.optional(),
  CONTRIBUYENTE_CUMPLIDOR: BoolString.optional(),
  REIBP_ADHERIDO: BoolString.optional(),
  COST_BASIS_METHOD: z.enum(['FIFO', 'weighted_average']).optional(),
  DRY_RUN: BoolString.optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  // Activos argentinos opcionales (exentos de BP). Vacío en .env equivale a no configurado.
  CASH_AR_BANK_ARS: OptNumString,
  TITULOS_PUBLICOS_AR_ARS: OptNumString,
  // Tipos de transacción que se clasifican como dividendo.
  DIVIDEND_TX_TYPES: z.string().optional(),
  // Datos del contribuyente para el export.
  TAXPAYER_NAME: z.string().optional(),
  TAXPAYER_CUIT: z.string().optional(),
});

export interface AppConfig {
  readonly wallbitApiKey: string;
  readonly wallbitBaseUrl: string | undefined;
  readonly telegramBotToken: string;
  readonly telegramChatId: string;
  readonly databaseUrl: string;
  readonly fiscalYear: number;
  readonly contribuyenteCumplidor: boolean;
  readonly reibpAdherido: boolean;
  readonly costBasisMethod: 'FIFO' | 'weighted_average';
  readonly dryRun: boolean;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly cashArBankArs: number | undefined;
  readonly titulosPublicosArArs: number | undefined;
  readonly dividendTxTypes: readonly string[];
  readonly taxpayerName: string | undefined;
  readonly taxpayerCuit: string | undefined;
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
    TELEGRAM_BOT_TOKEN: env['TELEGRAM_BOT_TOKEN'],
    TELEGRAM_CHAT_ID: env['TELEGRAM_CHAT_ID'],
    DATABASE_URL: env['DATABASE_URL'],
    FISCAL_YEAR: env['FISCAL_YEAR'],
    CONTRIBUYENTE_CUMPLIDOR: env['CONTRIBUYENTE_CUMPLIDOR'],
    REIBP_ADHERIDO: env['REIBP_ADHERIDO'],
    COST_BASIS_METHOD: env['COST_BASIS_METHOD'],
    DRY_RUN: env['DRY_RUN'],
    LOG_LEVEL: env['LOG_LEVEL'],
    CASH_AR_BANK_ARS: env['CASH_AR_BANK_ARS'],
    TITULOS_PUBLICOS_AR_ARS: env['TITULOS_PUBLICOS_AR_ARS'],
    DIVIDEND_TX_TYPES: env['DIVIDEND_TX_TYPES'],
    TAXPAYER_NAME: env['TAXPAYER_NAME'],
    TAXPAYER_CUIT: env['TAXPAYER_CUIT'],
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
        'Requeridas: WALLBIT_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DATABASE_URL.',
      ].join('\n'),
    );
  }

  const data = parsed.data;

  const fiscalYear = data.FISCAL_YEAR ?? 2025;
  if (fiscalYear < 2023 || fiscalYear > 2030) {
    throw new ConfigError(
      `FISCAL_YEAR debe estar entre 2023 y 2030 (recibido: ${fiscalYear}).`,
    );
  }

  return {
    wallbitApiKey: data.WALLBIT_API_KEY,
    wallbitBaseUrl: data.WALLBIT_API_BASE_URL,
    telegramBotToken: data.TELEGRAM_BOT_TOKEN,
    telegramChatId: data.TELEGRAM_CHAT_ID,
    databaseUrl: data.DATABASE_URL,
    fiscalYear,
    contribuyenteCumplidor: data.CONTRIBUYENTE_CUMPLIDOR ?? false,
    reibpAdherido: data.REIBP_ADHERIDO ?? false,
    costBasisMethod: data.COST_BASIS_METHOD ?? 'FIFO',
    dryRun: data.DRY_RUN ?? true,
    logLevel: data.LOG_LEVEL ?? 'info',
    cashArBankArs: data.CASH_AR_BANK_ARS,
    titulosPublicosArArs: data.TITULOS_PUBLICOS_AR_ARS,
    dividendTxTypes: data.DIVIDEND_TX_TYPES
      ? data.DIVIDEND_TX_TYPES.split(',').map((s) => s.trim()).filter(Boolean)
      : ['DIVIDEND'],
    taxpayerName: data.TAXPAYER_NAME,
    taxpayerCuit: data.TAXPAYER_CUIT,
  };
}
