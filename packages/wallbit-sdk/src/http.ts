// Wrapper sobre fetch con retry exponencial, timeout via AbortController, parse
// tipado de errores por status code y validación de responses con zod.

import { z } from 'zod';
import type { ResolvedConfig } from './config.js';
import {
  WallbitAuthError,
  WallbitError,
  WallbitKycError,
  WallbitNetworkError,
  WallbitRateLimitError,
  WallbitServerError,
  WallbitValidationError,
} from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<S extends z.ZodTypeAny> {
  readonly method?: HttpMethod;
  readonly path: string;
  readonly query?: Record<string, string | number | undefined>;
  readonly body?: unknown;
  readonly schema: S;
  readonly signal?: AbortSignal;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export class HttpClient {
  constructor(private readonly config: ResolvedConfig) {}

  async request<S extends z.ZodTypeAny>(opts: RequestOptions<S>): Promise<z.infer<S>> {
    const url = this.buildUrl(opts.path, opts.query);
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const forwardAbort = (): void => controller.abort();
      if (opts.signal) {
        if (opts.signal.aborted) controller.abort();
        else opts.signal.addEventListener('abort', forwardAbort, { once: true });
      }

      try {
        const res = await fetch(url, {
          method: opts.method ?? 'GET',
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
          signal: controller.signal,
        });

        this.logRateLimit(res);
        const requestIdHeader = res.headers.get('X-Request-Id');
        const requestId = requestIdHeader !== null ? requestIdHeader : undefined;

        if (res.status === 401 || res.status === 403) {
          throw new WallbitAuthError(`Autenticación falló (HTTP ${res.status}).`, {
            statusCode: res.status,
            requestId,
          });
        }
        if (res.status === 412) {
          throw new WallbitKycError('KYC pendiente o incompleto (HTTP 412).', {
            statusCode: 412,
            requestId,
          });
        }
        if (res.status === 422) {
          const detail = await safeText(res);
          throw new WallbitValidationError(`Request inválida (HTTP 422): ${detail}`, {
            statusCode: 422,
            requestId,
          });
        }
        if (res.status === 429) {
          throw new WallbitRateLimitError('Rate limit alcanzado (HTTP 429).', {
            statusCode: 429,
            requestId,
          });
        }
        if (res.status >= 500) {
          throw new WallbitServerError(`Error del servidor (HTTP ${res.status}).`, {
            statusCode: res.status,
            requestId,
          });
        }
        if (!res.ok) {
          const detail = await safeText(res);
          throw new WallbitError(`HTTP ${res.status}: ${detail}`, {
            statusCode: res.status,
            requestId,
          });
        }

        const json: unknown = await res.json();
        const parsed = opts.schema.safeParse(json);
        if (!parsed.success) {
          throw new WallbitValidationError(
            'La respuesta de la API no matchea el schema esperado.',
            { cause: parsed.error, requestId },
          );
        }
        return parsed.data as z.infer<S>;
      } catch (err) {
        lastError = err;
        const canRetry = isRetryable(err) && attempt < MAX_RETRIES - 1;
        if (!canRetry) {
          if (err instanceof WallbitError) throw err;
          if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
            throw new WallbitNetworkError('Timeout o abort de la request.', { cause: err });
          }
          throw new WallbitNetworkError(
            err instanceof Error ? err.message : 'Error de red desconocido.',
            { cause: err },
          );
        }
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      } finally {
        clearTimeout(timeoutId);
        if (opts.signal) opts.signal.removeEventListener('abort', forwardAbort);
      }
    }

    // Inalcanzable en la práctica: el for sale por return o throw.
    throw lastError instanceof Error ? lastError : new WallbitNetworkError('Retries agotados.');
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.config.baseUrl}${normalized}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private logRateLimit(res: Response): void {
    // Logging opcional controlado por LOG_LEVEL. Mantengo esto minimal a propósito;
    // cuando tengamos un logger inyectable lo cableamos acá.
    if (process.env['LOG_LEVEL'] !== 'debug') return;
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const reset = res.headers.get('X-RateLimit-Reset');
    if (remaining !== null || reset !== null) {
      // eslint-disable-next-line no-console
      console.debug(`[wallbit-sdk] rate-limit remaining=${remaining} reset=${reset}`);
    }
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof WallbitRateLimitError) return true;
  if (err instanceof WallbitServerError) return true;
  // fetch() tira TypeError ante fallos de red en Node/undici.
  if (err instanceof TypeError) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<cuerpo ilegible>';
  }
}
