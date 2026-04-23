// Cliente mínimo para https://dolarapi.com — API pública sin auth, sin SDK.
// Sólo usamos el endpoint /v1/dolares que devuelve todas las cotizaciones en
// un solo request. Para el analyzer usamos el tipo "blue" (referencia real del
// mercado informal argentino para freelancers que cobran en USD y gastan en ARS).
//
// No hay rate limit documentado; la API se actualiza cada ~5 min. Para el
// cron diario un solo hit por ejecución está muy por debajo de cualquier límite
// razonable.

import { z } from 'zod';

const DOLAR_API_BASE = 'https://dolarapi.com';

const DolarSchema = z.object({
  moneda: z.string(),
  casa: z.string(),
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  fechaActualizacion: z.string(),
});

const DolarListSchema = z.array(DolarSchema);

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
  readonly compra: number | null;
  readonly venta: number | null;
  readonly updatedAt: string;
}

export interface DolarApiResult {
  readonly blue: CotizacionUSD;
  readonly oficial: CotizacionUSD;
  readonly all: readonly CotizacionUSD[];
}

// Devuelve el promedio entre compra y venta. Si alguno de los dos es null,
// devuelve el que existe. Si los dos son null, devuelve null.
export function midRate(cot: CotizacionUSD): number | null {
  if (cot.compra !== null && cot.venta !== null) {
    return (cot.compra + cot.venta) / 2;
  }
  return cot.compra ?? cot.venta;
}

// Fetch todas las cotizaciones USD del día con un sólo hit.
// Tira si la API está caída — el consumidor decide si degradar o abortar.
export async function fetchDolares(signal?: AbortSignal): Promise<DolarApiResult> {
  const res = await fetch(`${DOLAR_API_BASE}/v1/dolares`, {
    headers: { Accept: 'application/json' },
    // exactOptionalPropertyTypes: signal debe ser null (no undefined) en RequestInit.
    ...(signal !== undefined ? { signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`dolarapi.com respondió ${res.status} — cotizaciones no disponibles.`);
  }

  const json: unknown = await res.json();
  const parsed = DolarListSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('dolarapi.com: shape de response inesperada.');
  }

  const all = parsed.data.map(
    (d): CotizacionUSD => ({
      casa: d.casa as DolarCasa,
      compra: d.compra,
      venta: d.venta,
      updatedAt: d.fechaActualizacion,
    }),
  );

  const blue = all.find((c) => c.casa === 'blue');
  const oficial = all.find((c) => c.casa === 'oficial');

  if (!blue || !oficial) {
    throw new Error('dolarapi.com: no se encontró cotización blue u oficial en la respuesta.');
  }

  return { blue, oficial, all };
}
