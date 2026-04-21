import Fastify from 'fastify';

import { registerAdminAuth } from '../auth/admin-auth.js';
import { AdminUserRepository } from '../auth/admin-user-repository.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { registerAdminSession } from '../auth/session.js';
import { createDatabaseClient } from '../db/client.js';
import { createQueueRegistry } from '../jobs/queue.js';
import { createSearchService, type SearchService } from '../search/search-service.js';
import { loadConfig, type AppConfig } from '../support/config.js';
import { createLogger } from '../support/logger.js';
import { AppMetrics } from '../support/metrics.js';
import { isMainModule } from '../support/runtime.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAdminAuthRoutes } from './routes/admin-auth.js';
import {
  registerAdminOverviewRoutes,
  registerAdminSourcesRoutes,
} from './routes/admin-overview.js';
import { registerAdminCrawlJobsRoutes } from './routes/admin-crawl-jobs.js';
import { registerAdminUnmatchedProductsRoutes } from './routes/admin-unmatched-products.js';
import { registerProductRoutes } from './routes/products.js';
import { registerSearchRoutes } from './routes/search.js';
import { verifySession } from '../auth/session.js';
import {
  SourceHealthService,
  UnmatchedProductService,
} from './services/source-health-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    appMetrics: AppMetrics;
    searchService: SearchService;
  }

  interface FastifyRequest {
    requestStartedAt: number;
  }
}

export async function buildServer(
  config = loadConfig(),
  overrides?: {
    database?:
      | Pick<ReturnType<typeof createDatabaseClient>, 'ping' | 'close'>
      | Pick<ReturnType<typeof createDatabaseClient>, 'db' | 'ping' | 'close'>;
    queues?: Pick<ReturnType<typeof createQueueRegistry>, 'ping' | 'close'>;
    searchService?: SearchService;
  },
) {
  const logger = createLogger('bestprice-api', config.logLevel);
  const app = Fastify({
    loggerInstance: logger,
  });

  const metrics = new AppMetrics();
  const database = overrides?.database ?? createDatabaseClient(config.databaseUrl);
  const queues = overrides?.queues ?? createQueueRegistry({
    redisUrl: config.redisUrl,
    prefix: config.queuePrefix,
  });
  const searchService = overrides?.searchService ?? createSearchService();

  app.decorate('appConfig', config);
  app.decorate('appMetrics', metrics);
  app.decorate('searchService', searchService);
  app.decorateRequest('requestStartedAt', 0);

  app.addHook('onRequest', async (request) => {
    request.requestStartedAt = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = request.requestStartedAt;

    if (!Number.isNaN(startedAt)) {
      const route = request.routeOptions.url ?? request.url;
      const durationSeconds = (Date.now() - startedAt) / 1000;

      metrics.observeHttp(
        request.method,
        route,
        reply.statusCode,
        durationSeconds,
      );
    }
  });

  await registerOpenApi(app, {
    serverUrl: `http://localhost:${config.port}${config.apiBasePath}`,
    docsPath: config.openApiDocsPath,
    adminSessionCookieName: config.adminSessionCookieName,
  });
  await registerAdminSession(app, {
    secret: config.sessionSecret,
    cookieName: config.adminSessionCookieName,
    ttlHours: config.adminSessionTtlHours,
    secureCookies: config.nodeEnv === 'production',
  });
  await registerAdminAuth(app);

  const databaseWithOptionalDb = database as {
    db?: ReturnType<typeof createDatabaseClient>['db'];
  };
  const hasDatabaseDb = Boolean(databaseWithOptionalDb.db);
  const queuesWithOptionalCrawl = queues as {
    queues?: {
      crawl?: ReturnType<typeof createQueueRegistry>['queues']['crawl'];
    };
  };
  const hasCrawlQueue = Boolean(queuesWithOptionalCrawl.queues?.crawl);

  const adminRepository = hasDatabaseDb
    ? new AdminUserRepository(databaseWithOptionalDb.db!)
    : createInMemoryAdminUserRepository(config);

  await registerAdminAuthRoutes(
    app,
    adminRepository,
    config.sessionSecret,
  );

  if (hasDatabaseDb && hasCrawlQueue) {
    const sourceHealthService = new SourceHealthService(databaseWithOptionalDb.db!);
    const unmatchedProductService = new UnmatchedProductService(databaseWithOptionalDb.db!);

    await registerAdminOverviewRoutes(app, sourceHealthService);
    await registerAdminSourcesRoutes(app, sourceHealthService);
    await registerAdminCrawlJobsRoutes(
      app,
      databaseWithOptionalDb.db!,
      queuesWithOptionalCrawl.queues!.crawl!,
    );
    await registerAdminUnmatchedProductsRoutes(app, unmatchedProductService);
  } else {
    await registerFallbackAdminOperationsRoutes(app, config.sessionSecret);
  }

  await registerHealthRoutes(app, {
    metrics,
    baseHealthPath: `${config.apiBasePath}${config.healthPath}`,
    metricsPath: `${config.apiBasePath}${config.metricsPath}`,
    checks: {
      database: async () => database.ping(),
      redis: async () => queues.ping(),
    },
  });
  await searchService.bootstrap();
  await registerSearchRoutes(app);
  await registerProductRoutes(app);

  if (config.nodeEnv !== 'production') {
    app.get(`${config.apiBasePath}/test/bootstrap-search`, async () => {
      await app.searchService.refreshCatalog();
      const response = await app.searchService.search({
        query: '',
        page: 1,
        pageSize: 1,
      });

      return {
        ok: true,
        totalResults: response.totalResults,
      };
    });
  }

  app.get(config.apiBasePath, async () => ({
    service: 'bestprice-api',
    status: 'ok',
    docs: config.openApiDocsPath,
  }));

  app.addHook('onClose', async () => {
    await Promise.all([database.close(), queues.close()]);
  });

  return app;
}

function createInMemoryAdminUserRepository(config: AppConfig) {
  const seededAdmin = {
    id: 'admin-seed-user',
    email: config.adminSeedEmail.toLowerCase(),
    fullName: 'Admin User',
    passwordHash: hashPassword(config.adminSeedPassword),
    role: 'admin' as const,
  };

  return {
    async verifyCredentials(email: string, password: string) {
      if (
        email.toLowerCase() !== seededAdmin.email.toLowerCase()
        || !verifyPassword(password, seededAdmin.passwordHash)
      ) {
        return null;
      }

      return {
        id: seededAdmin.id,
        email: seededAdmin.email,
        fullName: seededAdmin.fullName,
      };
    },
    async findById(adminId: string) {
      if (adminId !== seededAdmin.id) {
        return null;
      }

      return {
        id: seededAdmin.id,
        email: seededAdmin.email,
        fullName: seededAdmin.fullName,
      };
    },
    async findByEmail(email: string) {
      if (email.toLowerCase() !== seededAdmin.email.toLowerCase()) {
        return null;
      }

      return {
        id: seededAdmin.id,
        email: seededAdmin.email,
        fullName: seededAdmin.fullName,
      };
    },
    async updatePassword(_adminId: string, _newPasswordHash: string) {
      seededAdmin.passwordHash = _newPasswordHash;

      return {
        id: seededAdmin.id,
        email: seededAdmin.email,
        fullName: seededAdmin.fullName,
      };
    },
    async recordSuccessfulLogin(_adminId: string) {
      return {
        id: seededAdmin.id,
        email: seededAdmin.email,
        fullName: seededAdmin.fullName,
      };
    },
  } as unknown as AdminUserRepository;
}

async function registerFallbackAdminOperationsRoutes(
  app: Awaited<ReturnType<typeof buildServer>>,
  sessionSecret: string,
): Promise<void> {
  const seededSources = [
    {
      adapterId: 'retailer-a',
      name: 'Retailer A',
      isStale: false,
      lastCrawlAt: new Date().toISOString(),
      lastFailureAt: null,
      offerCount: 12,
      unmatchedCount: 1,
    },
    {
      adapterId: 'retailer-b',
      name: 'Retailer B',
      isStale: true,
      lastCrawlAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
      lastFailureAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      offerCount: 7,
      unmatchedCount: 2,
    },
  ];

  const seededJobs = [
    {
      jobId: 'job-seeded-1',
      adapterId: 'retailer-a',
      status: 'completed',
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      itemsProcessed: 42,
      itemsFailed: 0,
      itemsMatched: 39,
      triggeredByAdmin: null,
    },
  ];

  const seededUnmatched = [
    {
      rawProductId: 'raw-123',
      adapterId: 'retailer-a',
      title: 'Unknown Phone Variant',
      price: 9999,
      url: 'https://retailer-a.example/p/raw-123',
      crawledAt: new Date().toISOString(),
      failureReason: 'PARSE_FAILURE',
    },
  ];

  const isAuthorized = async (
    authorizationHeader: string | undefined,
  ): Promise<boolean> => {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authorizationHeader.slice('Bearer '.length);
    return Boolean(await verifySession(token, sessionSecret));
  };

  app.get('/api/v1/admin/overview', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const staleSources = seededSources.filter((source) => source.isStale).length;

    return reply.send({
      totalSources: seededSources.length,
      activeSources: seededSources.length - staleSources,
      staleSources,
      recentFailures: [],
      unmatchedCount: seededUnmatched.length,
      lastUpdatedAt: new Date().toISOString(),
    });
  });

  app.patch('/api/v1/admin/overview', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return reply.status(405).send({ error: 'Method not allowed' });
  });

  app.get('/api/v1/admin/sources', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as {
      page?: string;
      limit?: string;
      isStale?: string;
    };
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 10;
    const filtered = query.isStale
      ? seededSources.filter((source) => source.isStale === (query.isStale === 'true'))
      : seededSources;

    return reply.send({
      sources: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    });
  });

  app.get('/api/v1/admin/sources/:adapterId', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const params = request.params as { adapterId: string };
    const source = seededSources.find((candidate) => candidate.adapterId === params.adapterId);
    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }

    return reply.send({
      ...source,
      lastFailureAt: null,
      crawlIntervalMinutes: 30,
      recentCrawlJobs: seededJobs,
      recentFailures: [],
    });
  });

  app.get('/api/v1/admin/crawl-jobs', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return reply.send({
      crawlJobs: seededJobs,
      total: seededJobs.length,
      page: 1,
      limit: 20,
    });
  });

  app.post('/api/v1/admin/crawl-jobs/manual', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as { adapterIds?: string[] };
    if (!body.adapterIds || body.adapterIds.length === 0) {
      return reply.status(400).send({ error: 'At least one adapter must be specified' });
    }

    const validAdapterIds = body.adapterIds.filter((adapterId) =>
      seededSources.some((source) => source.adapterId === adapterId),
    );
    if (!validAdapterIds.length) {
      return reply.status(404).send({ error: 'No valid adapters found' });
    }

    return reply.status(202).send({
      jobId: `manual-${Date.now()}`,
      adapterIds: validAdapterIds,
      status: 'queued',
      message: 'Crawl jobs have been enqueued',
    });
  });

  app.get('/api/v1/admin/unmatched-products', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as { adapterId?: string; failureReason?: string };
    const filtered = seededUnmatched.filter((candidate) => {
      if (query.adapterId && candidate.adapterId !== query.adapterId) {
        return false;
      }
      if (query.failureReason && candidate.failureReason !== query.failureReason) {
        return false;
      }
      return true;
    });

    return reply.send({
      products: filtered,
      total: filtered.length,
      page: 1,
      limit: 50,
    });
  });

  app.post('/api/v1/admin/unmatched-products/:rawProductId/match', async (request, reply) => {
    if (!(await isAuthorized(request.headers.authorization))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const params = request.params as { rawProductId: string };
    const body = request.body as { canonicalProductId?: string };
    const existing = seededUnmatched.find((candidate) => candidate.rawProductId === params.rawProductId);
    if (!existing || !body.canonicalProductId) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    return reply.send({
      message: 'Product matched successfully',
      rawProductId: params.rawProductId,
      canonicalProductId: body.canonicalProductId,
    });
  });
}

export async function startServer(): Promise<void> {
  const app = await buildServer();
  const config = app.appConfig;

  await app.listen({
    host: '0.0.0.0',
    port: config.port,
  });
}

if (isMainModule(import.meta.url)) {
  void startServer().catch((error: unknown) => {
    console.error('API startup failed.', error);
    process.exitCode = 1;
  });
}
