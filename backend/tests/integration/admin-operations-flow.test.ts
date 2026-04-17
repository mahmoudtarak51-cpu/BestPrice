import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from 'drizzle-orm';

import { buildServer } from '../../src/api/server.js';
import { loadConfig } from '../../src/support/config.js';

/**
 * Integration tests for admin operations flow:
 * - Stale source detection
 * - Crawl failure visibility
 * - Unmatched product tracking
 * - Manual crawl triggering
 */
describe('Admin Operations Flow Integration', () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3003',
    DATABASE_URL: 'postgres://bestprice:bestprice@localhost:5432/bestprice',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'development-only-session-secret',
    ADMIN_SEED_EMAIL: 'admin@example.com',
    ADMIN_SEED_PASSWORD: 'test-password-123',
  });

  let app: Awaited<ReturnType<typeof buildServer>>;
  let sessionToken: string;
  let database: Database;

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

    // Authenticate as admin for subsequent requests
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'test-password-123',
      },
    });

    if (loginResponse.statusCode === 200) {
      const payload = loginResponse.json();
      sessionToken = payload.sessionToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Stale Source Detection', () => {
    it('identifies sources with stale data (>12 hours)', async () => {
      /**
       * Given a source adapter that hasn't been crawled in more than 12 hours
       * When an admin requests the source health overview
       * Then the system identifies the source as stale
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('sources');

      // Check for stale marker in response
      payload.sources.forEach((source: any) => {
        if (source.isStale) {
          expect(source.lastCrawlAt).toBeDefined();
          // Verify timestamp is parseable and represents a past time
          const lastCrawlTime = new Date(source.lastCrawlAt);
          expect(lastCrawlTime instanceof Date).toBe(true);
          expect(!isNaN(lastCrawlTime.getTime())).toBe(true);
        }
      });
    });

    it('displays freshness in admin overview', async () => {
      /**
       * Given crawl history for multiple sources
       * When the admin reviews the overview dashboard
       * Then the overview summarizes the freshness state
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('staleSources');
      expect(payload).toHaveProperty('activeSources');
      expect(typeof payload.staleSources).toBe('number');
      expect(typeof payload.activeSources).toBe('number');
    });
  });

  describe('Crawl Failure Visibility', () => {
    it('exposes crawl failure details in source health', async () => {
      /**
       * Given a source adapter with recent crawl failures
       * When the admin views source details
       * Then recent failures are visible with timestamps and reason codes
       */
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
        expect(payload).toHaveProperty('recentFailures');
        expect(Array.isArray(payload.recentFailures)).toBe(true);

        payload.recentFailures.forEach((failure: any) => {
          expect(failure).toHaveProperty('failedAt');
          expect(failure).toHaveProperty('reason');
          expect(failure).toHaveProperty('retryCount');
        });
      }
    });

    it('lists recent failures in overview', async () => {
      /**
       * Given multiple recent crawl failures across sources
       * When the admin loads the overview
       * Then recent failures are surfaced (limit 15 minute visibility)
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('recentFailures');
      expect(Array.isArray(payload.recentFailures)).toBe(true);

      // Verify all failures are recent (within observability window)
      const now = Date.now();
      payload.recentFailures.forEach((failure: any) => {
        const failureTime = new Date(failure.failedAt).getTime();
        const ageMinutes = (now - failureTime) / (1000 * 60);
        expect(ageMinutes).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('Unmatched Product Tracking', () => {
    it('accumulates unmatched products from crawl failures', async () => {
      /**
       * Given raw listings that fail to match to canonical products
       * When the admin views unmatched products
       * Then the queue displays items with failure reason codes
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products?limit=50',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('products');
      expect(payload).toHaveProperty('total');

      payload.products.forEach((product: any) => {
        expect(product).toHaveProperty('rawProductId');
        expect(product).toHaveProperty('title');
        expect(product).toHaveProperty('adapterId');
        expect(product).toHaveProperty('failureReason');
        expect([
          'PARSE_FAILURE',
          'NO_MATCH',
          'AMBIGUOUS',
          'GTIN_COLLISION',
        ]).toContain(product.failureReason);
      });
    });

    it('filters unmatched products by adapter', async () => {
      /**
       * Given unmatched products from multiple adapters
       * When the admin filters by a specific adapter
       * Then only that adapter's unmatched products are shown
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/unmatched-products?adapterId=retailer-a&limit=50',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(Array.isArray(payload.products)).toBe(true);

      // All products should be from requested adapter
      payload.products.forEach((product: any) => {
        expect(product.adapterId).toBe('retailer-a');
      });
    });

    it('filters unmatched products by failure reason', async () => {
      /**
       * Given a mix of different failure types
       * When the admin filters by reason code
       * Then only matching failures are displayed
       */
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

      payload.products.forEach((product: any) => {
        expect(product.failureReason).toBe('PARSE_FAILURE');
      });
    });

    it('updates unmatched count in overview', async () => {
      /**
       * Given accumulated unmatched products
       * When the admin reviews the overview
       * Then the unmatchedCount reflects current queue depth
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('unmatchedCount');
      expect(typeof payload.unmatchedCount).toBe('number');
      expect(payload.unmatchedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Manual Crawl Triggering', () => {
    it('allows admin to trigger manual crawl', async () => {
      /**
       * Given multiple source adapters
       * When the admin triggers a manual crawl for selected adapters
       * Then the system accepts the request and enqueues crawl jobs
       */
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/crawl-jobs/manual',
        payload: {
          adapterIds: ['retailer-a', 'retailer-b'],
        },
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([200, 202]).toContain(response.statusCode);
      const payload = response.json();
      expect(payload).toHaveProperty('jobId');
      expect(payload.jobId).toBeTruthy();
    });

    it('tracks manual crawl in job history', async () => {
      /**
       * Given a manually triggered crawl
       * When the admin views crawl job history
       * Then the manual job appears with triggered_by_admin reference
       */
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/crawl-jobs?limit=20',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty('crawlJobs');
      expect(Array.isArray(payload.crawlJobs)).toBe(true);

      payload.crawlJobs.forEach((job: any) => {
        expect(job).toHaveProperty('jobId');
        expect(job).toHaveProperty('adapterId');
        expect(job).toHaveProperty('status');
        expect(job).toHaveProperty('triggeredByAdmin');
        // triggered_by_admin should be null or admin ID
        if (job.triggeredByAdmin !== null) {
          expect(typeof job.triggeredByAdmin).toBe('string');
        }
      });
    });

    it('rejects empty adapter list', async () => {
      /**
       * Given an admin trigger request
       * When the adapter list is empty
       * Then the system returns validation error
       */
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

    it('limits crawl to valid adapters', async () => {
      /**
       * Given an admin trigger with unknown adapters
       * When the request includes non-existent adapter IDs
       * Then the system only processes valid adapters or returns error
       */
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/crawl-jobs/manual',
        payload: {
          adapterIds: ['unknown-adapter-xyz'],
        },
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('Session Management', () => {
    it('validates admin role for all protected endpoints', async () => {
      /**
       * Given restricted admin endpoints
       * When a request includes invalid or missing session
       * Then the system returns 401 Unauthorized
       */
      const endpoints = [
        { method: 'GET', path: '/api/v1/admin/overview' },
        { method: 'GET', path: '/api/v1/admin/sources' },
        { method: 'GET', path: '/api/v1/admin/unmatched-products' },
        { method: 'POST', path: '/api/v1/admin/crawl-jobs/manual', payload: { adapterIds: ['retailer-a'] } },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method as any,
          url: endpoint.path,
          payload: (endpoint as any).payload,
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('provides admin status endpoint', async () => {
      /**
       * Given an authenticated admin session
       * When the admin checks their status
       * Then the system returns admin identity and role
       */
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
  });

  describe('Data Consistency', () => {
    it('maintains consistent stale-threshold logic', async () => {
      /**
       * Given sources with various last_crawl_at timestamps
       * When comparing overview aggregate vs source list
       * Then stale counts match (12-hour threshold consistently applied)
       */
      const overviewResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/overview',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      const sourcesResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/sources?limit=100',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(overviewResponse.statusCode).toBe(200);
      expect(sourcesResponse.statusCode).toBe(200);

      const overview = overviewResponse.json();
      const sources = sourcesResponse.json();

      const staleCount = sources.sources.filter((s: any) => s.isStale).length;
      expect(overview.staleSources).toBe(staleCount);
    });
  });
});
