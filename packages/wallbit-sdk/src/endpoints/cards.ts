// GET /api/public/v1/cards              (list)
// PATCH /api/public/v1/cards/{uuid}     (update status — requiere scope `trade`)
//
// La spec documenta `GET /cards` y menciona una operación "Update Card Status"
// con body `{ status: ACTIVE|SUSPENDED }`. El path exacto más probable es
// `PATCH /cards/{uuid}`; si Wallbit lo mueve a otro verbo, ajustar acá.

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { CardSchema, CardStatusSchema, type Card, type CardStatus } from '../types.js';

const ListCardsResponseSchema = z.object({
  data: z.array(CardSchema),
});

const UpdateCardResponseSchema = z.object({
  data: CardSchema,
});

export class CardsResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Card[]> {
    const res = await this.http.request({
      path: '/v1/cards',
      schema: ListCardsResponseSchema,
    });
    return res.data;
  }

  // TODO(verify-api): confirmar verb/path exactos al probar contra la API real.
  async updateStatus(uuid: string, status: CardStatus): Promise<Card> {
    // Sanitizamos en cliente para no mandar strings arbitrarios en el path.
    CardStatusSchema.parse(status);
    const res = await this.http.request({
      method: 'PATCH',
      path: `/v1/cards/${encodeURIComponent(uuid)}`,
      body: { status },
      schema: UpdateCardResponseSchema,
    });
    return res.data;
  }
}
