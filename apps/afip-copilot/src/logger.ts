// Logger inyectable pino-style para afip-copilot.
// En v0.1 el sink es console (nivel configurable con LOG_LEVEL).

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger(level: LogLevel = 'info'): Logger {
  const minLevel = LEVELS[level] ?? 1;

  function log(logLevel: LogLevel, msg: string, meta?: Record<string, unknown>): void {
    if (LEVELS[logLevel] < minLevel) return;
    const entry = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
    const prefix = `[afip-copilot] [${logLevel.toUpperCase()}]`;
    console.error(`${prefix} ${entry}`);
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}
