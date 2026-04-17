import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export async function registerOpenApi(
  app: FastifyInstance,
  options: {
    serverUrl: string;
    docsPath: string;
    adminSessionCookieName: string;
  },
): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'BestPrice MVP API',
        version: '0.1.0',
        description:
          'Egypt-first bilingual electronics price-comparison API for shopper and internal admin workflows.',
      },
      servers: [{ url: options.serverUrl }],
      tags: [{ name: 'Shopper' }, { name: 'Admin' }, { name: 'Platform' }],
      components: {
        securitySchemes: {
          adminSession: {
            type: 'apiKey',
            in: 'cookie',
            name: options.adminSessionCookieName,
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: options.docsPath,
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });
}
