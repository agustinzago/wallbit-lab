// Errores tipados de fx-ars.

export class FxError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FxError';
  }
}

/** No existe cotización ni en cache ni en ninguna fuente disponible. */
export class FxNotFoundError extends FxError {
  readonly date: string;
  readonly side: string;

  constructor(date: string, side: string, options?: ErrorOptions) {
    super(`No se encontró cotización BNA divisa para ${date} (lado: ${side}).`, options);
    this.name = 'FxNotFoundError';
    this.date = date;
    this.side = side;
  }
}

/** La fuente externa (BCRA o BNA) falló al intentar obtener la cotización. */
export class FxSourceError extends FxError {
  readonly source: string;

  constructor(source: string, message: string, options?: ErrorOptions) {
    super(`FX source "${source}" error: ${message}`, options);
    this.name = 'FxSourceError';
    this.source = source;
  }
}
