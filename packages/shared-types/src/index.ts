// Tipos compartidos entre apps que NO son específicos del dominio Wallbit.
// (Los tipos de la API viven en @wallbit-lab/sdk.)

export type CurrencyCode = string;

export interface MonetaryAmount {
  readonly currency: CurrencyCode;
  readonly value: string;
}

// Formateo básico y predecible. No intenta ser locale-aware: es para logs y
// mensajes internos, no para UI final.
export function formatAmount(amount: MonetaryAmount): string {
  return `${amount.value} ${amount.currency}`;
}

export type NotificationChannelKind = 'telegram' | 'email' | 'console';

export interface NotificationChannel {
  readonly kind: NotificationChannelKind;
  send(message: string): Promise<void>;
}

export interface UserConfig {
  readonly userId: string;
  readonly channels: readonly NotificationChannel[];
  readonly timezone?: string;
}
