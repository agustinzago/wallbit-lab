// Handler del comando /simulate <SYMBOL> <SHARES>.
// Calcula la ganancia de capital y el impuesto cedular 15% (Art. 94 §3).

import { asc, eq, gt } from 'drizzle-orm';
import { simulateSale } from '@wallbit-lab/ar-tax-engine';
import type { CostBasisLot } from '@wallbit-lab/ar-tax-engine';
import { costBasisLots } from '../../db/schema.js';
import type { CommandContext } from '../router.js';

export async function handleSimulate(ctx: CommandContext): Promise<string> {
  const [symbol, sharesStr] = ctx.args;

  if (!symbol || !sharesStr) {
    return [
      '🧮 *Uso:* `/simulate <SYMBOL> <SHARES>`',
      '',
      'Ejemplo: `/simulate AAPL 10`',
      '',
      'Simulá la venta de N shares y mirá el impuesto cedular (15% sobre ganancia ARS).',
    ].join('\n');
  }

  const shares = Number(sharesStr);
  if (!Number.isFinite(shares) || shares <= 0) {
    return 'Shares debe ser un número positivo. Ej: `/simulate AAPL 10`';
  }

  const today = new Date().toISOString().slice(0, 10);

  let asset;
  try {
    asset = await ctx.wallbit.assets.getBySymbol(symbol.toUpperCase());
  } catch {
    return `❌ No se encontró el símbolo \`${symbol}\`. Verificá que el ticker sea correcto.`;
  }

  let fxVendedor;
  try {
    fxVendedor = await ctx.fx.getBnaDivisa({ date: today, side: 'seller' });
  } catch (err) {
    return `❌ Error al obtener cotización BNA vendedor: ${err instanceof Error ? err.message : String(err)}`;
  }

  const lots = await ctx.db
    .select()
    .from(costBasisLots)
    .where(
      eq(costBasisLots.symbol, symbol.toUpperCase()) &&
        gt(costBasisLots.remainingShares, '0'),
    )
    .orderBy(asc(costBasisLots.purchaseDate));

  if (lots.length === 0) {
    return [
      `Sin cost basis cargado para \`${symbol}\`.`,
      '',
      'Usá /import\\_cost\\_basis para importar tus lotes desde un CSV.',
    ].join('\n');
  }

  const engineLots: CostBasisLot[] = lots.map((lot) => ({
    lotId: lot.id,
    symbol: lot.symbol,
    purchaseDate: lot.purchaseDate,
    shares: Number(lot.shares),
    remainingShares: Number(lot.remainingShares),
    priceUsd: Number(lot.priceUsd),
    fxBnaVendedorAtPurchase: Number(lot.fxBnaVendedor),
  }));

  const simulation = simulateSale({
    symbol: symbol.toUpperCase(),
    sharesToSell: shares,
    currentPriceUsd: Number(asset.price),
    lots: engineLots,
    method: ctx.config.costBasisMethod,
    fxBnaVendedor: fxVendedor.rate,
  });

  const lotsTable = simulation.lotsConsumed
    .map((l) => `  • Lot ${l.lotId.slice(-6)}  ${l.sharesTaken.toFixed(4)} shares  costo ARS $${fmtNum(l.costArs, 0)}`)
    .join('\n');

  const warningLines =
    simulation.warnings.length > 0
      ? '\n' + simulation.warnings.map((w) => `⚠️ ${w}`).join('\n')
      : '';

  return [
    `🧮 *Simulación — vender ${shares} ${symbol.toUpperCase()}*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `💵 Precio actual: USD $${fmtNum(Number(asset.price), 2)}`,
    `📈 Ganancia bruta USD: $${fmtNum(simulation.capitalGainUsd, 2)}`,
    `🇦🇷 Ganancia ARS @ TC venta ${fmtNum(fxVendedor.rate, 0)}: $${fmtNum(simulation.capitalGainArs, 0)}`,
    '',
    `🧾 *Impuesto cedular (15% sobre ganancia ARS):* $${fmtNum(simulation.cedularTaxArs, 0)}`,
    `💰 Neto post-impuesto:`,
    `  • USD: $${fmtNum(simulation.netProceedsUsd, 2)}`,
    `  • ARS: $${fmtNum(simulation.netProceedsArs, 0)}`,
    '',
    'Lotes consumidos (FIFO):',
    lotsTable,
    warningLines,
    '',
    `_${simulation.normaAplicada}_`,
    `_Quebrantos son específicos: solo compensan ganancias del mismo tipo (Art.132 LIG)._`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
