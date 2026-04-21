import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../src/api/server.js';
import { loadConfig } from '../../src/support/config.js';

describe('Admin Operations Contract', () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3002',
    DATABASE_URL: 'postgres://bestprice:bestprice@localhost:5432/bestprice',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'development-only-session-secret',
    ADMIN_SEED_EMAIL: 'admin@example.com',
    ADMIN_SEED_PASSWORD: 'test-password-123',
  });

  let app: Awaited<ReturnType<typeof buildServer>>;
  let sessionToken: string;

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
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/admin/auth/login - Admin Authentication', () => {
    it('returns 200 with session token on successful login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'test-password-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('sessionToken');
      expect(payload.sessionToken).toBeTruthy();
      sessionToken = payload.sessionToken;
    });

    it('returns 401 on invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'wrong-password',
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = response.json();
      expect(payload).toHaveProperty('error');
    });

    it('returns 400 on missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          password: 'test-password-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/admin/overview - Admin Overview Dashboard', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with overview data when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('totalSources');
      expect(payload).toHaveProperty('activeSources');
      expect(payload).toHaveProperty('staleSources');
      expect(payload).toHaveProperty('recentFailures');
      expect(payload).toHaveProperty('unmatchedCount');
    });
  });

  describe('GET /api/v1/admin/sources - Source Health List', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with paginated source list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources?page=1&limit=10',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('sources');
      expect(Array.isArray(payload.sources)).toBe(true);
      expect(payload).toHaveProperty('total');
      expect(payload).toHaveProperty('page');
      expect(payload).toHaveProperty('limit');

      if (payload.sources.length > 0) {
        const source = payload.sources[0];
        expect(source).toHaveProperty('adapterId');
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('isStale');
        expect(source).toHaveProperty('lastCrawlAt');
        expect(source).toHaveProperty('lastFailureAt');
        expect(source).toHaveProperty('offerCount');
        expect(source).toHaveProperty('unmatchedCount');
      }
    });

    it('filters by stale status when requested', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources?isStale=true',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload.sources)).toBe(true);
      payload.sources.forEach((source: { isStale: boolean }) => {
        expect(source.isStale).toBe(true);
      });
    });
  });

  describe('GET /api/v1/admin/sources/:adapterId - Source Health Detail', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources/retailer-a',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with source detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources/retailer-a',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const payload = response.json();
        expect(payload).toHaveProperty('adapterId');
        expect(payload).toHaveProperty('name');
        expect(payload).toHaveProperty('lastCrawlAt');
        expect(payload).toHaveProperty('recentFailures');
        expect(Array.isArray(payload.recentFailures)).toBe(true);
      }
    });

    it('returns 404 for non-existent source', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources/non-existent-adapter',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/admin/crawl-jobs - Crawl Job History', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/crawl-jobs',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with crawl job list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/crawl-jobs?page=1&limit=20',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('crawlJobs');
      expect(Array.isArray(payload.crawlJobs)).toBe(true);
      expect(payload).toHaveProperty('total');

      if (payload.crawlJobs.length > 0) {
        const job = payload.crawlJobs[0];
        expect(job).toHaveProperty('jobId');
        expect(job).toHaveProperty('adapterId');
        expect(job).toHaveProperty('status');
        expect(['completed', 'failed', 'running']).toContain(job.status);
      }
    });
  });

  describe('POST /api/v1/admin/crawl-jobs/manual - Manual Crawl Trigger', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/crawl-jobs/manual',
        payload: {
          adapterIds: ['retailer-a'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with job reference on successful trigger', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/crawl-jobs/manual',
        payload: {
          adapterIds: ['retailer-a'],
        },
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([200, 202]).toContain(response.statusCode);
      if (response.statusCode === 200 || response.statusCode === 202) {
        const payload = response.json();
        expect(payload).toHaveProperty('jobId');
      }
    });

    it('returns 400 with empty adapter list', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/crawl-jobs/manual',
        payload: {
          adapterIds: [],
        },
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/admin/unmatched-products - Unmatched Product Queue', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 with paginated unmatched product list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products?page=1&limit=50',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('products');
      expect(Array.isArray(payload.products)).toBe(true);
      expect(payload).toHaveProperty('total');
      expect(payload).toHaveProperty('page');
      expect(payload).toHaveProperty('limit');

      if (payload.products.length > 0) {
        const product = payload.products[0];
        expect(product).toHaveProperty('rawProductId');
        expect(product).toHaveProperty('adapterId');
        expect(product).toHaveProperty('title');
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('url');
        expect(product).toHaveProperty('failureReason');
      }
    });

    it('filters by adapter when requested', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products?adapterId=retailer-a',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload.products)).toBe(true);
    });

    it('filters by failure reason when requested', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products?failureReason=PARSE_FAILURE',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload.products)).toBe(true);
    });
  });

  describe('POST /api/v1/admin/unmatched-products/:rawProductId/match - Manual Product Matching', () => {
    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/unmatched-products/raw-123/match',
        payload: {
          canonicalProductId: 'canonical-456',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 200 when manual match is successful', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/unmatched-products/raw-123/match',
        payload: {
          canonicalProductId: 'canonical-456',
        },
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([200, 404, 409]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/admin/auth/status - Session Status', () => {
    it('returns 200 with current admin info when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/status',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('adminId');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('role');
      expect(payload.role).toBe('admin');
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/status',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/admin/auth/logout - Session Logout', () => {
    it('returns 200 on successful logout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/logout',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Bilingual Support', () => {
    it('returns source health data in requested language', async () => {
      const enResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources?lang=en',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      const arResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources?lang=ar',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([200, 400]).toContain(enResponse.statusCode);
      expect([200, 400]).toContain(arResponse.statusCode);
    });
  });

  describe('Error Handling', () => {
    it('returns 400 on malformed JSON payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 405 on unsupported method', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(405);
    });
  });
});
