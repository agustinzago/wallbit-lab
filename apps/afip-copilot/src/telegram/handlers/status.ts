// Handler del comando /status.
// Consolida el portfolio, obtiene el TC BNA del día y proyecta BP.
// En paralelo trae todos los tipos de cambio de dolarapi.com para contexto.

import { projectBienesPersonales } from '@wallbit-lab/ar-tax-engine';
import { fetchDolares, type DolarApiResult } from '@wallbit-lab/fx-ars';
import { PortfolioConsolidator } from '../../portfolio/consolidator.js';
import { formatStatus } from '../formatters/status.js';
import type { CommandContext } from '../router.js';

export async function handleStatus(ctx: CommandContext): Promise<string> {
  const consolidator = new PortfolioConsolidator(ctx.wallbit, ctx.config, ctx.logger);

  let portfolio;
  try {
    portfolio = await consolidator.snapshot();
  } catch (err) {
    ctx.logger.error('status: error consolidando portfolio', {
      err: err instanceof Error ? err.message : String(err),
    });
    return `❌ Error al obtener el portfolio desde Wallbit: ${err instanceof Error ? err.message : String(err)}`;
  }

  const today = portfolio.valuationDate;

  // Fetch BNA (fiscal) y dolarapi (referencia) en paralelo.
  let fx;
  let dolarapi: DolarApiResult | undefined;
  try {
    [fx, dolarapi] = await Promise.all([
      ctx.fx.getBnaDivisa({ date: today, side: 'buyer' }),
      fetchDolares().catch((err) => {
        ctx.logger.warn('status: no se pudo obtener cotizaciones dolarapi', {
          err: err instanceof Error ? err.message : String(err),
        });
        return undefined;
      }),
    ]);
  } catch (err) {
    ctx.logger.error('status: error obteniendo TC BNA', {
      err: err instanceof Error ? err.message : String(err),
    });
    return `❌ Error al obtener la cotización BNA: ${err instanceof Error ? err.message : String(err)}`;
  }

  const projection = projectBienesPersonales({
    period: ctx.config.fiscalYear,
    portfolio,
    fxBnaComprador: fx.rate,
    isCumplidor: ctx.config.contribuyenteCumplidor,
    isReibpAdherido: ctx.config.reibpAdherido,
  });

  return formatStatus(portfolio, projection, fx, dolarapi);
}
