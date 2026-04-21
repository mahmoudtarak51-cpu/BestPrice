import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifySession } from '../../auth/session.js';

export async function verifyAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.adminSession) {
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      const verified = await verifySession(
        authorization.slice('Bearer '.length),
        request.server.appConfig.sessionSecret,
      );

      if (verified) {
        request.adminSession = {
          adminUserId: verified.adminId,
          email: verified.email,
          role: verified.role,
          issuedAt: verified.issuedAt,
          expiresAt: verified.expiresAt,
        };
      }
    }
  }

  if (!request.adminSession || request.adminSession.role !== 'admin') {
    void reply.code(401).send({
      error: 'Unauthorized',
    });
  }
}
