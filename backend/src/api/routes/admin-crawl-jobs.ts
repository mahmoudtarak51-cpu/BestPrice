import type { Queue } from 'bullmq';
import { and, count, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { sourceRegistry } from '../../adapters/source-registry.js';
import type { Database } from '../../db/client.js';
import { crawlJobs } from '../../db/schema.js';
import { verifyAdminSession } from '../middleware/admin-auth.js';

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

const manualCrawlResponseSchema = z.object({
  jobId: z.string(),
  adapterIds: z.array(z.string()),
  status: z.string(),
  message: z.string(),
});

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return 0;
}

export async function registerAdminCrawlJobsRoutes(
  app: FastifyInstance,
  database: Database,
  crawlQueue: Queue,
) {
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
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const page = request.query.page ? Number.parseInt(request.query.page, 10) : 1;
      const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 20;
      const offset = (page - 1) * limit;

      const predicates = [];
      if (request.query.adapterId) {
        predicates.push(eq(crawlJobs.sourceAdapterId, request.query.adapterId));
      }
      if (request.query.status) {
        predicates.push(eq(crawlJobs.status, request.query.status as never));
      }

      const whereClause = predicates.length ? and(...predicates) : undefined;

      const [{ total }] = await database
        .select({ total: count() })
        .from(crawlJobs)
        .where(whereClause);

      const jobs = await database
        .select({
          jobId: crawlJobs.id,
          adapterId: crawlJobs.sourceAdapterId,
          status: crawlJobs.status,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.finishedAt,
          itemsProcessed: crawlJobs.fetchedCount,
          itemsFailed: crawlJobs.failedCount,
          itemsMatched: crawlJobs.normalizedCount,
          triggeredByAdmin: crawlJobs.triggeredByAdminId,
        })
        .from(crawlJobs)
        .where(whereClause)
        .orderBy(desc(crawlJobs.startedAt))
        .limit(limit)
        .offset(offset);

      return reply.send(
        crawlJobListSchema.parse({
          crawlJobs: jobs.map((job) => ({
            jobId: job.jobId,
            adapterId: job.adapterId,
            status: job.status,
            startedAt: job.startedAt?.toISOString() ?? new Date(0).toISOString(),
            completedAt: job.completedAt ? job.completedAt.toISOString() : null,
            itemsProcessed: toNumber(job.itemsProcessed),
            itemsFailed: toNumber(job.itemsFailed),
            itemsMatched: toNumber(job.itemsMatched),
            triggeredByAdmin: job.triggeredByAdmin,
          })),
          total: toNumber(total),
          page,
          limit,
        }),
      );
    },
  );

  app.post<{
    Body: {
      adapterIds: string[];
    };
    Reply: typeof manualCrawlResponseSchema._type | { error: string };
  }>(
    '/api/v1/admin/crawl-jobs/manual',
    {
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const adapterIds = request.body.adapterIds ?? [];
      if (!adapterIds.length) {
        return reply.status(400).send({ error: 'At least one adapter must be specified' });
      }

      const uniqueAdapterIds = [...new Set(adapterIds)];
      const validAdapterIds = uniqueAdapterIds.filter((adapterId) => sourceRegistry.has(adapterId));
      if (validAdapterIds.length === 0) {
        return reply.status(404).send({ error: 'No valid adapters found' });
      }

      const adminUserId = request.adminSession?.adminUserId ?? null;
      const createdJobIds: string[] = [];

      for (const adapterId of validAdapterIds) {

        const inserted = await database
          .insert(crawlJobs)
          .values({
            sourceAdapterId: adapterId,
            triggeredByAdminId: adminUserId,
            jobType: 'manual',
            status: 'queued',
            scheduledFor: new Date(),
          })
          .returning({ id: crawlJobs.id });

        const insertedJobId = inserted[0]?.id;
        if (!insertedJobId) {
          continue;
        }

        createdJobIds.push(insertedJobId);

        await crawlQueue.add(
          'crawl',
          {
            adapterId,
            adapterKey: adapterId,
            runType: 'manual',
            triggeredByAdminId: adminUserId,
          },
          {
            jobId: insertedJobId,
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
          jobId: createdJobIds[0] ?? `manual-${Date.now()}`,
          adapterIds: validAdapterIds,
          status: 'queued',
          message: 'Crawl jobs have been enqueued',
        }),
      );
    },
  );

  app.get<{
    Params: {
      jobId: string;
    };
    Reply: typeof crawlJobSchema._type | { error: string };
  }>(
    '/api/v1/admin/crawl-jobs/:jobId',
    {
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const rows = await database
        .select({
          jobId: crawlJobs.id,
          adapterId: crawlJobs.sourceAdapterId,
          status: crawlJobs.status,
          startedAt: crawlJobs.startedAt,
          completedAt: crawlJobs.finishedAt,
          itemsProcessed: crawlJobs.fetchedCount,
          itemsFailed: crawlJobs.failedCount,
          itemsMatched: crawlJobs.normalizedCount,
          triggeredByAdmin: crawlJobs.triggeredByAdminId,
        })
        .from(crawlJobs)
        .where(eq(crawlJobs.id, request.params.jobId))
        .limit(1);

      if (!rows.length) {
        return reply.status(404).send({ error: 'Crawl job not found' });
      }

      const job = rows[0];
      return reply.send(
        crawlJobSchema.parse({
          jobId: job.jobId,
          adapterId: job.adapterId,
          status: job.status,
          startedAt: job.startedAt?.toISOString() ?? new Date(0).toISOString(),
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
          itemsProcessed: toNumber(job.itemsProcessed),
          itemsFailed: toNumber(job.itemsFailed),
          itemsMatched: toNumber(job.itemsMatched),
          triggeredByAdmin: job.triggeredByAdmin,
        }),
      );
    },
  );
}
