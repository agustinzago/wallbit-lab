// POST /api/public/v1/fees
//
// Sí, POST aunque sea read: la spec lo define así (el body lleva el `type`).
// Response: `{ data: FeeSetting }` O `{ data: [] }` cuando no hay fila para el
// tier del user. Devolvemos `null` en el caso vacío para que el consumidor lo
// discrimine sin checkear arrays.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  FeeSettingSchema,
  type FeeSetting,
  type FeeType,
} from '../types.js';

// `data` es un oneOf: el objeto poblado, o un array vacío. Usamos un union
// laxo; el discriminador es `Array.isArray`.
const GetFeesResponseSchema = z.object({
  data: z.union([FeeSettingSchema, z.array(z.unknown()).length(0)]),
});

export interface GetFeesParams {
  readonly type: FeeType;
}

export class FeesResource {
  constructor(private readonly http: HttpClient) {}

  async get(params: GetFeesParams): Promise<FeeSetting | null> {
    const res = await this.http.request({
      method: 'POST',
      path: '/v1/fees',
      body: { type: params.type },
      schema: GetFeesResponseSchema,
    });
    if (Array.isArray(res.data)) return null;
    return res.data;
  }
}
