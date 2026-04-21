import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminUserRepository } from '../../auth/admin-user-repository.js';
import { hashPassword } from '../../auth/password.js';
import { createSession, verifySession } from '../../auth/session.js';

const MIN_PASSWORD_CHANGE_LENGTH = 8;

/**
 * Admin authentication routes
 * POST /api/v1/admin/auth/login - Login and get session token
 * GET /api/v1/admin/auth/status - Check current session status
 * POST /api/v1/admin/auth/logout - Logout and invalidate session
 */

const _loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const loginResponseSchema = z.object({
  sessionToken: z.string(),
  adminId: z.string(),
  email: z.string(),
  displayName: z.string(),
});

const statusResponseSchema = z.object({
  adminId: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.literal('admin'),
});

export async function registerAdminAuthRoutes(
  app: FastifyInstance,
  adminUserRepository: AdminUserRepository,
  sessionSecret: string,
) {
  /**
   * POST /api/v1/admin/auth/login
   * Authenticate admin and create session
   */
  app.post<{ Body: typeof _loginSchema._type }>(
    '/api/v1/admin/auth/login',
    {
      schema: {
        description: 'Admin login',
        tags: ['Admin Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              sessionToken: { type: 'string' },
              adminId: { type: 'string' },
              email: { type: 'string' },
              displayName: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      
      if (!body.email || !body.password) {
        return reply.status(400).send({ error: 'Email and password required' });
      }

      const admin = await adminUserRepository.verifyCredentials(
        body.email,
        body.password,
      );

      if (!admin) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      await adminUserRepository.recordSuccessfulLogin(admin.id);

      // Create session token
      const sessionToken = await createSession(
        {
          adminId: admin.id,
          email: admin.email,
          role: 'admin' as const,
        },
        sessionSecret,
      );

      return reply.send(
        loginResponseSchema.parse({
          sessionToken,
          adminId: admin.id,
          email: admin.email,
          displayName: admin.fullName,
        }),
      );
    },
  );

  /**
   * GET /api/v1/admin/auth/status
   * Check current session status
   */
  app.get<{ Reply: typeof statusResponseSchema._type | { error: string } }>(
    '/api/v1/admin/auth/status',
    {
      schema: {
        description: 'Get current admin session status',
        tags: ['Admin Auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              adminId: { type: 'string' },
              email: { type: 'string' },
              displayName: { type: 'string' },
              role: { type: 'string', enum: ['admin'] },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.slice(7);

      // Verify session
      const session = await verifySession(token, sessionSecret);
      if (!session) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      // Get admin details
      const admin = await adminUserRepository.findById(session.adminId);
      if (!admin) {
        return reply.status(401).send({ error: 'Admin not found' });
      }

      return reply.send(
        statusResponseSchema.parse({
          adminId: admin.id,
          email: admin.email,
          displayName: admin.fullName,
          role: 'admin' as const,
        }),
      );
    },
  );

  /**
   * POST /api/v1/admin/auth/logout
   * Logout and invalidate session
   */
  app.post<{ Reply: { message: string } | { error: string } }>(
    '/api/v1/admin/auth/logout',
    {
      schema: {
        description: 'Admin logout',
        tags: ['Admin Auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.slice(7);

      // Verify session exists
      const session = await verifySession(token, sessionSecret);
      if (!session) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      // In a production system, you would invalidate the session token here
      // For MVP, we rely on expiration. Production would need a token blacklist.

      return reply.send({ message: 'Logged out successfully' });
    },
  );

  /**
   * POST /api/v1/admin/auth/change-password
   * Change admin password
   */
  app.post<{
    Body: { oldPassword: string; newPassword: string };
    Reply: { message: string } | { error: string };
  }>(
    '/api/v1/admin/auth/change-password',
    {
      schema: {
        description: 'Change admin password',
        tags: ['Admin Auth'],
        body: {
          type: 'object',
          required: ['oldPassword', 'newPassword'],
          properties: {
            oldPassword: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: MIN_PASSWORD_CHANGE_LENGTH },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.slice(7);

      // Verify session
      const session = await verifySession(token, sessionSecret);
      if (!session) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      const body = request.body;
      
      // Get current admin
      const admin = await adminUserRepository.findById(session.adminId);
      if (!admin) {
        return reply.status(401).send({ error: 'Admin not found' });
      }

      // Verify old password
      const verified = await adminUserRepository.verifyCredentials(
        admin.email,
        body.oldPassword,
      );

      if (!verified) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(body.newPassword);

      // Update password
      await adminUserRepository.updatePassword(admin.id, newPasswordHash);

      return reply.send({ message: 'Password changed successfully' });
    },
  );
}
