// Jerarquía de errores tipados del SDK. Todos heredan de WallbitError para que el
// consumidor pueda hacer `catch (err) { if (err instanceof WallbitError) ... }`.

export interface WallbitErrorOptions {
  readonly cause?: unknown;
  readonly statusCode?: number | undefined;
  readonly requestId?: string | undefined;
}

export class WallbitError extends Error {
  readonly statusCode: number | undefined;
  readonly requestId: string | undefined;

  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'WallbitError';
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      requestId: this.requestId,
    };
  }
}

export class WallbitAuthError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitAuthError';
  }
}

// 412: según la spec cubre tres casos reales — KYC incompleto, cuenta bloqueada
// y cuenta migrando. El nombre histórico era WallbitKycError (cuando se asumía
// sólo KYC); ahora usamos `WallbitPreconditionError` y mantenemos el alias por
// compatibilidad hacia adentro.
export class WallbitPreconditionError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitPreconditionError';
  }
}
export { WallbitPreconditionError as WallbitKycError };

export class WallbitValidationError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitValidationError';
  }
}

export class WallbitNotFoundError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitNotFoundError';
  }
}

export class WallbitRateLimitError extends WallbitError {
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options: WallbitErrorOptions & { retryAfterSeconds?: number } = {},
  ) {
    super(message, options);
    this.name = 'WallbitRateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export class WallbitServerError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitServerError';
  }
}

export class WallbitNetworkError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitNetworkError';
  }
}
