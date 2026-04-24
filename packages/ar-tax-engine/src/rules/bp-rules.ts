// Tablas de Bienes Personales por período fiscal.
// Fuente: research §1.2-§1.3 + Ley 27.743 art. 64 + Ley 23.966.
//
// Los tramos de 2025 son estimados (isEstimated: true) — pendiente de RG ARCA
// formal al 24/04/2026. El ajuste es +31,3% IPC sobre 2024 (Ley 27.743 art. 64).

import { UnsupportedPeriodError } from '../errors.js';

export interface BpTranche {
  /** Límite superior del tramo en ARS. Infinity para el tramo final. */
  readonly upToArs: number;
  /** Monto fijo en ARS que se suma al cálculo del tramo (acumula tramos anteriores). */
  readonly fixedArs: number;
  /** Alícuota marginal del tramo (0.005 = 0,5%). */
  readonly rate: number;
}

export interface BpRuleSet {
  readonly periodo: number;
  readonly mniArs: number;
  readonly casaHabitacionExentaArs: number;
  readonly isEstimated: boolean;
  readonly norma: string;
  readonly scales: {
    readonly general: readonly BpTranche[];
    readonly cumplidor: readonly BpTranche[];
  };
}

export const BP_RULES: Record<number, BpRuleSet> = {
  2024: {
    periodo: 2024,
    mniArs: 292_994_964.89,
    casaHabitacionExentaArs: 1_026_492_982.79,
    isEstimated: false,
    norma: 'Ley 23.966 art.25 + Ley 27.743 art.64 + RG 5544/2024',
    scales: {
      general: [
        { upToArs: 82_399_519.36, fixedArs: 0, rate: 0.005 },
        { upToArs: 178_532_292.28, fixedArs: 411_997.60, rate: 0.0075 },
        { upToArs: 357_064_584.56, fixedArs: 1_132_990.39, rate: 0.01 },
        { upToArs: Infinity, fixedArs: 2_918_313.42, rate: 0.0125 },
      ],
      cumplidor: [
        { upToArs: 82_399_519.36, fixedArs: 0, rate: 0.0 },
        { upToArs: 178_532_292.28, fixedArs: 0, rate: 0.0025 },
        { upToArs: 357_064_584.56, fixedArs: 240_998.43, rate: 0.005 },
        { upToArs: Infinity, fixedArs: 1_153_991.22, rate: 0.0075 },
      ],
    },
  },
  2025: {
    periodo: 2025,
    // Ajuste +31,3% IPC sobre los valores 2024 (Ley 27.743 art. 64).
    // TODO(verify-api): valores estimados, pendiente de RG ARCA formal.
    mniArs: 384_728_044.57,
    casaHabitacionExentaArs: 1_346_548_155.99,
    isEstimated: true,
    norma: 'Ley 23.966 art.25 + Ley 27.743 art.64 (ajuste IPC +31,3%) — ESTIMADO',
    scales: {
      general: [
        { upToArs: 108_214_688.96, fixedArs: 0, rate: 0.005 },
        { upToArs: 234_436_919.76, fixedArs: 541_073.44, rate: 0.0075 },
        { upToArs: Infinity, fixedArs: 1_487_740.17, rate: 0.01 },
      ],
      cumplidor: [
        { upToArs: 108_214_688.96, fixedArs: 0, rate: 0.0 },
        { upToArs: 234_436_919.76, fixedArs: 0, rate: 0.0025 },
        { upToArs: Infinity, fixedArs: 315_555.58, rate: 0.005 },
      ],
    },
  },
};

export function getBpRule(period: number): BpRuleSet {
  const rule = BP_RULES[period];
  if (!rule) throw new UnsupportedPeriodError(period, 'BP_RULES');
  return rule;
}
