// Tipos públicos del recurrence-engine.

export type RecurrenceCadence = 'monthly' | 'annual' | 'irregular';

export interface TransactionOccurrence {
  readonly transactionId: string;
  readonly date: Date;
  readonly amount: number;
  readonly currency: string;
}

export interface RecurringCharge {
  readonly merchantDescriptor: string;
  readonly rawDescriptor: string;
  readonly cadence: RecurrenceCadence;
  readonly occurrences: readonly TransactionOccurrence[];
  readonly averageAmount: number;
  readonly lastAmount: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly priceIncreasePercent?: number;
  readonly hasPriceIncrease: boolean;
  readonly daysSinceLastCharge: number;
}
