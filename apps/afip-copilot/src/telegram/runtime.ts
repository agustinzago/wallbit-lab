// TelegramRuntime — long-polling de getUpdates con persistencia de offset.
//
// El loop es resiliente a caídas de red: backoff exponencial (1s → 60s).
// Solo procesa mensajes del chat_id configurado (whitelist single-user).
// El offset se persiste en `telegram_offset` para sobrevivir reinicios.

import { eq } from 'drizzle-orm';
import { TelegramChannel, splitForTelegram } from '@wallbit-lab/notify';
import type { WallbitClient } from '@wallbit-lab/sdk';
import type { FxService } from '@wallbit-lab/fx-ars';
import type { Db } from '../db/client.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { telegramOffset } from '../db/schema.js';
import { dispatch } from './router.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const LONG_POLL_TIMEOUT_S = 30;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

export interface TelegramRuntimeOptions {
  readonly config: AppConfig;
  readonly db: Db;
  readonly fx: FxService;
  readonly wallbit: WallbitClient;
  readonly logger: Logger;
}

interface TelegramUpdate {
  readonly update_id: number;
  readonly message?: {
    readonly chat: { readonly id: number };
    readonly text?: string;
    readonly document?: {
      readonly file_id: string;
      readonly file_name?: string;
    };
    readonly message_id: number;
  };
}

export class TelegramRuntime {
  private stopped = false;
  private readonly channel: TelegramChannel;

  constructor(private readonly opts: TelegramRuntimeOptions) {
    this.channel = new TelegramChannel({
      botToken: opts.config.telegramBotToken,
      chatId: opts.config.telegramChatId,
      logger: opts.logger,
    });
  }

  stop(): void {
    this.stopped = true;
    this.opts.logger.info('telegram: runtime detenido por señal');
  }

  async run(): Promise<void> {
    this.opts.logger.info('telegram: iniciando loop de long-polling');
    let backoffMs = INITIAL_BACKOFF_MS;

    while (!this.stopped) {
      try {
        const offset = await this.getOffset();
        const updates = await this.fetchUpdates(offset);
        backoffMs = INITIAL_BACKOFF_MS; // reset backoff en éxito

        for (const update of updates) {
          await this.processUpdate(update);
          await this.saveOffset(update.update_id + 1);
        }
      } catch (err) {
        this.opts.logger.error('telegram: error en el loop, reintentando', {
          backoffMs,
          err: err instanceof Error ? err.message : String(err),
        });
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  }

  private async fetchUpdates(offset: number): Promise<TelegramUpdate[]> {
    const url = `${TELEGRAM_API_BASE}/bot${this.opts.config.telegramBotToken}/getUpdates`;
    const params = new URLSearchParams({
      offset: String(offset),
      timeout: String(LONG_POLL_TIMEOUT_S),
    });

    const res = await fetch(`${url}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`getUpdates falló: HTTP ${res.status}`);
    }

    const body = (await res.json()) as { ok: boolean; result?: TelegramUpdate[] };
    if (!body.ok) {
      throw new Error('getUpdates: respuesta ok=false de Telegram');
    }

    return body.result ?? [];
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg) return;

    const chatIdStr = String(msg.chat.id);
    if (chatIdStr !== this.opts.config.telegramChatId) {
      this.opts.logger.warn('telegram: mensaje de chat no autorizado descartado', {
        chatId: chatIdStr,
      });
      return;
    }

    const text = msg.text;
    if (!text) {
      // Mensajes sin texto (documentos, stickers, etc.) los ignoramos en fase 1.
      // Fase 4 los maneja para /import_cost_basis.
      return;
    }

    this.opts.logger.debug('telegram: procesando mensaje', { text: text.slice(0, 50) });

    let response: string;
    try {
      response = await dispatch(text, {
        args: [],
        rawText: text,
        db: this.opts.db,
        fx: this.opts.fx,
        config: this.opts.config,
        wallbit: this.opts.wallbit,
        logger: this.opts.logger,
      });
    } catch (err) {
      this.opts.logger.error('telegram: error procesando comando', {
        text: text.slice(0, 50),
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      response = '❌ Fallé procesando tu comando. Revisá los logs.';
    }

    for (const chunk of splitForTelegram(response)) {
      await this.channel.send({ text: chunk, parseMode: 'Markdown' });
    }
  }

  private async getOffset(): Promise<number> {
    const rows = await this.opts.db
      .select()
      .from(telegramOffset)
      .where(eq(telegramOffset.id, 1))
      .limit(1);

    return rows[0]?.lastUpdateId ?? 0;
  }

  private async saveOffset(updateId: number): Promise<void> {
    await this.opts.db
      .insert(telegramOffset)
      .values({ id: 1, lastUpdateId: updateId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: telegramOffset.id,
        set: { lastUpdateId: updateId, updatedAt: new Date() },
      });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
