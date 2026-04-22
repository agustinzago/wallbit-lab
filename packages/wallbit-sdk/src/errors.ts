// Jerarquía de errores tipados del SDK. Todos heredan de WallbitError para que el
// usuario pueda hacer `catch (err) { if (err instanceof WallbitError) ... }`.

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

export class WallbitKycError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitKycError';
  }
}

export class WallbitValidationError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitValidationError';
  }
}

export class WallbitRateLimitError extends WallbitError {
  constructor(message: string, options: WallbitErrorOptions = {}) {
    super(message, options);
    this.name = 'WallbitRateLimitError';
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
