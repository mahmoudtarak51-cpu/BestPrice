import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../src/api/server.js';
import { runCrawlJob } from '../../src/jobs/crawl-job.js';
import { runSearchRefreshJob } from '../../src/jobs/search-index-job.js';
import { createSearchService } from '../../src/search/search-service.js';
import { loadConfig } from '../../src/support/config.js';

describe('Product Detail Flow Integration', () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3003',
    DATABASE_URL: 'postgres://bestprice:bestprice@localhost:5432/bestprice',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'development-only-session-secret',
  });

  const now = new Date('2026-04-17T10:00:00.000Z');
  const searchService = createSearchService({
    now: () => now,
  });

  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    await runCrawlJob({
      searchService,
      scheduledAt: now,
    });

    await runSearchRefreshJob({
      searchService,
      refreshedAt: now,
    });

    app = await buildServer(config, {
      searchService,
      database: {
        db: {} as never,
        ping: async () => true,
        close: async () => {},
      } as never,
      queues: {
        ping: async () => true,
        close: async () => {},
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('search to product detail flow returns coherent data across endpoints', async () => {
    const searchResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=iphone&lang=en&page=1&pageSize=1',
    });

    expect(searchResponse.statusCode).toBe(200);

    const searchPayload = searchResponse.json() as {
      groups: Array<{
        productId: string;
      }>;
    };

    expect(searchPayload.groups.length).toBeGreaterThan(0);
    const productId = searchPayload.groups[0]!.productId;

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}?lang=en`,
    });

    expect(detailResponse.statusCode).toBe(200);

    const detailPayload = detailResponse.json() as {
      id: string;
      exactOffers: Array<{ id: string }>;
      similarProducts: unknown[];
    };

    expect(detailPayload.id).toBe(productId);
    expect(detailPayload.exactOffers.length).toBeGreaterThan(0);
    expect(Array.isArray(detailPayload.similarProducts)).toBe(true);

    const offersResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/offers`,
    });

    expect(offersResponse.statusCode).toBe(200);

    const offersPayload = offersResponse.json() as {
      productId: string;
      offers: Array<{
        id: string;
        rankingReason: string;
      }>;
    };

    expect(offersPayload.productId).toBe(productId);
    expect(offersPayload.offers.length).toBeGreaterThan(0);

    const offerId = offersPayload.offers[0]!.id;

    const explanationResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/offers/${offerId}/explanation`,
    });

    expect(explanationResponse.statusCode).toBe(200);

    const explanationPayload = explanationResponse.json() as {
      offerId: string;
      rankingReason: string;
      confidence: number;
    };

    expect(explanationPayload.offerId).toBe(offerId);
    expect(['best_overall', 'cheapest']).toContain(explanationPayload.rankingReason);
    expect(explanationPayload.confidence).toBeGreaterThan(0);
  });

  it('returns a stable 404 contract for unknown product', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/products/00000000-0000-4000-8000-999999999999',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Product not found',
      code: 'PRODUCT_NOT_FOUND',
    });
  });
});
