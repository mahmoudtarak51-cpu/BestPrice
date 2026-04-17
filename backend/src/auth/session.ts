import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type AdminSessionClaims = {
  adminUserId: string;
  email: string;
  role: 'admin';
  issuedAt: number;
  expiresAt: number;
};

declare module 'fastify' {
  interface FastifyRequest {
    adminSession: AdminSessionClaims | null;
  }

  interface FastifyInstance {
    issueAdminSession: (
      reply: FastifyReply,
      session: Omit<AdminSessionClaims, 'issuedAt' | 'expiresAt'> & {
        ttlHours?: number;
      },
    ) => Promise<AdminSessionClaims>;
    clearAdminSession: (reply: FastifyReply) => void;
  }
}

export async function registerAdminSession(
  app: FastifyInstance,
  options: {
    secret: string;
    cookieName: string;
    ttlHours: number;
    secureCookies: boolean;
  },
): Promise<void> {
  await app.register(cookie);

  app.decorateRequest('adminSession', null);
  app.decorate(
    'issueAdminSession',
    async (
      reply: FastifyReply,
      session: Omit<AdminSessionClaims, 'issuedAt' | 'expiresAt'> & {
        ttlHours?: number;
      },
    ) => {
      const issuedAt = Date.now();
      const ttlMs = (session.ttlHours ?? options.ttlHours) * 60 * 60 * 1000;
      const claims: AdminSessionClaims = {
        adminUserId: session.adminUserId,
        email: session.email.toLowerCase(),
        role: 'admin',
        issuedAt,
        expiresAt: issuedAt + ttlMs,
      };

      const token = signAdminSession(claims, options.secret);
      reply.setCookie(options.cookieName, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.secureCookies,
        path: '/',
        maxAge: Math.floor(ttlMs / 1000),
      });

      return claims;
    },
  );
  app.decorate('clearAdminSession', (reply: FastifyReply) => {
    reply.clearCookie(options.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secureCookies,
      path: '/',
    });
  });

  app.addHook('preHandler', async (request) => {
    const token = request.cookies[options.cookieName];
    request.adminSession = token
      ? verifyAdminSession(token, options.secret)
      : null;
  });
}

export function signAdminSession(
  claims: AdminSessionClaims,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

export function verifyAdminSession(
  token: string,
  secret: string,
): AdminSessionClaims | null {
  const [payload, signature] = token.split('.');

  if (!payload || !signature) {
    return null;
  }

  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as AdminSessionClaims;

    if (parsed.role !== 'admin' || parsed.expiresAt <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
