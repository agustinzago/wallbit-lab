// POST /api/public/v1/api-key/revoke
//
// Revoca de manera permanente la API key usada en este request. No requiere
// scope: cualquier key válida puede auto-revocarse. Una vez revocada, todo
// request posterior con esa key responde 401.

import { z } from 'zod';
import type { HttpClient } from '../http.js';

// La spec no define shape exacta para el 200 del revoke. Aceptamos cualquier
// objeto y lo devolvemos tal cual (passthrough) — más robusto que `z.unknown()`.
const RevokeResponseSchema = z.record(z.unknown());

export class ApiKeyResource {
  constructor(private readonly http: HttpClient) {}

  async revoke(): Promise<Record<string, unknown>> {
    return this.http.request({
      method: 'POST',
      path: '/v1/api-key/revoke',
      body: {},
      schema: RevokeResponseSchema,
    });
  }
}
