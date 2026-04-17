import type { FastifyInstance } from 'fastify';

import {
  runDependencyChecks,
  type AppMetrics,
  type DependencyCheck,
} from '../../support/metrics.js';

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: {
    metrics: AppMetrics;
    checks: Record<string, DependencyCheck>;
    baseHealthPath: string;
    metricsPath: string;
  },
): Promise<void> {
  app.get(
    `${options.baseHealthPath}`,
    {
      schema: {
        tags: ['Platform'],
        summary: 'Combined platform health snapshot',
      },
    },
    async (_request, reply) => {
      const snapshot = await runDependencyChecks(options.checks, options.metrics);

      if (snapshot.status !== 'ok') {
        reply.code(503);
      }

      return snapshot;
    },
  );

  app.get(
    `${options.baseHealthPath}/live`,
    {
      schema: {
        tags: ['Platform'],
        summary: 'Liveness probe',
      },
    },
    async () => ({
      status: 'ok',
      checkedAt: new Date().toISOString(),
    }),
  );

  app.get(
    `${options.baseHealthPath}/ready`,
    {
      schema: {
        tags: ['Platform'],
        summary: 'Readiness probe',
      },
    },
    async (_request, reply) => {
      const snapshot = await runDependencyChecks(options.checks, options.metrics);

      if (snapshot.status !== 'ok') {
        reply.code(503);
      }

      return snapshot;
    },
  );

  app.get(options.metricsPath, async (_request, reply) => {
    reply.type(options.metrics.registry.contentType);
    return options.metrics.render();
  });
}
