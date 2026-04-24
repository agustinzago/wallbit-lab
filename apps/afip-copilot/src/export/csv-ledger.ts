// Generador de CSV del ledger de dividendos para el contador.
// Columnas en español (preferencia de contadores argentinos).
// Sin librerías externas — escapa comas y comillas manualmente.

import { and, gte, lte } from 'drizzle-orm';
import { dividendLedger } from '../db/schema.js';
import type { Db } from '../db/client.js';

const HEADERS = [
  'fecha_pago',
  'simbolo',
  'monto_usd',
  'tc_bna_comprador',
  'monto_ars',
  'retencion_usd',
  'uuid_wallbit',
  'norma_aplicada',
];

const NORMA = 'LIG Art.94 §1 + Art.140';

export async function buildCsvLedger(db: Db, year: number): Promise<string> {
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;

  const rows = await db
    .select()
    .from(dividendLedger)
    .where(and(gte(dividendLedger.payDate, fromDate), lte(dividendLedger.payDate, toDate)))
    .orderBy(dividendLedger.payDate);

  const lines: string[] = [HEADERS.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.payDate,
        row.symbol,
        Number(row.amountUsd).toFixed(8),
        Number(row.fxBnaComprador).toFixed(8),
        Number(row.amountArs).toFixed(2),
        Number(row.whtUsd).toFixed(8),
        row.sourceTxUuid,
        csvEscape(NORMA),
      ].join(','),
    );
  }

  return lines.join('\n');
}

/** Escapa un valor para CSV: si contiene coma, comilla o newline, lo envuelve en comillas. */
function csvEscape(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
