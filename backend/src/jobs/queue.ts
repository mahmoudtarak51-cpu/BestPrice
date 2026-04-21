import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';

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

export function createRedisConnection(redisUrl: string): Redis {
  const parsed = new URL(redisUrl);
  const redisOptions: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace('/', '')) || 0 : 0,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };

  return new Redis(redisOptions);
}

export function createQueueRegistry(options: {
  redisUrl: string;
  prefix?: string;
}) {
  const sharedConnection = createRedisConnection(options.redisUrl);
  const prefix = options.prefix ?? 'bestprice';
  let crawlQueue: Queue<CrawlJobPayload> | undefined;
  let searchIndexQueue: Queue<SearchIndexJobPayload> | undefined;
  let manualCrawlQueue: Queue<ManualCrawlJobPayload> | undefined;
  let crawlEvents: QueueEvents | undefined;
  let searchIndexEvents: QueueEvents | undefined;
  let manualCrawlEvents: QueueEvents | undefined;

  function getCrawlQueue(): Queue<CrawlJobPayload> {
    crawlQueue ??= new Queue<CrawlJobPayload>(CRAWL_QUEUE_NAME, {
      connection: sharedConnection,
      prefix,
    });

    return crawlQueue;
  }

  function getSearchIndexQueue(): Queue<SearchIndexJobPayload> {
    searchIndexQueue ??= new Queue<SearchIndexJobPayload>(
      SEARCH_INDEX_QUEUE_NAME,
      {
        connection: sharedConnection,
        prefix,
      },
    );

    return searchIndexQueue;
  }

  function getManualCrawlQueue(): Queue<ManualCrawlJobPayload> {
    manualCrawlQueue ??= new Queue<ManualCrawlJobPayload>(
      MANUAL_CRAWL_QUEUE_NAME,
      {
        connection: sharedConnection,
        prefix,
      },
    );

    return manualCrawlQueue;
  }

  function getCrawlEvents(): QueueEvents {
    crawlEvents ??= new QueueEvents(CRAWL_QUEUE_NAME, {
      connection: sharedConnection.duplicate(),
      prefix,
    });

    return crawlEvents;
  }

  function getSearchIndexEvents(): QueueEvents {
    searchIndexEvents ??= new QueueEvents(SEARCH_INDEX_QUEUE_NAME, {
      connection: sharedConnection.duplicate(),
      prefix,
    });

    return searchIndexEvents;
  }

  function getManualCrawlEvents(): QueueEvents {
    manualCrawlEvents ??= new QueueEvents(MANUAL_CRAWL_QUEUE_NAME, {
      connection: sharedConnection.duplicate(),
      prefix,
    });

    return manualCrawlEvents;
  }

  return {
    connection: sharedConnection,
    prefix,
    queues: {
      get crawl() {
        return getCrawlQueue();
      },
      get searchIndex() {
        return getSearchIndexQueue();
      },
      get manualCrawl() {
        return getManualCrawlQueue();
      },
    },
    events: {
      get crawl() {
        return getCrawlEvents();
      },
      get searchIndex() {
        return getSearchIndexEvents();
      },
      get manualCrawl() {
        return getManualCrawlEvents();
      },
    },
    async ping(): Promise<boolean> {
      if (sharedConnection.status === 'wait') {
        await sharedConnection.connect();
      }

      return (await sharedConnection.ping()) === 'PONG';
    },
    async enqueueCrawl(payload: CrawlJobPayload, options?: JobsOptions) {
      return getCrawlQueue().add('crawl', payload, withRetention(options));
    },
    async enqueueSearchIndex(
      payload: SearchIndexJobPayload,
      options?: JobsOptions,
    ) {
      return getSearchIndexQueue().add(
        'search-index',
        payload,
        withRetention(options),
      );
    },
    async enqueueManualCrawl(
      payload: ManualCrawlJobPayload,
      options?: JobsOptions,
    ) {
      return getManualCrawlQueue().add(
        'manual-crawl',
        payload,
        withRetention(options),
      );
    },
    async close(): Promise<void> {
      await Promise.all([
        crawlEvents?.close(),
        searchIndexEvents?.close(),
        manualCrawlEvents?.close(),
        crawlQueue?.close(),
        searchIndexQueue?.close(),
        manualCrawlQueue?.close(),
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
