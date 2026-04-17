import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

export const CRAWL_QUEUE_NAME = 'crawl';
export const SEARCH_INDEX_QUEUE_NAME = 'search-index';
export const MANUAL_CRAWL_QUEUE_NAME = 'manual-crawl';

export type CrawlJobPayload = {
  adapterId: string;
  adapterKey: string;
  runType: 'scheduled' | 'manual' | 'retry';
  triggeredByAdminId?: string | null;
  cursor?: string | null;
};

export type SearchIndexJobPayload = {
  canonicalProductIds?: string[];
  refreshedAt: string;
};

export type ManualCrawlJobPayload = {
  adapterIds: string[];
  requestedByAdminId: string;
  reason?: string;
};

export type QueueRegistry = ReturnType<typeof createQueueRegistry>;

export function createRedisConnection(redisUrl: string): IORedis {
  const parsed = new URL(redisUrl);

  return new IORedis({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace('/', '')) || 0 : 0,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export function createQueueRegistry(options: {
  redisUrl: string;
  prefix?: string;
}) {
  const sharedConnection = createRedisConnection(options.redisUrl);
  const prefix = options.prefix ?? 'bestprice';

  const crawlQueue = new Queue<CrawlJobPayload>(CRAWL_QUEUE_NAME, {
    connection: sharedConnection,
    prefix,
  });
  const searchIndexQueue = new Queue<SearchIndexJobPayload>(
    SEARCH_INDEX_QUEUE_NAME,
    {
      connection: sharedConnection,
      prefix,
    },
  );
  const manualCrawlQueue = new Queue<ManualCrawlJobPayload>(
    MANUAL_CRAWL_QUEUE_NAME,
    {
      connection: sharedConnection,
      prefix,
    },
  );

  const crawlEvents = new QueueEvents(CRAWL_QUEUE_NAME, {
    connection: sharedConnection.duplicate(),
    prefix,
  });
  const searchIndexEvents = new QueueEvents(SEARCH_INDEX_QUEUE_NAME, {
    connection: sharedConnection.duplicate(),
    prefix,
  });
  const manualCrawlEvents = new QueueEvents(MANUAL_CRAWL_QUEUE_NAME, {
    connection: sharedConnection.duplicate(),
    prefix,
  });

  return {
    connection: sharedConnection,
    prefix,
    queues: {
      crawl: crawlQueue,
      searchIndex: searchIndexQueue,
      manualCrawl: manualCrawlQueue,
    },
    events: {
      crawl: crawlEvents,
      searchIndex: searchIndexEvents,
      manualCrawl: manualCrawlEvents,
    },
    async ping(): Promise<boolean> {
      if (sharedConnection.status === 'wait') {
        await sharedConnection.connect();
      }

      return (await sharedConnection.ping()) === 'PONG';
    },
    async enqueueCrawl(payload: CrawlJobPayload, options?: JobsOptions) {
      return crawlQueue.add('crawl', payload, withRetention(options));
    },
    async enqueueSearchIndex(
      payload: SearchIndexJobPayload,
      options?: JobsOptions,
    ) {
      return searchIndexQueue.add(
        'search-index',
        payload,
        withRetention(options),
      );
    },
    async enqueueManualCrawl(
      payload: ManualCrawlJobPayload,
      options?: JobsOptions,
    ) {
      return manualCrawlQueue.add(
        'manual-crawl',
        payload,
        withRetention(options),
      );
    },
    async close(): Promise<void> {
      await Promise.all([
        crawlEvents.close(),
        searchIndexEvents.close(),
        manualCrawlEvents.close(),
        crawlQueue.close(),
        searchIndexQueue.close(),
        manualCrawlQueue.close(),
      ]);

      await sharedConnection.quit();
    },
  };
}

function withRetention(options: JobsOptions | undefined): JobsOptions {
  return {
    removeOnComplete: 100,
    removeOnFail: 250,
    ...options,
  };
}
