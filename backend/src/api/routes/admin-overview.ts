import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SourceHealthService } from '../services/source-health-service.js';
import { verifyAdminSession } from '../middleware/admin-auth.js';

/**
 * Admin overview routes
 * GET /api/v1/admin/overview - Admin dashboard overview
 */

const _overviewResponseSchema = z.object({
  totalSources: z.number(),
  activeSources: z.number(),
  staleSources: z.number(),
  recentFailures: z.array(z.object({
    jobId: z.string(),
    adapterId: z.string(),
    adapterName: z.string(),
    failedAt: z.string(),
    reason: z.string(),
  })),
  unmatchedCount: z.number(),
  lastUpdatedAt: z.string(),
});

export async function registerAdminOverviewRoutes(
  app: FastifyInstance,
  sourceHealthService: SourceHealthService,
) {
  /**
   * GET /api/v1/admin/overview
   * Get admin dashboard overview with source health summary
   */
  app.get<{ Reply: typeof _overviewResponseSchema._type | { error: string } }>(
    '/api/v1/admin/overview',
    {
      schema: {
        description: 'Admin dashboard overview',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              totalSources: { type: 'number' },
              activeSources: { type: 'number' },
              staleSources: { type: 'number' },
              recentFailures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    jobId: { type: 'string' },
                    adapterId: { type: 'string' },
                    adapterName: { type: 'string' },
                    failedAt: { type: 'string' },
                    reason: { type: 'string' },
                  },
                },
              },
              unmatchedCount: { type: 'number' },
              lastUpdatedAt: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const overview = await sourceHealthService.getOverview();

      return reply.send({
        totalSources: overview.totalSources,
        activeSources: overview.activeSources,
        staleSources: overview.staleSources,
        recentFailures: overview.recentFailures.map((f) => ({
          jobId: f.jobId,
          adapterId: f.adapterId,
          adapterName: f.adapterName,
          failedAt: f.failedAt.toISOString(),
          reason: f.reason,
        })),
        unmatchedCount: overview.unmatchedCount,
        lastUpdatedAt: overview.lastUpdatedAt.toISOString(),
      });
    },
  );
}

/**
 * Admin source health routes
 * GET /api/v1/admin/sources - List all sources with health data
 * GET /api/v1/admin/sources/:adapterId - Get single source health details
 */

const sourceHealthSchema = z.object({
  adapterId: z.string(),
  name: z.string(),
  isStale: z.boolean(),
  lastCrawlAt: z.string().nullable(),
  lastFailureAt: z.string().nullable(),
  offerCount: z.number(),
  unmatchedCount: z.number(),
  crawlIntervalMinutes: z.number(),
  recentCrawlJobs: z.array(z.object({
    jobId: z.string(),
    status: z.string(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    itemsProcessed: z.number(),
  })),
  recentFailures: z.array(z.object({
    failedAt: z.string(),
    reason: z.string(),
    retryCount: z.number(),
  })),
});

const sourceListSchema = z.object({
  sources: z.array(z.object({
    adapterId: z.string(),
    name: z.string(),
    isStale: z.boolean(),
    lastCrawlAt: z.string().nullable(),
    offerCount: z.number(),
    unmatchedCount: z.number(),
  })),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export async function registerAdminSourcesRoutes(
  app: FastifyInstance,
  sourceHealthService: SourceHealthService,
) {
  /**
   * GET /api/v1/admin/sources
   * Get paginated list of sources with health status
   */
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      isStale?: string;
    };
    Reply: typeof sourceListSchema._type | { error: string };
  }>(
    '/api/v1/admin/sources',
    {
      schema: {
        description: 'List sources with health status',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            isStale: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    adapterId: { type: 'string' },
                    name: { type: 'string' },
                    isStale: { type: 'boolean' },
                    lastCrawlAt: { type: ['string', 'null'] },
                    offerCount: { type: 'number' },
                    unmatchedCount: { type: 'number' },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const page = request.query.page ? parseInt(request.query.page, 10) : 1;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;
      const isStale = request.query.isStale === 'true' ? true : undefined;

      const result = await sourceHealthService.listSources({
        page,
        limit,
        isStale,
      });

      return reply.send(
        sourceListSchema.parse({
          sources: result.sources.map((s: {
            adapterId: string;
            name: string;
            isStale: boolean;
            lastCrawlAt: Date | string | null;
            offerCount: number;
            unmatchedCount: number;
          }) => ({
            adapterId: s.adapterId,
            name: s.name,
            isStale: s.isStale,
            lastCrawlAt: s.lastCrawlAt ? new Date(s.lastCrawlAt).toISOString() : null,
            offerCount: s.offerCount,
            unmatchedCount: s.unmatchedCount,
          })),
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    },
  );

  /**
   * GET /api/v1/admin/sources/:adapterId
   * Get detailed health information for a specific source
   */
  app.get<{
    Params: {
      adapterId: string;
    };
    Reply: typeof sourceHealthSchema._type | { error: string };
  }>(
    '/api/v1/admin/sources/:adapterId',
    {
      schema: {
        description: 'Get source health details',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            adapterId: { type: 'string' },
          },
          required: ['adapterId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              adapterId: { type: 'string' },
              name: { type: 'string' },
              isStale: { type: 'boolean' },
              lastCrawlAt: { type: ['string', 'null'] },
              lastFailureAt: { type: ['string', 'null'] },
              offerCount: { type: 'number' },
              unmatchedCount: { type: 'number' },
              crawlIntervalMinutes: { type: 'number' },
              recentCrawlJobs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    jobId: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    completedAt: { type: ['string', 'null'] },
                    itemsProcessed: { type: 'number' },
                  },
                },
              },
              recentFailures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    failedAt: { type: 'string' },
                    reason: { type: 'string' },
                    retryCount: { type: 'number' },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const health = await sourceHealthService.getSourceHealth(request.params.adapterId);

      if (!health) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      return reply.send(
        sourceHealthSchema.parse({
          adapterId: health.adapterId,
          name: health.name,
          isStale: health.isStale,
          lastCrawlAt: health.lastCrawlAt ? new Date(health.lastCrawlAt).toISOString() : null,
          lastFailureAt: health.lastFailureAt ? new Date(health.lastFailureAt).toISOString() : null,
          offerCount: health.offerCount,
          unmatchedCount: health.unmatchedCount,
          crawlIntervalMinutes: health.crawlIntervalMinutes,
          recentCrawlJobs: health.recentCrawlJobs.map((j) => ({
            jobId: j.jobId,
            status: j.status,
            startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : new Date(0).toISOString(),
            completedAt: j.completedAt ? new Date(j.completedAt).toISOString() : null,
            itemsProcessed: j.itemsProcessed || 0,
          })),
          recentFailures: health.recentFailures.map((f) => ({
            failedAt: new Date(f.failedAt).toISOString(),
            reason: f.reason,
            retryCount: f.retryCount,
          })),
        }),
      );
    },
  );
}
