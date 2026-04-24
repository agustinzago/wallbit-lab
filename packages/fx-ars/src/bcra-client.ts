// Cliente BCRA API — Estadísticas Cambiarias.
// Endpoint: GET /estadisticascambiarias/v1.0/Cotizaciones/{fecha}
//
// IMPORTANTE: BCRA devuelve el TC de referencia Com 3500 (mayorista), que NO es
// el BNA comprador divisa requerido por art. 23 Ley 23.966. Se usa como fallback
// y validación cruzada, no como fuente primaria. Ver bna-client.ts para la
// fuente canónica.

import { z } from 'zod';
import { FxSourceError } from './errors.js';

const BCRA_API_BASE = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0';

// TODO(verify-fx): validar que los campos devueltos por BCRA son estables.
const BcraCotizacionItemSchema = z
  .object({
    codigoMoneda: z.string(),
    tipoCotizacion: z.number(),
    tipoPase: z.number(),
    fecha: z.string(),
  })
  .passthrough();

const BcraResponseSchema = z
  .object({
    results: z.array(BcraCotizacionItemSchema),
  })
  .passthrough();

export interface BcraQuote {
  /** TC de referencia Com 3500 (mayorista, no BNA minorista). */
  readonly referenceRate: number;
  readonly date: string;
}

/**
 * Obtiene la cotización de referencia BCRA para un día dado.
 * Solo USD (codigoMoneda === '002' es el código histórico de USD en BCRA).
 * TODO(verify-fx): confirmar que '002' sigue siendo el código de USD en la API.
 */
export async function fetchFromBcra(date: string): Promise<BcraQuote> {
  const url = `${BCRA_API_BASE}/Cotizaciones/${date}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new FxSourceError('bcra', `Fallo de red al consultar ${url}`, { cause: err });
  }

  if (!res.ok) {
    throw new FxSourceError(
      'bcra',
      `HTTP ${res.status} desde ${url}`,
    );
  }

  const raw: unknown = await res.json().catch(() => ({}));
  const parsed = BcraResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new FxSourceError(
      'bcra',
      `Respuesta inesperada de BCRA: ${parsed.error.message}`,
    );
  }

  // USD tiene codigoMoneda '002' en la API de estadísticas cambiarias BCRA.
  const usdItem = parsed.data.results.find((r) => r.codigoMoneda === '002');
  if (!usdItem) {
    throw new FxSourceError(
      'bcra',
      `No se encontró USD (codigoMoneda '002') en la respuesta para ${date}.`,
    );
  }

  return {
    referenceRate: usdItem.tipoCotizacion,
    date,
  };
}
