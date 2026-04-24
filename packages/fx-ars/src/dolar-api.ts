// Cliente para https://dolarapi.com — API pública, sin auth.
// GET /v1/dolares devuelve todas las cotizaciones USD/ARS del día en un solo
// request: oficial, blue, MEP (bolsa), CCL (contadoconliqui), mayorista, cripto,
// tarjeta. Se actualiza cada ~5 min.
//
// Usamos esta fuente para tipos de cambio de referencia del día (contexto,
// visualización). Para cálculos fiscales (BP, Ganancias) seguimos usando el
// TC oficial BNA vía el scraper de bna-client.ts.

import { z } from 'zod';
import { FxSourceError } from './errors.js';

const DOLAR_API_BASE = 'https://dolarapi.com';

const DolarItemSchema = z.object({
  casa: z.string(),
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  fechaActualizacion: z.string(),
});

const DolarListSchema = z.array(DolarItemSchema);

export type DolarCasa =
  | 'oficial'
  | 'blue'
  | 'bolsa'
  | 'contadoconliqui'
  | 'mayorista'
  | 'cripto'
  | 'tarjeta';

export interface CotizacionUSD {
  readonly casa: DolarCasa;
  readonly nombre: string;
  readonly compra: number | null;
  readonly venta: number | null;
  readonly updatedAt: string;
}

export interface DolarApiResult {
  readonly oficial: CotizacionUSD;
  readonly blue: CotizacionUSD;
  readonly mep: CotizacionUSD;
  readonly ccl: CotizacionUSD;
  readonly mayorista: CotizacionUSD | undefined;
  readonly cripto: CotizacionUSD | undefined;
  readonly tarjeta: CotizacionUSD | undefined;
  readonly all: readonly CotizacionUSD[];
}

/** Promedio entre compra y venta. Si uno es null devuelve el existente. */
export function midRate(cot: CotizacionUSD): number | null {
  if (cot.compra !== null && cot.venta !== null) return (cot.compra + cot.venta) / 2;
  return cot.compra ?? cot.venta;
}

/**
 * Trae todas las cotizaciones USD del día en un solo hit.
 * Lanza `FxSourceError` si la API falla o el shape no matchea.
 */
export async function fetchDolares(signal?: AbortSignal): Promise<DolarApiResult> {
  let res: Response;
  try {
    res = await fetch(`${DOLAR_API_BASE}/v1/dolares`, {
      headers: { Accept: 'application/json' },
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (err) {
    throw new FxSourceError('dolarapi', 'Fallo de red al consultar dolarapi.com', { cause: err });
  }

  if (!res.ok) {
    throw new FxSourceError('dolarapi', `HTTP ${res.status} desde dolarapi.com`);
  }

  const json: unknown = await res.json();
  const parsed = DolarListSchema.safeParse(json);
  if (!parsed.success) {
    throw new FxSourceError('dolarapi', 'Shape de response inesperada en dolarapi.com');
  }

  const all = parsed.data.map(
    (d): CotizacionUSD => ({
      casa: d.casa as DolarCasa,
      nombre: d.nombre,
      compra: d.compra,
      venta: d.venta,
      updatedAt: d.fechaActualizacion,
    }),
  );

  const find = (casa: DolarCasa): CotizacionUSD | undefined => all.find((c) => c.casa === casa);

  const oficial = find('oficial');
  const blue = find('blue');
  const mep = find('bolsa');
  const ccl = find('contadoconliqui');

  if (!oficial || !blue || !mep || !ccl) {
    throw new FxSourceError(
      'dolarapi',
      `Cotizaciones incompletas: falta ${[!oficial && 'oficial', !blue && 'blue', !mep && 'mep', !ccl && 'ccl'].filter(Boolean).join(', ')}`,
    );
  }

  return {
    oficial,
    blue,
    mep,
    ccl,
    mayorista: find('mayorista'),
    cripto: find('cripto'),
    tarjeta: find('tarjeta'),
    all,
  };
}
