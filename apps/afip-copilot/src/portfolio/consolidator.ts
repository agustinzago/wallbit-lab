// Consolidador de portfolio: agrega todas las fuentes de patrimonio de Wallbit
// en un PortfolioSnapshot uniforme listo para el engine de AR-tax.
//
// Fuentes:
//   1. balance.getChecking() — cash USD en cuenta corriente
//   2. balance.getStocks()   — posiciones en acciones + cash USD en cuenta inversión
//   3. roboAdvisor.getBalance() — portfolios gestionados (holdings + cash)

import type { WallbitClient, RoboAdvisorPortfolio } from '@wallbit-lab/sdk';
import { WallbitNotFoundError } from '@wallbit-lab/sdk';
import type { PortfolioSnapshot, StockPosition } from '@wallbit-lab/ar-tax-engine';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export class PortfolioConsolidator {
  constructor(
    private readonly wallbit: WallbitClient,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async snapshot(): Promise<PortfolioSnapshot> {
    const [checkingBalances, stocksPositions, roboPortfolios] = await Promise.all([
      this.wallbit.balance.getChecking(),
      this.wallbit.balance.getStocks(),
      this.wallbit.roboAdvisor.getBalance().catch((err) => {
        // 404 = roboadvisor no habilitado en esta cuenta. Tratamos como sin portfolios.
        if (err instanceof WallbitNotFoundError) {
          this.logger.info('portfolio: roboadvisor no disponible en esta cuenta (404), ignorando');
          return [] as RoboAdvisorPortfolio[];
        }
        throw err;
      }),
    ]);

    this.logger.debug('portfolio: datos obtenidos de Wallbit', {
      checking: checkingBalances.length,
      stocks: stocksPositions.length,
      roboadvisor: roboPortfolios.length,
    });

    // Cash USD: suma de cuenta corriente + cash en stocks + cash de roboadvisor.
    let usdCashBroker = 0;

    for (const item of checkingBalances) {
      if (item.currency === 'USD') {
        usdCashBroker += Number(item.balance);
      }
    }

    for (const pos of stocksPositions) {
      if (pos.symbol === 'USD') {
        usdCashBroker += Number(pos.shares);
      }
    }

    for (const portfolio of roboPortfolios) {
      usdCashBroker += Number(portfolio.cash);
    }

    // Posiciones en acciones/ETFs.
    const stockPositionsMap = new Map<string, StockPosition>();

    for (const pos of stocksPositions) {
      if (pos.symbol === 'USD') continue;
      let asset;
      try {
        asset = await this.wallbit.assets.getBySymbol(pos.symbol);
      } catch (err) {
        this.logger.warn('portfolio: no se pudo obtener precio para símbolo', {
          symbol: pos.symbol,
          err: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      const existing = stockPositionsMap.get(pos.symbol);
      stockPositionsMap.set(pos.symbol, {
        symbol: pos.symbol,
        shares: (existing?.shares ?? 0) + Number(pos.shares),
        priceUsd: Number(asset.price),
      });
    }

    for (const portfolio of roboPortfolios) {
      for (const asset of portfolio.assets) {
        const existing = stockPositionsMap.get(asset.symbol);
        stockPositionsMap.set(asset.symbol, {
          symbol: asset.symbol,
          shares: (existing?.shares ?? 0) + Number(asset.shares),
          priceUsd: Number(asset.price),
        });
      }
    }

    const positions = Array.from(stockPositionsMap.values());

    const totalUsd = usdCashBroker + positions.reduce((sum, p) => sum + p.shares * p.priceUsd, 0);
    this.logger.info('portfolio: snapshot consolidado', {
      usdCashBroker,
      positions: positions.length,
      totalUsd,
    });

    const snapshot: PortfolioSnapshot = {
      valuationDate: new Date().toISOString().slice(0, 10),
      usdCashBroker,
      positions,
      ...(this.config.cashArBankArs !== undefined ? { cashArBank: this.config.cashArBankArs } : {}),
      ...(this.config.titulosPublicosArArs !== undefined
        ? { titulosPublicosAr: this.config.titulosPublicosArArs }
        : {}),
    };
    return snapshot;
  }
}
