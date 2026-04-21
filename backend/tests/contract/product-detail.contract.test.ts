import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../src/api/server.js';
import { runCrawlJob } from '../../src/jobs/crawl-job.js';
import { runSearchRefreshJob } from '../../src/jobs/search-index-job.js';
import { createSearchService } from '../../src/search/search-service.js';
import { loadConfig } from '../../src/support/config.js';

describe('Product route contract', () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgres://bestprice:bestprice@localhost:5432/bestprice',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'development-only-session-secret',
  });

  let app: Awaited<ReturnType<typeof buildServer>>;
  let productId: string;
  let offerId: string;
  const now = new Date('2026-04-17T10:00:00.000Z');
  const searchService = createSearchService({
    now: () => now,
  });

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

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=iphone&lang=en&page=1&pageSize=1',
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchPayload = searchResponse.json() as {
      groups: Array<{ productId: string }>;
    };

    expect(searchPayload.groups.length).toBeGreaterThan(0);

    productId = searchPayload.groups[0]!.productId;

    const offersResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/offers`,
    });

    expect(offersResponse.statusCode).toBe(200);
    const offersPayload = offersResponse.json() as {
      offers: Array<{ id: string }>;
    };

    offerId = offersPayload.offers[0]!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/products/:productId returns product detail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}?lang=en`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      id: string;
      title: string;
      category: string;
      brand: string;
      exactOffers: unknown[];
      similarProducts: unknown[];
      updatedAt: string;
    };

    expect(payload.id).toBe(productId);
    expect(payload.title).toEqual(expect.any(String));
    expect(payload.category).toEqual(expect.any(String));
    expect(payload.brand).toEqual(expect.any(String));
    expect(Array.isArray(payload.exactOffers)).toBe(true);
    expect(Array.isArray(payload.similarProducts)).toBe(true);
    expect(payload.updatedAt).toEqual(expect.any(String));
  });

  it('GET /api/v1/products/:productId/offers returns offers list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/offers`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      productId: string;
      offers: Array<{
        id: string;
        storeName: string;
        price: number;
        currency: string;
        freshness: {
          hoursOld: number;
          isStale: boolean;
        };
      }>;
    };

    expect(payload.productId).toBe(productId);
    expect(payload.offers.length).toBeGreaterThan(0);
    expect(payload.offers[0]).toMatchObject({
      id: expect.any(String),
      storeName: expect.any(String),
      price: expect.any(Number),
      currency: 'EGP',
      freshness: {
        hoursOld: expect.any(Number),
        isStale: expect.any(Boolean),
      },
    });
  });

  it('GET /api/v1/products/:productId/similar returns similar products', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/similar?limit=3`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      productId: string;
      products: Array<{
        id: string;
        title: string;
        matchConfidence: number;
        offers: unknown[];
      }>;
    };

    expect(payload.productId).toBe(productId);
    expect(Array.isArray(payload.products)).toBe(true);
    if (payload.products.length > 0) {
      expect(payload.products[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        matchConfidence: expect.any(Number),
      });
      expect(Array.isArray(payload.products[0].offers)).toBe(true);
    }
  });

  it('GET /api/v1/products/:productId/offers/:offerId/explanation returns explanation', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/offers/${offerId}/explanation`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      offerId: string;
      rankingReason: string;
      rankingScore: number;
      factors: unknown[];
      confidence: number;
    };

    expect(payload.offerId).toBe(offerId);
    expect(payload.rankingReason).toEqual(expect.any(String));
    expect(payload.rankingScore).toEqual(expect.any(Number));
    expect(Array.isArray(payload.factors)).toBe(true);
    expect(payload.confidence).toEqual(expect.any(Number));
  });

  it('returns 404 for unknown product', async () => {
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
