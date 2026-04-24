// Helper para enviar documentos por Telegram usando multipart/form-data.
// No hay helper equivalente en @wallbit-lab/notify (outbound solo, no documentos).
// Regla: no abstraer prematuramente — si otra app lo necesita, se mueve a notify.

import type { AppConfig } from '../config.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface SendDocumentOptions {
  readonly filename: string;
  readonly content: string;
  readonly mimeType: string;
}

export async function sendTelegramDocument(
  config: AppConfig,
  opts: SendDocumentOptions,
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}/bot${config.telegramBotToken}/sendDocument`;

  const form = new FormData();
  form.append('chat_id', config.telegramChatId);
  form.append(
    'document',
    new Blob([opts.content], { type: opts.mimeType }),
    opts.filename,
  );

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch (err) {
    throw new Error(
      `sendDocument: fallo de red enviando "${opts.filename}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`sendDocument: Telegram rechazó el documento (HTTP ${res.status}): ${body}`);
  }
}
