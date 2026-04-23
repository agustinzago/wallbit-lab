// Núcleo del análisis de capital ocioso. Lee el estado financiero (checking y
// stocks), calcula un colchón dinámico a partir del burn rate real, y detecta
// dos categorías de ociosidad:
//  - checking: USD/USDT/USDC en cuenta corriente por encima del colchón.
//  - investment_cash: USD no invertido dentro de la cuenta de inversión
//    (aparece como `symbol: "USD"` en /balance/stocks).
//
// La categoría "crypto_wallet" que existía en v0.1 se removió: la API pública
// de Wallbit NO expone balance por wallet cripto (son sólo direcciones de
// depósito). El saldo cripto real del user vive en /balance/checking bajo
// USDT/USDC, y ya lo cubre el detector de checking.
//
// La detección de T-Bills estancadas también se removió por ahora: requiere
// cruzar /balance/stocks con /assets/{symbol} y reconstruir el average price
// desde transactions — demasiada lógica para v0.2. Lo abordamos cuando tengamos
// datos reales.

import type {
  CheckingBalance,
  StocksPosition,
  Transaction,
  WallbitClient,
} from '@wallbit-lab/sdk';
import type { TransactionPoller } from '@wallbit-lab/wallbit-ingest';
import { fetchDolares, midRate } from './dolarApi.js';

// Piso no negociable del colchón. Incluso si el gasto mensual es cero, dejamos
// este mínimo en checking antes de considerar cualquier saldo como ocioso.
const MIN_BUFFER_USD = 200;

// Rendimiento anual asumido de T-Bills cortas (SGOV/BIL/SHV). Referencia para
// costo de oportunidad, no una promesa.
const TBILL_ANNUAL_YIELD = 0.05;

// Tipos de transacción considerados "egresos" (gasto real del usuario). La API
// no publica un enum cerrado, así que matcheamos por prefijo/contiene: cubre
// WITHDRAWAL_LOCAL, WITHDRAWAL_CRYPTO, CARD_PAYMENT, FEE, etc., sin rompernos
// cuando aparezcan nuevos.
function isEgressType(type: string): boolean {
  const t = type.toUpperCase();
  if (t.startsWith('WITHDRAWAL')) return true;
  if (t.includes('CARD_PAYMENT') || t.includes('CARD_PURCHASE')) return true;
  if (t === 'FEE') return true;
  return false;
}

// Stablecoins USD-pegged: las tratamos 1:1 con USD para todas las cuentas.
const USD_LIKE = new Set(['USD', 'USDT', 'USDC']);

export type IdleCategory = 'checking' | 'investment_cash';

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
    const [checkingBalances, stocks, transactions, dolares] = await Promise.all([
      this.client.balance.getChecking(),
      this.client.balance.getStocks(),
      this.poller.fetchRecent({ days: this.analysisDays }),
      // Degradamos si DolarApi falla: no abortamos el análisis, sólo perdemos
      // la conversión ARS→USD para el burn rate.
      fetchDolares().catch(() => null),
    ]);

    // Preferimos el mid-rate del blue (referencia real del mercado informal).
    // Fallback: inferimos desde transacciones cross-currency propias. Si no hay
    // ninguna fuente, los gastos en ARS se ignoran (rate = 0).
    const arsToUsdRate =
      dolares !== null
        ? (midRate(dolares.blue) ?? 0) > 0
          ? 1 / (midRate(dolares.blue) as number)
          : 0
        : this.inferArsToUsdRate(transactions);

    const monthlyBurn = this.computeMonthlyBurnRate(transactions, arsToUsdRate);
    const recommendedBuffer = Math.max(
      MIN_BUFFER_USD,
      monthlyBurn * this.bufferMultiplier,
    );

    const idleAssets: IdleAsset[] = [
      ...this.detectIdleChecking(checkingBalances, recommendedBuffer),
      ...this.detectInvestmentCash(stocks),
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

  // Gasto mensual promedio en USD basado en los egresos del período. Normalizamos
  // a ventana de 30 días sobre `analysisDays` para obtener un "mes estandarizado".
  private computeMonthlyBurnRate(
    transactions: readonly Transaction[],
    arsToUsdRate: number,
  ): number {
    let totalUsd = 0;
    for (const tx of transactions) {
      if (!isEgressType(tx.type)) continue;
      const currency = tx.source_currency.code;
      const amount = Math.abs(tx.source_amount);
      if (USD_LIKE.has(currency)) {
        totalUsd += amount;
      } else if (currency === 'ARS' && arsToUsdRate > 0) {
        totalUsd += amount * arsToUsdRate;
      }
      // Otras monedas las ignoramos por ahora: señal débil, riesgo de ruido.
    }
    return (totalUsd / this.analysisDays) * 30;
  }

  // Fallback: inferimos el rate ARS→USD desde transacciones cross-currency del
  // propio período. Sólo se usa cuando DolarApi no está disponible.
  private inferArsToUsdRate(transactions: readonly Transaction[]): number {
    for (const tx of transactions) {
      const src = tx.source_currency.code;
      const dst = tx.dest_currency.code;
      if (src === 'ARS' && dst === 'USD' && tx.dest_amount > 0) {
        return tx.dest_amount / tx.source_amount;
      }
      if (src === 'USD' && dst === 'ARS' && tx.dest_amount > 0) {
        return tx.source_amount / tx.dest_amount;
      }
    }
    return 0;
  }

  // Checking ocioso: todo lo que esté en USD/USDT/USDC por encima del colchón.
  private detectIdleChecking(
    balances: readonly CheckingBalance[],
    buffer: number,
  ): IdleAsset[] {
    const result: IdleAsset[] = [];
    for (const bal of balances) {
      if (!USD_LIKE.has(bal.currency)) continue;
      const excess = bal.balance - buffer;
      if (excess > this.idleThresholdUsd) {
        const idleDays = this.analysisDays;
        const opportunityCost = computeOpportunityCost(excess, idleDays);
        result.push({
          category: 'checking',
          currency: bal.currency,
          amount: round2(excess),
          idleDays,
          opportunityCost: round2(opportunityCost),
          description: `Tenés USD ${round2(excess)} en checking (${bal.currency}) por encima del colchón recomendado (USD ${round2(buffer)}).`,
          suggestedAction:
            'Movelo a T-Bills cortos (SGOV o BIL) desde el dashboard de Wallbit → Inversiones, o depositalo a un Robo Advisor.',
        });
      }
    }
    return result;
  }

  // Cash dormido en cuenta de inversión: la API lo reporta como una posición
  // con `symbol: "USD"` dentro de /balance/stocks. Si está por encima del
  // threshold, es plata que se movió a "invertir" pero quedó sin asignar.
  private detectInvestmentCash(positions: readonly StocksPosition[]): IdleAsset[] {
    const result: IdleAsset[] = [];
    for (const pos of positions) {
      if (pos.symbol !== 'USD') continue;
      const amount = pos.shares;
      if (amount <= this.idleThresholdUsd) continue;
      const opportunityCost = computeOpportunityCost(amount, this.analysisDays);
      result.push({
        category: 'investment_cash',
        currency: 'USD',
        amount: round2(amount),
        idleDays: this.analysisDays,
        opportunityCost: round2(opportunityCost),
        description: `Tenés USD ${round2(amount)} sin invertir dentro de la cuenta de inversión.`,
        suggestedAction:
          'Comprá T-Bills cortos (SGOV, BIL) o asignalo a un Robo Advisor para que genere yield.',
      });
    }
    return result;
  }
}

function computeOpportunityCost(amount: number, days: number): number {
  return amount * (TBILL_ANNUAL_YIELD / 365) * days;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
