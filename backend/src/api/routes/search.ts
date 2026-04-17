import type { FastifyInstance } from 'fastify';

import {
  searchQuerystringSchema,
  searchResponseSchema,
} from '../schemas/search.js';

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    `${app.appConfig.apiBasePath}/search`,
    {
      schema: {
        tags: ['Shopper'],
        summary: 'Search grouped products',
        querystring: searchQuerystringSchema,
        response: {
          200: searchResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        q: string;
        lang?: 'auto' | 'ar' | 'en';
        category?: string;
        brand?: string;
        store?: string;
        minPrice?: number;
        maxPrice?: number;
        page?: number;
        pageSize?: number;
      };

      return app.searchService.search({
        query: query.q,
        lang: query.lang,
        category: query.category,
        brand: query.brand,
        store: query.store,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        page: query.page,
        pageSize: query.pageSize,
      });
    },
  );
}