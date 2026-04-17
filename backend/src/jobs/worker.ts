import { Worker, type Job } from 'bullmq';

import { loadConfig } from '../support/config.js';
import { createLogger, withBindings } from '../support/logger.js';
import { isMainModule } from '../support/runtime.js';
import {
  createRedisConnection,
  CRAWL_QUEUE_NAME,
  MANUAL_CRAWL_QUEUE_NAME,
  SEARCH_INDEX_QUEUE_NAME,
  type CrawlJobPayload,
  type ManualCrawlJobPayload,
  type SearchIndexJobPayload,
} from './queue.js';

export type WorkerRegistry = ReturnType<typeof registerWorkers>;

export function registerWorkers(config = loadConfig()) {
  const logger = createLogger('bestprice-worker', config.logLevel);
  const prefix = config.queuePrefix;
  const baseConnection = createRedisConnection(config.redisUrl);

  const workers = {
    crawl: new Worker<CrawlJobPayload>(
      CRAWL_QUEUE_NAME,
      async (job) => processCrawlJob(job, logger),
      {
        connection: baseConnection.duplicate(),
        prefix,
        concurrency: 1,
      },
    ),
    searchIndex: new Worker<SearchIndexJobPayload>(
      SEARCH_INDEX_QUEUE_NAME,
      async (job) => processSearchIndexJob(job, logger),
      {
        connection: baseConnection.duplicate(),
        prefix,
        concurrency: 2,
      },
    ),
    manualCrawl: new Worker<ManualCrawlJobPayload>(
      MANUAL_CRAWL_QUEUE_NAME,
      async (job) => processManualCrawlJob(job, logger),
      {
        connection: baseConnection.duplicate(),
        prefix,
        concurrency: 1,
      },
    ),
  };

  for (const [queue, worker] of Object.entries(workers)) {
    const workerLogger = withBindings(logger, { queue });

    worker.on('completed', (job) => {
      workerLogger.info({ jobId: job.id }, 'Background job completed.');
    });

    worker.on('failed', (job, error) => {
      workerLogger.error(
        { jobId: job?.id, err: error },
        'Background job failed.',
      );
    });
  }

  return {
    workers,
    async close(): Promise<void> {
      await Promise.all(Object.values(workers).map((worker) => worker.close()));
      await baseConnection.quit();
    },
  };
}

async function processCrawlJob(
  job: Job<CrawlJobPayload>,
  logger: ReturnType<typeof createLogger>,
) {
  logger.info(
    {
      jobId: job.id,
      adapterId: job.data.adapterId,
      adapterKey: job.data.adapterKey,
      runType: job.data.runType,
    },
    'Crawl job placeholder executed.',
  );

  return {
    status: 'queued_for_adapter_pipeline',
    adapterId: job.data.adapterId,
  };
}

async function processSearchIndexJob(
  job: Job<SearchIndexJobPayload>,
  logger: ReturnType<typeof createLogger>,
) {
  logger.info(
    {
      jobId: job.id,
      canonicalProductIds: job.data.canonicalProductIds ?? [],
      refreshedAt: job.data.refreshedAt,
    },
    'Search index refresh placeholder executed.',
  );

  return {
    status: 'search_index_refresh_accepted',
    refreshedAt: job.data.refreshedAt,
  };
}

async function processManualCrawlJob(
  job: Job<ManualCrawlJobPayload>,
  logger: ReturnType<typeof createLogger>,
) {
  logger.info(
    {
      jobId: job.id,
      adapterIds: job.data.adapterIds,
      requestedByAdminId: job.data.requestedByAdminId,
    },
    'Manual crawl placeholder executed.',
  );

  return {
    status: 'manual_crawl_accepted',
    adapterIds: job.data.adapterIds,
  };
}

if (isMainModule(import.meta.url)) {
  const registry = registerWorkers();
  const shutdown = async () => {
    await registry.close();
  };

  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}
