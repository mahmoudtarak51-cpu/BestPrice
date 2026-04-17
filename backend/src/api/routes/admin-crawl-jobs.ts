import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import { crawlJobsTable } from '../../db/schema.js';
import { verifyAdminSession } from '../middleware/admin-auth.js';

/**
 * Admin crawl job routes
 * GET /api/v1/admin/crawl-jobs - List crawl job history
 * POST /api/v1/admin/crawl-jobs/manual - Trigger manual crawl
 * GET /api/v1/admin/crawl-jobs/:jobId - Get job details
 */

const crawlJobSchema = z.object({
  jobId: z.string(),
  adapterId: z.string(),
  status: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  itemsProcessed: z.number(),
  itemsFailed: z.number(),
  itemsMatched: z.number(),
  triggeredByAdmin: z.string().nullable(),
});

const crawlJobListSchema = z.object({
  crawlJobs: z.array(crawlJobSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const manualCrawlSchema = z.object({
  adapterIds: z.array(z.string()).min(1, 'At least one adapter must be selected'),
});

const manualCrawlResponseSchema = z.object({
  jobId: z.string(),
  adapterIds: z.array(z.string()),
  status: z.string(),
  message: z.string(),
});

export async function registerAdminCrawlJobsRoutes(
  app: FastifyInstance,
  database: Database,
  crawlQueue: Queue,
  adminId: string,
) {
  /**
   * GET /api/v1/admin/crawl-jobs
   * Get paginated crawl job history
   */
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      adapterId?: string;
      status?: string;
    };
    Reply: typeof crawlJobListSchema._type;
  }>(
    '/api/v1/admin/crawl-jobs',
    {
      schema: {
        description: 'Get crawl job history',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            adapterId: { type: 'string' },
            status: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              crawlJobs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    jobId: { type: 'string' },
                    adapterId: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    completedAt: { type: ['string', 'null'] },
                    itemsProcessed: { type: 'number' },
                    itemsFailed: { type: 'number' },
                    itemsMatched: { type: 'number' },
                    triggeredByAdmin: { type: ['string', 'null'] },
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
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      const offset = (page - 1) * limit;

      let query = database
        .select()
        .from(crawlJobsTable)
        .orderBy(desc(crawlJobsTable.started_at));

      if (request.query.adapterId) {
        query = query.where(eq(crawlJobsTable.adapter_id, request.query.adapterId));
      }

      if (request.query.status) {
        query = query.where(eq(crawlJobsTable.status, request.query.status));
      }

      // Get total count
      const countResult = await database.query.crawlJobsTable.findMany({
        limit: Number.MAX_SAFE_INTEGER,
      });
      const total = countResult.length;

      // Get paginated results
      const jobs = await query.limit(limit).offset(offset);

      return reply.send(
        crawlJobListSchema.parse({
          crawlJobs: jobs.map(job => ({
            jobId: job.id,
            adapterId: job.adapter_id,
            status: job.status,
            startedAt: job.started_at.toISOString(),
            completedAt: job.completed_at ? new Date(job.completed_at).toISOString() : null,
            itemsProcessed: job.items_processed || 0,
            itemsFailed: job.items_failed || 0,
            itemsMatched: job.items_matched || 0,
            triggeredByAdmin: job.triggered_by_admin_id,
          })),
          total,
          page,
          limit,
        }),
      );
    },
  );

  /**
   * POST /api/v1/admin/crawl-jobs/manual
   * Trigger a manual crawl for specified adapters
   */
  app.post<{
    Body: typeof manualCrawlSchema._type;
    Reply: typeof manualCrawlResponseSchema._type;
  }>(
    '/api/v1/admin/crawl-jobs/manual',
    {
      schema: {
        description: 'Trigger manual crawl for adapters',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            adapterIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
          required: ['adapterIds'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              adapterIds: { type: 'array', items: { type: 'string' } },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
          202: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              adapterIds: { type: 'array', items: { type: 'string' } },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
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
      const { adapterIds } = request.body;

      if (!adapterIds || adapterIds.length === 0) {
        return reply.status(400).send({ error: 'At least one adapter must be specified' });
      }

      // Get admin ID from session (would come from verified session)
      const currentAdminId = (request as any).adminId || 'system';

      // Create crawl job entries in database
      const jobId = `manual-crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        // For each adapter, create a job record and enqueue crawl
        for (const adapterId of adapterIds) {
          const job = await database
            .insert(crawlJobsTable)
            .values({
              id: `${jobId}-${adapterId}`,
              adapter_id: adapterId,
              status: 'queued',
              started_at: new Date(),
              triggered_by_admin_id: currentAdminId,
            })
            .returning();

          // Enqueue the crawl job
          await crawlQueue.add(
            'crawl',
            {
              adapterId,
              jobId: job[0].id,
              manual: true,
              triggeredByAdminId: currentAdminId,
            },
            {
              jobId: job[0].id,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );
        }

        return reply.status(202).send(
          manualCrawlResponseSchema.parse({
            jobId,
            adapterIds,
            status: 'queued',
            message: 'Crawl jobs have been enqueued',
          }),
        );
      } catch (error) {
        app.log.error('Failed to enqueue manual crawl', error);
        return reply.status(500).send({ error: 'Failed to enqueue crawl jobs' });
      }
    },
  );

  /**
   * GET /api/v1/admin/crawl-jobs/:jobId
   * Get details for a specific crawl job
   */
  app.get<{
    Params: {
      jobId: string;
    };
    Reply: typeof crawlJobSchema._type;
  }>(
    '/api/v1/admin/crawl-jobs/:jobId',
    {
      schema: {
        description: 'Get crawl job details',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              adapterId: { type: 'string' },
              status: { type: 'string' },
              startedAt: { type: 'string' },
              completedAt: { type: ['string', 'null'] },
              itemsProcessed: { type: 'number' },
              itemsFailed: { type: 'number' },
              itemsMatched: { type: 'number' },
              triggeredByAdmin: { type: ['string', 'null'] },
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
      const jobs = await database
        .select()
        .from(crawlJobsTable)
        .where(eq(crawlJobsTable.id, request.params.jobId));

      if (jobs.length === 0) {
        return reply.status(404).send({ error: 'Crawl job not found' });
      }

      const job = jobs[0];

      return reply.send(
        crawlJobSchema.parse({
          jobId: job.id,
          adapterId: job.adapter_id,
          status: job.status,
          startedAt: job.started_at.toISOString(),
          completedAt: job.completed_at ? new Date(job.completed_at).toISOString() : null,
          itemsProcessed: job.items_processed || 0,
          itemsFailed: job.items_failed || 0,
          itemsMatched: job.items_matched || 0,
          triggeredByAdmin: job.triggered_by_admin_id,
        }),
      );
    },
  );
}
