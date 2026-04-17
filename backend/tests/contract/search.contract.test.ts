import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../src/api/server.js';
import { createSearchService } from '../../src/search/search-service.js';
import { loadConfig } from '../../src/support/config.js';

describe('GET /search contract', () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgres://bestprice:bestprice@localhost:5432/bestprice',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'development-only-session-secret',
  });

  const searchService = createSearchService({
    now: () => new Date('2026-04-17T10:00:00.000Z'),
  });

  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer(config, {
      database: {
        ping: async () => true,
        close: async () => {},
      },
      queues: {
        ping: async () => true,
        close: async () => {},
      },
      searchService,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a grouped bilingual search response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=iphone&lang=en',
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();

    expect(payload).toMatchObject({
      query: 'iphone',
      detectedLanguage: 'en',
      page: 1,
      pageSize: 20,
    });
    expect(payload.totalResults).toBeGreaterThan(0);
    expect(payload.groups[0]).toMatchObject({
      productId: expect.any(String),
      canonicalName: expect.any(String),
      category: expect.any(String),
      brand: expect.any(String),
      badges: expect.arrayContaining(['best_overall']),
      bestOverallOffer: {
        offerId: expect.any(String),
        store: expect.any(String),
        priceEgp: expect.any(Number),
        availability: expect.any(String),
        lastUpdatedAt: expect.any(String),
      },
      exactOfferCount: expect.any(Number),
      lastUpdatedAt: expect.any(String),
    });
  });

  it('validates filter and paging query parameters from the contract', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=سامسونج&lang=ar&category=phones&brand=samsung&store=retailer-b&minPrice=20000&maxPrice=50000&page=1&pageSize=10',
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();

    expect(payload.query).toBe('سامسونج');
    expect(payload.pageSize).toBe(10);
    expect(payload.groups.every((group: { category: string; brand: string; bestOverallOffer: { store: string; priceEgp: number } }) => (
      group.category === 'Phones'
      && group.brand === 'Samsung'
      && group.bestOverallOffer.store === 'Retailer B'
      && group.bestOverallOffer.priceEgp >= 20000
      && group.bestOverallOffer.priceEgp <= 50000
    ))).toBe(true);
  });
});