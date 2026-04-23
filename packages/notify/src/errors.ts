// Errores del package notify. Se exponen como clase identificable para que los
// consumidores puedan discriminar fallas de envío de fallas de otra naturaleza.

export interface NotifyErrorOptions {
  readonly cause?: unknown;
  readonly statusCode?: number;
}

export class NotifyError extends Error {
  readonly statusCode: number | undefined;

  constructor(message: string, options: NotifyErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'NotifyError';
    this.statusCode = options.statusCode;
  }
}
