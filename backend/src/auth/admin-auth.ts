import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AdminSessionClaims } from './session.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export async function registerAdminAuth(app: FastifyInstance): Promise<void> {
  app.decorate('requireAdmin', async (request, reply) => {
    if (!request.adminSession || request.adminSession.role !== 'admin') {
      reply.code(401).send({
        message: 'Unauthorized',
      });
    }
  });
}

export function getAuthenticatedAdmin(
  request: FastifyRequest,
): AdminSessionClaims | null {
  return request.adminSession?.role === 'admin' ? request.adminSession : null;
}
