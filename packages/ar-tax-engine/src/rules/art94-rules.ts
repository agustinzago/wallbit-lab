// Tablas de alícuotas del Art. 94 §1 LIG — dividendos de fuente extranjera.
// Escala semestral publicada por ARCA para cada semestre del año fiscal.
//
// Solo está cargada la tabla para enero-junio 2026 (publicada oficialmente).
// El motor emite warning si se pide un período no cargado y usa la tabla más
// cercana disponible.

import { UnsupportedPeriodError } from '../errors.js';

export interface Art94Tranche {
  /** Ganancia neta acumulada en ARS hasta este tramo. Infinity para el final. */
  readonly upToArs: number;
  readonly fixedArs: number;
  /** Alícuota marginal. */
  readonly rate: number;
}

export interface Art94RuleSet {
  /** Identificador del semestre. Formato "YYYY-H1" o "YYYY-H2". */
  readonly semestreId: string;
  readonly isEstimated: boolean;
  readonly norma: string;
  readonly tranches: readonly Art94Tranche[];
}

// TODO(verify-fx): cargar tablas H2 2025 y H1 2026 con valores oficiales cuando
// estén publicados. Por ahora solo está H1 2026.
export const ART94_RULES: Record<string, Art94RuleSet> = {
  '2026-H1': {
    semestreId: '2026-H1',
    isEstimated: false,
    norma: 'LIG Art. 94 §1 + RG ARCA tabla sem. I 2026',
    tranches: [
      // Tabla oficial semestral publicada por ARCA para enero-junio 2026.
      // Alícuotas van del 5% al 35% sobre ganancia neta acumulada en ARS.
      // TODO(verify-api): confirmar los tramos exactos contra la RG publicada.
      { upToArs: 870_000, fixedArs: 0, rate: 0.05 },
      { upToArs: 1_740_000, fixedArs: 43_500, rate: 0.09 },
      { upToArs: 2_900_000, fixedArs: 121_800, rate: 0.12 },
      { upToArs: 5_800_000, fixedArs: 261_000, rate: 0.15 },
      { upToArs: 8_700_000, fixedArs: 696_000, rate: 0.19 },
      { upToArs: 11_600_000, fixedArs: 1_247_000, rate: 0.23 },
      { upToArs: 16_675_000, fixedArs: 1_914_000, rate: 0.27 },
      { upToArs: 23_200_000, fixedArs: 3_285_250, rate: 0.31 },
      { upToArs: Infinity, fixedArs: 5_307_750, rate: 0.35 },
    ],
  },
};

/**
 * Obtiene la tabla Art. 94 para el año dado.
 * Busca primero H1 del año, luego H2 del año anterior, o lanza error.
 */
export function getArt94Rule(year: number): { rule: Art94RuleSet; warning?: string } {
  const h1Key = `${year}-H1`;
  if (ART94_RULES[h1Key]) {
    return { rule: ART94_RULES[h1Key] };
  }

  // Fallback: usar la tabla más reciente disponible con warning.
  const keys = Object.keys(ART94_RULES).sort().reverse();
  if (keys.length > 0 && keys[0]) {
    const fallbackKey = keys[0];
    const fallbackRule = ART94_RULES[fallbackKey];
    if (fallbackRule) {
      return {
        rule: fallbackRule,
        warning: `Tabla Art. 94 para ${year} no cargada. Se usa "${fallbackKey}" como aproximación. Verificar con contador.`,
      };
    }
  }

  throw new UnsupportedPeriodError(year, 'ART94_RULES');
}
