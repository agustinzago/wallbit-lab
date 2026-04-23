// Interfaz pública de canales de notificación. Cada adapter concreto (Telegram,
// consola, etc.) implementa `NotificationChannel` para que las apps puedan componer
// canales en runtime sin conocer el transporte.

export type ParseMode = 'Markdown' | 'HTML';

export interface NotificationMessage {
  /** Texto plano o con formato (Markdown/HTML según `parseMode`). */
  readonly text: string;
  readonly parseMode?: ParseMode;
}

export interface NotificationChannel {
  send(message: NotificationMessage): Promise<void>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
