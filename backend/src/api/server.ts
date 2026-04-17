import Fastify from 'fastify';

import { registerAdminAuth } from '../auth/admin-auth.js';
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
import { registerSearchRoutes } from './routes/search.js';

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
    database?: Pick<ReturnType<typeof createDatabaseClient>, 'ping' | 'close'>;
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
      const route = request.routeOptions.url;
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
