import { z } from 'zod';
import type { HttpClient } from '../http.js';
import { AssetSchema, type Asset } from '../types.js';

// TODO(verify-api): envelope y si hay paginación para el catálogo de assets.
const GetAssetsResponseSchema = z.object({
  assets: z.array(AssetSchema),
});

export class AssetsResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Asset[]> {
    const res = await this.http.request({
      path: '/v1/assets',
      schema: GetAssetsResponseSchema,
    });
    return res.assets;
  }

  async getBySymbol(symbol: string): Promise<Asset> {
    // TODO(verify-api): path puede ser /assets?symbol=X en vez de /assets/:symbol
    return this.http.request({
      path: `/v1/assets/${encodeURIComponent(symbol)}`,
      schema: AssetSchema,
    });
  }
}
