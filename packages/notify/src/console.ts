// Adapter de consola. Útil para dev y `DRY_RUN=true`: imprime el mensaje
// formateado en stdout sin salir a la red.

import type { NotificationChannel, NotificationMessage } from './types.js';

export interface ConsoleChannelOptions {
  /** Por defecto imprime en stdout con `process.stdout.write`. */
  readonly writer?: (chunk: string) => void;
}

export class ConsoleChannel implements NotificationChannel {
  private readonly writer: (chunk: string) => void;

  constructor(options: ConsoleChannelOptions = {}) {
    this.writer = options.writer ?? ((chunk) => process.stdout.write(chunk));
  }

  async send(message: NotificationMessage): Promise<void> {
    const separator = '─'.repeat(60);
    this.writer(`\n${separator}\n`);
    this.writer(message.text);
    this.writer(`\n${separator}\n\n`);
  }
}
