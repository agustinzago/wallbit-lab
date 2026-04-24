// Tipos públicos del merchant-classifier. Un MerchantInfo es la forma normalizada
// de un descriptor crudo (lo que viene en `external_address`/`merchantName` de la
// transacción), enriquecida con categoría, grupo funcional y confianza.

export type ServiceCategory =
  | 'productivity'
  | 'ai_tools'
  | 'cloud_storage'
  | 'entertainment'
  | 'development'
  | 'design'
  | 'communication'
  | 'security'
  | 'finance'
  | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MerchantInfo {
  readonly rawDescriptor: string;
  readonly normalizedName: string;
  readonly category: ServiceCategory;
  readonly isSaasSubscription: boolean;
  readonly functionalGroup?: string;
  readonly confidence: ConfidenceLevel;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
