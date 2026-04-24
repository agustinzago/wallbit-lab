// Errores tipados del motor fiscal.

export class TaxEngineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TaxEngineError';
  }
}

/** Período fiscal no cargado en las tablas del engine. */
export class UnsupportedPeriodError extends TaxEngineError {
  readonly period: number;

  constructor(period: number, resource: string) {
    super(`Período fiscal ${period} no cargado en ${resource}. Solo están disponibles: ver la tabla de reglas.`);
    this.name = 'UnsupportedPeriodError';
    this.period = period;
  }
}
