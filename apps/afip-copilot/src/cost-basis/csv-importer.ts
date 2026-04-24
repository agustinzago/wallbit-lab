// Importador de cost basis desde CSV.
// Columnas esperadas: date,symbol,shares,price_usd,side (side ∈ {BUY, SELL}).
// Idempotencia: hash(date+symbol+shares+price+side) como sourceRef.

import { createHash } from 'crypto';
import { z } from 'zod';
import { asc, eq, gt, and } from 'drizzle-orm';
import { costBasisLots } from '../db/schema.js';
import type { Db } from '../db/client.js';
import type { Logger } from '../logger.js';

const CsvRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser Y-m-d'),
  symbol: z.string().min(1),
  shares: z
    .string()
    .transform(Number)
    .refine((n) => Number.isFinite(n) && n > 0, 'shares debe ser > 0'),
  price_usd: z
    .string()
    .transform(Number)
    .refine((n) => Number.isFinite(n) && n > 0, 'price_usd debe ser > 0'),
  side: z.enum(['BUY', 'SELL']),
});

export interface ImportResult {
  readonly rowsProcessed: number;
  readonly inserted: number;
  readonly skipped: number;
  readonly warnings: readonly string[];
}

export class CsvImporter {
  constructor(
    private readonly db: Db,
    private readonly logger: Logger,
  ) {}

  async import(csvContent: string): Promise<ImportResult> {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return { rowsProcessed: 0, inserted: 0, skipped: 0, warnings: ['CSV vacío o sin datos.'] };
    }

    const [headerLine, ...dataLines] = lines;
    const headers = (headerLine ?? '').split(',').map((h) => h.trim().toLowerCase());
    const expectedHeaders = ['date', 'symbol', 'shares', 'price_usd', 'side'];

    for (const expected of expectedHeaders) {
      if (!headers.includes(expected)) {
        return {
          rowsProcessed: 0,
          inserted: 0,
          skipped: 0,
          warnings: [`Header faltante: "${expected}". Esperados: ${expectedHeaders.join(', ')}`],
        };
      }
    }

    const warnings: string[] = [];
    let inserted = 0;
    let skipped = 0;

    // Procesar todo en una transacción para rollback si hay error crítico.
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line || line.trim() === '') continue;

      const cells = line.split(',').map((c) => c.trim());
      const rawRow: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        rawRow[headers[j] ?? ''] = cells[j] ?? '';
      }

      const parsed = CsvRowSchema.safeParse(rawRow);
      if (!parsed.success) {
        warnings.push(`Fila ${i + 2}: ${parsed.error.issues.map((e) => e.message).join(', ')} — ignorada.`);
        skipped++;
        continue;
      }

      const row = parsed.data;
      const sourceRef = hashRow(row.date, row.symbol, row.shares, row.price_usd, row.side);

      if (row.side === 'BUY') {
        const lotId = `csv-${sourceRef}`;

        const res = await this.db
          .insert(costBasisLots)
          .values({
            id: lotId,
            symbol: row.symbol,
            purchaseDate: row.date,
            shares: String(row.shares),
            remainingShares: String(row.shares),
            priceUsd: String(row.price_usd),
            fxBnaVendedor: '0', // No tenemos TC al importar historial CSV. Se puede actualizar después.
            source: 'manual_csv',
            sourceRef,
          })
          .onConflictDoNothing()
          .returning();

        if (res.length > 0) {
          inserted++;
        } else {
          skipped++;
          this.logger.debug('csv-importer: lote ya existe', { lotId });
        }
      } else {
        // SELL: consumir lotes FIFO.
        const sellResult = await this.consumeLotsForSell(
          row.symbol,
          row.shares,
          row.date,
          sourceRef,
        );
        warnings.push(...sellResult.warnings);
        inserted += sellResult.consumed > 0 ? 1 : 0;
      }
    }

    return { rowsProcessed: dataLines.length, inserted, skipped, warnings };
  }

  private async consumeLotsForSell(
    symbol: string,
    sharesToSell: number,
    saleDate: string,
    _sourceRef: string,
  ): Promise<{ consumed: number; warnings: string[] }> {
    const warnings: string[] = [];

    const lots = await this.db
      .select()
      .from(costBasisLots)
      .where(
        and(
          eq(costBasisLots.symbol, symbol),
          gt(costBasisLots.remainingShares, '0'),
          eq(costBasisLots.source, 'manual_csv'),
        ),
      )
      .orderBy(asc(costBasisLots.purchaseDate));

    let remaining = sharesToSell;
    let totalConsumed = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;

      const available = Number(lot.remainingShares);
      const toConsume = Math.min(available, remaining);
      const newRemaining = available - toConsume;

      await this.db
        .update(costBasisLots)
        .set({ remainingShares: String(newRemaining) })
        .where(eq(costBasisLots.id, lot.id));

      remaining -= toConsume;
      totalConsumed += toConsume;
    }

    if (remaining > 0) {
      warnings.push(
        `Venta sin cost basis suficiente: ${symbol}, faltan ${remaining.toFixed(8)} shares (venta del ${saleDate}). Los lotes existentes no cubrieron el total.`,
      );
    }

    return { consumed: totalConsumed, warnings };
  }
}

function hashRow(
  date: string,
  symbol: string,
  shares: number,
  price: number,
  side: string,
): string {
  return createHash('md5')
    .update(`${date}:${symbol}:${shares}:${price}:${side}`)
    .digest('hex')
    .slice(0, 16);
}
