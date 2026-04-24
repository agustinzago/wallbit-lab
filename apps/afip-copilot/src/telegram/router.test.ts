import { describe, it, expect, vi } from 'vitest';
import { parseCommand, dispatch } from './router.js';
import type { CommandContext } from './router.js';

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    args: [],
    rawText: '',
    db: {} as CommandContext['db'],
    fx: {} as CommandContext['fx'],
    config: {
      telegramChatId: '123456',
      fiscalYear: 2025,
      contribuyenteCumplidor: false,
      reibpAdherido: false,
      costBasisMethod: 'FIFO',
      dryRun: true,
      logLevel: 'info',
      wallbitApiKey: 'key',
      wallbitBaseUrl: undefined,
      telegramBotToken: 'token',
      databaseUrl: 'postgres://localhost/test',
      cashArBankArs: undefined,
      titulosPublicosArArs: undefined,
      dividendTxTypes: ['DIVIDEND'],
      taxpayerName: undefined,
      taxpayerCuit: undefined,
    },
    wallbit: {} as CommandContext['wallbit'],
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe('parseCommand', () => {
  it('parsea un comando simple', () => {
    expect(parseCommand('/start')).toEqual({ command: '/start', args: [] });
  });

  it('parsea comando con argumentos', () => {
    expect(parseCommand('/simulate AAPL 10')).toEqual({
      command: '/simulate',
      args: ['AAPL', '10'],
    });
  });

  it('elimina el @botname del comando', () => {
    expect(parseCommand('/start@MiBot')).toEqual({ command: '/start', args: [] });
  });

  it('retorna null si no empieza con /', () => {
    expect(parseCommand('hola bot')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });

  it('maneja espacios extra', () => {
    const result = parseCommand('  /help  ');
    expect(result?.command).toBe('/help');
  });
});

describe('dispatch', () => {
  it('/start responde con mensaje de bienvenida', async () => {
    const response = await dispatch('/start', makeCtx());
    expect(response).toContain('AFIP Copilot');
  });

  it('/help lista los comandos disponibles', async () => {
    const response = await dispatch('/help', makeCtx());
    expect(response).toContain('/status');
    expect(response).toContain('/ledger');
    expect(response).toContain('/simulate');
  });

  it('comando desconocido responde con mensaje de error útil', async () => {
    const response = await dispatch('/desconocido', makeCtx());
    expect(response).toContain('/help');
  });

  it('texto sin comando responde apropiadamente', async () => {
    const response = await dispatch('hola', makeCtx());
    expect(response).toContain('/help');
  });
});
