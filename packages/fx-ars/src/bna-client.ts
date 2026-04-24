// Scraper BNA — Cotizaciones Históricas (Billetes).
//
// URL: https://www.bna.com.ar/Cotizador/HistoricoPrincipales?fecha=DD/MM/YYYY&id=billetes
// El BNA carga la tabla de cotizaciones vía jQuery AJAX. Un fetch directo sin
// headers AJAX devuelve el HTML de la página con el div #cotizacionesCercanas vacío.
// Para obtener la tabla hay que simular el pedido AJAX con:
//   - Header X-Requested-With: XMLHttpRequest
//   - Parámetro filtroDolar=1
//
// Nota: el endpoint id=divisas no devuelve datos con esta estrategia AJAX.
// Usamos id=billetes como fuente de referencia.
//
// Si la fecha es fin de semana o feriado, el BNA no publica cotización para ese
// día. La lógica de fallback al último día hábil vive en FxService.

import { FxSourceError } from './errors.js';

const BNA_URL = 'https://www.bna.com.ar/Cotizador/HistoricoPrincipales';

export interface BnaQuote {
  readonly comprador: number;
  readonly vendedor: number;
}

/**
 * Intenta obtener la cotización BNA divisa USD para una fecha dada.
 * Lanza `FxSourceError` si la fecha no tiene datos (feriado/fin de semana)
 * o si la fuente no responde.
 */
export async function fetchFromBna(date: string): Promise<BnaQuote> {
  // Convertir Y-m-d → DD/MM/YYYY para la URL del BNA.
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    throw new FxSourceError('bna', `Fecha inválida: ${date}`);
  }
  const formattedDate = `${day}/${month}/${year}`;
  // filtroDolar=1 + X-Requested-With son necesarios para que el BNA devuelva
  // la tabla de datos en el HTML (cargada via jQuery AJAX en el browser).
  const url = `${BNA_URL}?fecha=${formattedDate}&id=billetes&filtroDolar=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  } catch (err) {
    throw new FxSourceError('bna', `Fallo de red al consultar BNA: ${url}`, { cause: err });
  }

  if (!res.ok) {
    throw new FxSourceError('bna', `HTTP ${res.status} desde BNA`);
  }

  const html = await res.text().catch(() => '');
  return parseBnaHtml(html, date);
}

/**
 * Parsea la tabla de cotizaciones del HTML del BNA.
 * El HTML tiene dos secciones: "Billetes" y "Divisas". Buscamos la sección
 * "Divisas" para capturar el TC correcto para BP/Ganancias.
 *
 * Estructura aproximada del HTML (sujeta a cambios del BNA):
 *   <h2>Billetes</h2>
 *   <table>... <tr><td>Dolar U.S.A</td><td>COMPRADOR</td><td>VENDEDOR</td></tr> ...</table>
 *   <h2>Divisas</h2>
 *   <table>... <tr><td>Dolar U.S.A</td><td>COMPRADOR</td><td>VENDEDOR</td></tr> ...</table>
 *
 * TODO(verify-fx): validar contra HTML real del BNA cuando se integre; el
 * scraper puede requerir ajuste si el BNA cambia su markup.
 */
export function parseBnaHtml(html: string, date: string): BnaQuote {
  // Estrategia: buscar la sección "Divisas" primero, luego extraer USD.
  // Si no encontramos "Divisas", intentamos con la tabla principal.
  let targetHtml = html;

  const divisasMatch = /Divisas[\s\S]*?(<table[\s\S]*?<\/table>)/i.exec(html);
  if (divisasMatch?.[1]) {
    targetHtml = divisasMatch[1];
  }

  // Buscar fila de "Dolar U.S.A" con 2 valores numéricos (comprador / vendedor).
  // Los montos argentinos usan coma como separador decimal en el HTML del BNA.
  const dollarRowRegex =
    /Dolar\s+U\.S\.A[\s\S]*?<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i;
  const match = dollarRowRegex.exec(targetHtml);

  if (!match?.[1] || !match?.[2]) {
    throw new FxSourceError(
      'bna',
      `No se encontró fila USD en el HTML del BNA para ${date}. Puede ser feriado o fin de semana.`,
    );
  }

  const comprador = parseArgentineNumber(match[1]);
  const vendedor = parseArgentineNumber(match[2]);

  if (!Number.isFinite(comprador) || comprador <= 0 || !Number.isFinite(vendedor) || vendedor <= 0) {
    throw new FxSourceError('bna', `Valores de cotización inválidos en HTML BNA para ${date}.`);
  }

  return { comprador, vendedor };
}

/** Convierte "1.250,45" (formato argentino) a 1250.45. */
function parseArgentineNumber(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}
