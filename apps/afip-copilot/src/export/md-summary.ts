// Generador de resumen fiscal en Markdown para el contador.
// Incluye datos del contribuyente, BP proyectado, dividendos, ventas y WHT.

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { projectIncomeTaxDividends } from '@wallbit-lab/ar-tax-engine';
import type { DividendWithFx } from '@wallbit-lab/ar-tax-engine';
import { dividendLedger, taxSnapshots } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { AppConfig } from '../config.js';

export async function buildMdSummary(db: Db, year: number, config: AppConfig): Promise<string> {
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;
  const today = new Date().toISOString().slice(0, 10);

  // Obtener dividendos del año.
  const divRows = await db
    .select()
    .from(dividendLedger)
    .where(and(gte(dividendLedger.payDate, fromDate), lte(dividendLedger.payDate, toDate)))
    .orderBy(dividendLedger.payDate);

  const dividendsForEngine: DividendWithFx[] = divRows.map((row) => ({
    payDate: row.payDate,
    symbol: row.symbol,
    amountUsd: Number(row.amountUsd),
    whtUsdAmount: Number(row.whtUsd),
    sourceTxUuid: row.sourceTxUuid,
    fxBnaCompradorAtPayDate: Number(row.fxBnaComprador),
  }));

  const incomeTaxProjection = projectIncomeTaxDividends(dividendsForEngine, year);

  // Obtener último snapshot del año.
  const snapshots = await db
    .select()
    .from(taxSnapshots)
    .where(eq(taxSnapshots.fiscalYear, year))
    .orderBy(desc(taxSnapshots.snapshotAt))
    .limit(1);

  const lastSnapshot = snapshots[0] ?? null;

  const sections: string[] = [];

  // 1. Encabezado
  sections.push(`# Resumen Fiscal ${year} — Generado por AFIP Copilot`);
  sections.push(`_Generado: ${today}_`);
  sections.push('');

  // 2. Datos del contribuyente
  sections.push('## Datos del Contribuyente');
  sections.push(`- **Nombre:** ${config.taxpayerName ?? '_(no configurado)_'}`);
  sections.push(`- **CUIT:** ${config.taxpayerCuit ?? '_(no configurado)_'}`);
  sections.push('');

  // 3. Bienes Personales
  sections.push(`## Bienes Personales ${year}`);
  if (lastSnapshot) {
    sections.push(`- **Patrimonio valuado (ARS):** $${fmtNum(Number(lastSnapshot.patrimonioArs), 0)}`);
    sections.push(`- **Patrimonio valuado (USD):** $${fmtNum(Number(lastSnapshot.patrimonioUsd), 2)}`);
    sections.push(`- **Impuesto proyectado (ARS):** $${fmtNum(Number(lastSnapshot.bpProjectedArs), 0)}`);
    sections.push(`- **Fuente:** último snapshot del ${lastSnapshot.snapshotAt.toISOString().slice(0, 10)}`);
  } else {
    sections.push('_Sin snapshot disponible. Ejecutar /status para generar._');
  }
  sections.push('');

  // 4. Ingresos por dividendos
  sections.push(`## Ingresos por Dividendos ${year} (Fuente Extranjera)`);
  if (divRows.length === 0) {
    sections.push('_Sin actividad de dividendos registrada para este período._');
  } else {
    sections.push(`| Fecha | Símbolo | USD | TC BNA | ARS | WHT USD |`);
    sections.push(`|-------|---------|-----|--------|-----|---------|`);
    for (const row of divRows) {
      sections.push(
        `| ${row.payDate} | ${row.symbol} | ${fmtNum(Number(row.amountUsd), 2)} | ${fmtNum(Number(row.fxBnaComprador), 2)} | ${fmtNum(Number(row.amountArs), 0)} | ${fmtNum(Number(row.whtUsd), 2)} |`,
      );
    }
    sections.push('');
    sections.push(`**Total USD:** ${fmtNum(incomeTaxProjection.totalGrossArs > 0 ? dividendsForEngine.reduce((s, d) => s + d.amountUsd, 0) : 0, 2)}`);
    sections.push(`**Total ARS:** $${fmtNum(incomeTaxProjection.totalGrossArs, 0)}`);
    sections.push(`**Impuesto Art.94 proyectado:** $${fmtNum(incomeTaxProjection.incomeTaxArs, 0)}`);
    sections.push(`**Crédito fiscal WHT:** $${fmtNum(incomeTaxProjection.foreignTaxCreditArs, 0)}`);
    sections.push(`**Neto a pagar:** $${fmtNum(incomeTaxProjection.netTaxArs, 0)}`);
  }
  sections.push('');

  // 5. Crédito WHT
  sections.push('## Crédito Fiscal por Retención en Origen (WHT)');
  sections.push(`- Límite: el crédito no puede superar el impuesto argentino sobre la misma renta (LIG art. 178).`);
  sections.push(`- Total WHT computado: $${fmtNum(incomeTaxProjection.foreignTaxCreditArs, 0)} ARS`);
  sections.push('');

  // 6. Anexo de fuentes
  sections.push('## Anexo: Fuentes de Datos');
  sections.push(`- Cotizaciones FX: BNA Divisa (fuente BNA scraper)`);
  sections.push(`- Reglas BP ${year}: ${year === 2025 ? 'estimadas (pendiente RG ARCA)' : 'oficiales'}`);
  sections.push(`- Datos de portfolio: Wallbit API (spot del día de generación)`);
  sections.push('');

  // 7. Disclaimer
  sections.push('---');
  sections.push('> **Disclaimer:** Documento generado automáticamente por AFIP Copilot. Los valores son proyecciones basadas en datos disponibles al momento de la generación y pueden diferir de las obligaciones fiscales definitivas. **Verificar con el contador antes de presentar ante ARCA.**');

  return sections.join('\n');
}

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
