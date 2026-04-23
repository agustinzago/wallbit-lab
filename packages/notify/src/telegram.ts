// Adapter de Telegram. Usa la Bot API vía fetch — sin SDK de terceros para
// mantener la dependencia superficial.
//
// Límite duro de Telegram: 4096 chars por mensaje. Si el texto lo supera, se parte
// en chunks respetando límites de línea cuando es posible.

import { z } from 'zod';
import { NotifyError } from './errors.js';
import type { Logger, NotificationChannel, NotificationMessage } from './types.js';

const TELEGRAM_MAX_LENGTH = 4096;
const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramChannelOptions {
  readonly botToken: string;
  readonly chatId: string;
  readonly logger?: Logger;
  /** Override del base URL. Principalmente para tests. */
  readonly baseUrl?: string;
}

// Respuesta mínima de `sendMessage`. La API devuelve más campos pero no los usamos.
const TelegramSendResponseSchema = z
  .object({
    ok: z.boolean(),
    description: z.string().optional(),
    error_code: z.number().optional(),
  })
  .passthrough();

export class TelegramChannel implements NotificationChannel {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly logger: Logger | undefined;
  private readonly baseUrl: string;

  constructor(options: TelegramChannelOptions) {
    if (options.botToken.length === 0) {
      throw new NotifyError('TelegramChannel: botToken vacío.');
    }
    if (options.chatId.length === 0) {
      throw new NotifyError('TelegramChannel: chatId vacío.');
    }
    this.botToken = options.botToken;
    this.chatId = options.chatId;
    this.logger = options.logger;
    this.baseUrl = options.baseUrl ?? TELEGRAM_API_BASE;
  }

  async send(message: NotificationMessage): Promise<void> {
    const chunks = splitForTelegram(message.text);
    for (const chunk of chunks) {
      await this.sendChunk(chunk, message.parseMode);
    }
  }

  private async sendChunk(text: string, parseMode: NotificationMessage['parseMode']): Promise<void> {
    const url = `${this.baseUrl}/bot${this.botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
      disable_web_page_preview: true,
    };
    if (parseMode !== undefined) body['parse_mode'] = parseMode;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger?.error('telegram: fallo de red al enviar', { err });
      throw new NotifyError('Fallo de red contactando a Telegram.', { cause: err });
    }

    const raw: unknown = await res.json().catch(() => ({}));
    const parsed = TelegramSendResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.ok) {
      const description = parsed.success ? parsed.data.description : undefined;
      const errorCode = parsed.success ? parsed.data.error_code : undefined;
      this.logger?.error('telegram: respuesta de error', {
        status: res.status,
        description,
        errorCode,
      });
      throw new NotifyError(
        `Telegram rechazó el mensaje (HTTP ${res.status}): ${description ?? 'sin detalle'}`,
        { statusCode: res.status },
      );
    }
  }
}

// Parte el texto en chunks <= 4096 chars. Prefiere cortar en un doble-newline,
// después en un newline, y por último en el límite duro.
export function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TELEGRAM_MAX_LENGTH) {
    const window = remaining.slice(0, TELEGRAM_MAX_LENGTH);
    let cut = window.lastIndexOf('\n\n');
    if (cut < TELEGRAM_MAX_LENGTH / 2) cut = window.lastIndexOf('\n');
    if (cut < TELEGRAM_MAX_LENGTH / 2) cut = TELEGRAM_MAX_LENGTH;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
