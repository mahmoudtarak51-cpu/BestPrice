import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const DEFAULT_ADMIN_SESSION_TTL_HOURS = 12;
const MAX_ADMIN_SESSION_TTL_HOURS = 24;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const adminSessionClaimsSchema = z.object({
  adminUserId: z.string().min(1),
  email: z.string().email(),
  role: z.literal('admin'),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
});

export type AdminSessionClaims = z.infer<typeof adminSessionClaimsSchema>;

export type VerifiedAdminSession = {
  adminId: string;
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
      const claims = buildAdminSessionClaims(
        {
          adminUserId: session.adminUserId,
          email: session.email,
          role: 'admin',
          ttlHours: session.ttlHours,
        },
        options.ttlHours,
      );

      const ttlMs = claims.expiresAt - claims.issuedAt;
      const token = signAdminSession(claims, options.secret);

      reply.setCookie(options.cookieName, token, {
        httpOnly: true,
        sameSite: 'strict',
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
      sameSite: 'strict',
      secure: options.secureCookies,
      path: '/',
      maxAge: 0,
    });
  });

  app.addHook('preHandler', async (request) => {
    const token = request.cookies[options.cookieName];
    request.adminSession = token
      ? verifyAdminSession(token, options.secret)
      : null;
  });
}

export async function createSession(
  session: {
    adminId: string;
    email: string;
    role: 'admin';
    ttlHours?: number;
  },
  secret: string,
  options?: {
    fallbackTtlHours?: number;
  },
): Promise<string> {
  const claims = buildAdminSessionClaims(
    {
      adminUserId: session.adminId,
      email: session.email,
      role: session.role,
      ttlHours: session.ttlHours,
    },
    options?.fallbackTtlHours ?? DEFAULT_ADMIN_SESSION_TTL_HOURS,
  );

  return signAdminSession(claims, secret);
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<VerifiedAdminSession | null> {
  const claims = verifyAdminSession(token, secret);

  if (!claims) {
    return null;
  }

  return {
    adminId: claims.adminUserId,
    email: claims.email,
    role: claims.role,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  };
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

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = adminSessionClaimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    );

    if (!parsed.success) {
      return null;
    }

    const claims = parsed.data;
    const now = Date.now();
    const ttlMs = claims.expiresAt - claims.issuedAt;

    if (claims.issuedAt > now + MAX_CLOCK_SKEW_MS) {
      return null;
    }

    if (
      ttlMs <= 0
      || ttlMs > MAX_ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000
      || claims.expiresAt <= now
    ) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

function buildAdminSessionClaims(
  session: {
    adminUserId: string;
    email: string;
    role: 'admin';
    ttlHours?: number;
  },
  fallbackTtlHours: number,
): AdminSessionClaims {
  const issuedAt = Date.now();
  const ttlHours = resolveTtlHours(session.ttlHours, fallbackTtlHours);
  const ttlMs = ttlHours * 60 * 60 * 1000;

  return {
    adminUserId: session.adminUserId,
    email: session.email.toLowerCase(),
    role: 'admin',
    issuedAt,
    expiresAt: issuedAt + ttlMs,
  };
}

function resolveTtlHours(
  ttlHours: number | undefined,
  fallbackTtlHours: number,
): number {
  const candidate = ttlHours ?? fallbackTtlHours;

  if (!Number.isFinite(candidate) || candidate <= 0) {
    return fallbackTtlHours;
  }

  return Math.min(candidate, MAX_ADMIN_SESSION_TTL_HOURS);
}
