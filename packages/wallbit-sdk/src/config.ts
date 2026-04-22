// Resolución de la config del cliente. Centraliza defaults y validación básica
// de la API key en un único punto.

export interface WallbitClientConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
}

export interface ResolvedConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeout: number;
}

const DEFAULT_BASE_URL = 'https://api.wallbit.io';
const DEFAULT_TIMEOUT_MS = 15_000;

export function resolveConfig(config: WallbitClientConfig): ResolvedConfig {
  if (typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
    throw new Error('WallbitClient: `apiKey` es requerido y debe ser un string no vacío.');
  }
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
  return { apiKey: config.apiKey, baseUrl, timeout };
}
