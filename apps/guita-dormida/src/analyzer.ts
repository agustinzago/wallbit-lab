// Núcleo del análisis de capital ocioso. Lee estado (checking, stocks, wallets) y
// transacciones recientes, calcula un colchón dinámico a partir del burn rate real
// y detecta tres categorías de ociosidad: checking, wallets cripto y stocks de
// renta fija estancados.
//
// TODO(verify-api): varios campos de los responses de Wallbit se asumen sin
// confirmación (ver schemas del SDK). Si algo rompe al probar contra la API real,
// revisá los `passthrough` y ajustá los schemas zod del SDK.

import type {
  Balance,
  StocksPosition,
  Transaction,
  Wallet,
  WallbitClient,
} from '@wallbit-lab/sdk';
import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';

// Piso no negociable del colchón. Incluso si el gasto mensual es cero, dejamos este
// mínimo en checking antes de considerar cualquier saldo como ocioso.
const MIN_BUFFER_USD = 200;

// Rendimiento anual asumido de T-Bills a corto plazo (SGOV/BIL/SHV ~5% en 2024-2026).
// Es una referencia para costo de oportunidad, no una promesa.
const TBILL_ANNUAL_YIELD = 0.05;

// Símbolos que tratamos como renta fija corta. Alternativa: consultar
// `client.assets.getBySymbol()` y filtrar por category === 'TREASURY_BILL', pero
// eso implica una request por símbolo. Hardcodeamos la lista conocida para v0.1.
const TREASURY_BILL_SYMBOLS = new Set(['SGOV', 'BIL', 'SHV', 'TBIL', 'VBIL', 'GBIL']);

export type IdleCategory = 'checking' | 'crypto_wallet' | 'investment';

export interface IdleAsset {
  readonly category: IdleCategory;
  readonly currency: string;
  readonly amount: number;
  readonly idleDays: number;
  readonly opportunityCost: number;
  readonly description: string;
  readonly suggestedAction: string;
}

export interface AnalysisResult {
  readonly analyzedAt: Date;
  readonly totalIdleUSD: number;
  readonly totalOpportunityCost: number;
  readonly monthlyBurnRateUSD: number;
  readonly recommendedBufferUSD: number;
  readonly idleAssets: readonly IdleAsset[];
  readonly hasIdle: boolean;
  readonly analyzedDays: number;
}

export interface AnalyzerOptions {
  readonly client: WallbitClient;
  readonly poller: TransactionPoller;
  readonly analysisDays: number;
  readonly idleThresholdUsd: number;
  readonly checkingBufferMultiplier: number;
  readonly now?: () => Date;
}

export class IdleCapitalAnalyzer {
  private readonly client: WallbitClient;
  private readonly poller: TransactionPoller;
  private readonly analysisDays: number;
  private readonly idleThresholdUsd: number;
  private readonly bufferMultiplier: number;
  private readonly now: () => Date;

  constructor(options: AnalyzerOptions) {
    this.client = options.client;
    this.poller = options.poller;
    this.analysisDays = options.analysisDays;
    this.idleThresholdUsd = options.idleThresholdUsd;
    this.bufferMultiplier = options.checkingBufferMultiplier;
    this.now = options.now ?? ((): Date => new Date());
  }

  async analyze(): Promise<AnalysisResult> {
    const [checkingBalances, stocks, wallets, transactions] = await Promise.all([
      this.client.balance.getChecking(),
      this.client.balance.getStocks(),
      this.client.wallets.getAll(),
      this.poller.fetchRecent({ days: this.analysisDays }),
    ]);

    const monthlyBurn = this.computeMonthlyBurnRate(transactions);
    const recommendedBuffer = Math.max(
      MIN_BUFFER_USD,
      monthlyBurn * this.bufferMultiplier,
    );

    const idleAssets: IdleAsset[] = [
      ...this.detectIdleChecking(checkingBalances, recommendedBuffer),
      ...this.detectIdleCryptoWallets(wallets, transactions),
      ...this.detectStagnantInvestments(stocks),
    ];

    const totalIdleUSD = round2(idleAssets.reduce((acc, a) => acc + a.amount, 0));
    const totalOpportunityCost = round2(
      idleAssets.reduce((acc, a) => acc + a.opportunityCost, 0),
    );

    return {
      analyzedAt: this.now(),
      totalIdleUSD,
      totalOpportunityCost,
      monthlyBurnRateUSD: round2(monthlyBurn),
      recommendedBufferUSD: round2(recommendedBuffer),
      idleAssets,
      hasIdle: idleAssets.length > 0,
      analyzedDays: this.analysisDays,
    };
  }

  // Paso 2: calcular el gasto mensual promedio en USD a partir de los egresos
  // del período. "Egreso" = tipos que sacan plata (withdrawals, card, fee). TRADE e
  // INTERNAL_TRANSFER se excluyen explícitamente: no son consumo.
  private computeMonthlyBurnRate(transactions: readonly Transaction[]): number {
    const egressTypes = new Set(['WITHDRAWAL', 'CARD_PAYMENT', 'FEE']);
    const arsToUsd = this.inferArsToUsdRate(transactions);

    let totalUsd = 0;
    for (const tx of transactions) {
      if (!egressTypes.has(tx.type)) continue;
      const absAmount = Math.abs(parseAmount(tx.amount));
      if (tx.currency === 'USD') {
        totalUsd += absAmount;
      } else if (tx.currency === 'USDT' || tx.currency === 'USDC') {
        // Stablecoins USD-pegged: los tratamos 1:1 para el burn rate.
        totalUsd += absAmount;
      } else if (tx.currency === 'ARS') {
        totalUsd += absAmount * arsToUsd;
      }
      // Otras monedas (EUR, BTC, ETH) las ignoramos por ahora; son ruido raro acá.
    }

    // Normalizar al mes (30 días) sobre la ventana analizada.
    return (totalUsd / this.analysisDays) * 30;
  }

  // Heurística: buscar en las transacciones del período alguna TRADE o INTERNAL_TRANSFER
  // que tenga explícitamente un par ARS/USD en `metadata.rate`. Si no existe, fallback
  // conservador a 0 (no convertimos ARS — asume que no hay gasto relevante en ARS).
  //
  // TODO(verify-api): el campo real donde Wallbit expone la tasa aplicada puede ser
  // `metadata.exchangeRate`, `metadata.price`, o estar ausente. Ajustar cuando se pruebe.
  private inferArsToUsdRate(transactions: readonly Transaction[]): number {
    for (const tx of transactions) {
      const meta = tx.metadata;
      if (meta === undefined) continue;
      const candidate = meta['rate'] ?? meta['exchangeRate'] ?? meta['price'];
      if (typeof candidate === 'string' && Number.isFinite(Number(candidate))) {
        const rate = Number(candidate);
        if (rate > 0) return 1 / rate;
      }
      if (typeof candidate === 'number' && candidate > 0) {
        return 1 / candidate;
      }
    }
    return 0;
  }

  // Paso 3a: checking ocioso.
  private detectIdleChecking(balances: readonly Balance[], buffer: number): IdleAsset[] {
    const result: IdleAsset[] = [];
    for (const bal of balances) {
      if (bal.currency !== 'USD' && bal.currency !== 'USDT' && bal.currency !== 'USDC') continue;
      const total = parseAmount(bal.total);
      const excess = total - buffer;
      if (excess > this.idleThresholdUsd) {
        const idleDays = this.analysisDays;
        const opportunityCost = computeOpportunityCost(excess, idleDays);
        result.push({
          category: 'checking',
          currency: bal.currency,
          amount: round2(excess),
          idleDays,
          opportunityCost: round2(opportunityCost),
          description: `Tenés USD ${round2(excess)} en checking por encima del colchón recomendado (USD ${round2(buffer)}).`,
          suggestedAction:
            'Movelo a T-Bills cortos (SGOV o BIL) desde el dashboard de Wallbit → Inversiones.',
        });
      }
    }
    return result;
  }

  // Paso 3b: cripto dormida. Wallet con saldo USDT/USDC relevante y sin movimiento
  // en la ventana analizada se considera dormida.
  private detectIdleCryptoWallets(
    wallets: readonly Wallet[],
    transactions: readonly Transaction[],
  ): IdleAsset[] {
    const minAmount = this.idleThresholdUsd / 2;
    const result: IdleAsset[] = [];

    for (const wallet of wallets) {
      if (wallet.currency !== 'USDT' && wallet.currency !== 'USDC') continue;
      const balanceStr = wallet.balance;
      if (balanceStr === undefined) continue;
      const amount = parseAmount(balanceStr);
      if (amount < minAmount) continue;

      // Hay movimiento si aparece alguna tx con la misma currency o que mencione la wallet.
      const hasMovement = transactions.some((tx) => {
        if (tx.currency === wallet.currency) return true;
        const meta = tx.metadata;
        if (meta === undefined) return false;
        const walletRef =
          typeof meta['walletId'] === 'string' ? meta['walletId'] :
          typeof meta['address'] === 'string' ? meta['address'] :
          undefined;
        return walletRef === wallet.id || walletRef === wallet.address;
      });
      if (hasMovement) continue;

      const opportunityCost = computeOpportunityCost(amount, this.analysisDays);
      result.push({
        category: 'crypto_wallet',
        currency: wallet.currency,
        amount: round2(amount),
        idleDays: this.analysisDays,
        opportunityCost: round2(opportunityCost),
        description: `Wallet ${wallet.currency} (${wallet.network}) con USD ${round2(amount)} sin movimiento en ${this.analysisDays} días.`,
        suggestedAction: `Convertí a USD y movelo a T-Bills, o usalo en una estrategia con yield (staking/lending).`,
      });
    }

    return result;
  }

  // Paso 3c: posiciones de inversión en renta fija estancadas.
  // Heurística: valor esperado = valorInicial * (1 + yieldDiario * días); si el valor
  // actual está por debajo, lo reportamos.
  private detectStagnantInvestments(positions: readonly StocksPosition[]): IdleAsset[] {
    const result: IdleAsset[] = [];
    for (const pos of positions) {
      if (!TREASURY_BILL_SYMBOLS.has(pos.symbol.toUpperCase())) continue;
      if (pos.averagePrice === undefined || pos.marketValue === undefined) continue;

      const quantity = parseAmount(pos.quantity);
      const avgPrice = parseAmount(pos.averagePrice);
      const marketValue = parseAmount(pos.marketValue);
      const initialValue = quantity * avgPrice;
      if (initialValue <= 0) continue;

      const expectedValue =
        initialValue * (1 + (TBILL_ANNUAL_YIELD / 365) * this.analysisDays);
      const shortfall = expectedValue - marketValue;
      if (shortfall <= 0) continue;

      // Sólo reportamos si la brecha supera el umbral; ruidos pequeños no valen alarma.
      if (shortfall < this.idleThresholdUsd / 10) continue;

      result.push({
        category: 'investment',
        currency: pos.currency ?? 'USD',
        amount: round2(marketValue),
        idleDays: this.analysisDays,
        opportunityCost: round2(shortfall),
        description: `Posición en ${pos.symbol} rindiendo por debajo de lo esperado (shortfall USD ${round2(shortfall)}).`,
        suggestedAction: `Revisá si la posición sigue siendo T-Bill corto o si quedó en un vehículo menos líquido.`,
      });
    }
    return result;
  }
}

function parseAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function computeOpportunityCost(amount: number, days: number): number {
  return amount * (TBILL_ANNUAL_YIELD / 365) * days;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
