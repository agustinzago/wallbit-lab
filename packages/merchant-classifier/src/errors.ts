// Error base del merchant-classifier. No se lanza fuera del package: la política
// es devolver un MerchantInfo de baja confianza ante fallos de clasificación
// para no romper el flujo del caller. Esta clase queda disponible por si en el
// futuro queremos propagar causas específicas.

export class MerchantClassifierError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MerchantClassifierError';
  }
}
