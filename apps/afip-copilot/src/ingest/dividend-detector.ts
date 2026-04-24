// Detector de dividendos dentro del stream de transacciones de Wallbit.
// El tipo exacto de transacción para dividendos no está documentado en la spec
// pública — se configura via DIVIDEND_TX_TYPES y se ajusta post-sonda.

import type { Transaction } from '@wallbit-lab/sdk';

export interface DividendDetectorConfig {
  /** Valores de Transaction.type que clasifican como dividendo. Default: ['DIVIDEND'] */
  readonly dividendTypes: readonly string[];
}

export class DividendDetector {
  constructor(private readonly config: DividendDetectorConfig) {}

  isDividend(tx: Transaction): boolean {
    return this.config.dividendTypes.includes(tx.type);
  }

  /**
   * Intenta extraer el símbolo del instrumento del que proviene el dividendo.
   * TODO(verify-api): el campo exacto en Transaction que contiene el símbolo
   * para dividendos no está confirmado. Hipótesis: viene en un campo de texto
   * libre o en la descripción.
   */
  extractSymbol(tx: Transaction): string | null {
    // TODO(verify-api): descomentar y ajustar cuando se confirme el campo real.
    // Hipótesis 1: en tx.comment como "AAPL Dividend"
    // Hipótesis 2: en un campo específico del tipo de dividendo
    return null;
  }

  extractPayDate(tx: Transaction): string {
    return tx.created_at.slice(0, 10);
  }
}
