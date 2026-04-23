// GET /api/public/v1/assets            (list, paginado)
// GET /api/public/v1/assets/{symbol}   (detail, envelope `data`)

import { z } from 'zod';
import type { HttpClient } from '../http.js';
import {
  AssetSchema,
  type Asset,
  type AssetCategory,
  type Paginated,
} from '../types.js';

const ListAssetsResponseSchema = z.object({
  data: z.array(AssetSchema),
  pages: z.number().int(),
  current_page: z.number().int(),
  count: z.number().int(),
});

const GetAssetResponseSchema = z.object({
  data: AssetSchema,
});

export interface ListAssetsParams {
  readonly category?: AssetCategory;
  readonly search?: string;
  readonly page?: number;
  // La spec: 1..50, default 10. Validación la hacemos del lado de la API.
  readonly limit?: number;
}

export type ListAssetsResult = Paginated<Asset>;

export class AssetsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params: ListAssetsParams = {}): Promise<ListAssetsResult> {
    const res = await this.http.request({
      path: '/v1/assets',
      query: {
        category: params.category,
        search: params.search,
        page: params.page,
        limit: params.limit,
      },
      schema: ListAssetsResponseSchema,
    });
    return {
      items: res.data,
      pages: res.pages,
      currentPage: res.current_page,
      count: res.count,
    };
  }

  async getBySymbol(symbol: string): Promise<Asset> {
    const res = await this.http.request({
      path: `/v1/assets/${encodeURIComponent(symbol)}`,
      schema: GetAssetResponseSchema,
    });
    return res.data;
  }
}
