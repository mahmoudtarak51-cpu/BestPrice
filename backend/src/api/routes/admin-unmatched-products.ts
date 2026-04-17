import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UnmatchedProductService } from '../services/source-health-service.js';
import { verifyAdminSession } from '../middleware/admin-auth.js';

/**
 * Admin unmatched products routes
 * GET /api/v1/admin/unmatched-products - List unmatched products
 * POST /api/v1/admin/unmatched-products/:rawProductId/match - Manually match product
 */

const unmatchedProductSchema = z.object({
  rawProductId: z.string(),
  adapterId: z.string(),
  title: z.string(),
  price: z.number(),
  url: z.string(),
  crawledAt: z.string(),
  failureReason: z.string().nullable(),
});

const unmatchedProductListSchema = z.object({
  products: z.array(unmatchedProductSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const unmatchedProductDetailSchema = z.object({
  rawProductId: z.string(),
  adapterId: z.string(),
  title: z.string(),
  price: z.number(),
  url: z.string(),
  crawledAt: z.string(),
  failureReason: z.string().nullable(),
  gtin: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  rawData: z.object({}).nullable(),
});

const manualMatchSchema = z.object({
  canonicalProductId: z.string(),
});

const manualMatchResponseSchema = z.object({
  message: z.string(),
  rawProductId: z.string(),
  canonicalProductId: z.string(),
});

export async function registerAdminUnmatchedProductsRoutes(
  app: FastifyInstance,
  unmatchedProductService: UnmatchedProductService,
) {
  /**
   * GET /api/v1/admin/unmatched-products
   * Get paginated list of unmatched products
   */
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      adapterId?: string;
      failureReason?: string;
    };
    Reply: typeof unmatchedProductListSchema._type;
  }>(
    '/api/v1/admin/unmatched-products',
    {
      schema: {
        description: 'List unmatched products',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            adapterId: { type: 'string' },
            failureReason: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rawProductId: { type: 'string' },
                    adapterId: { type: 'string' },
                    title: { type: 'string' },
                    price: { type: 'number' },
                    url: { type: 'string' },
                    crawledAt: { type: 'string' },
                    failureReason: { type: ['string', 'null'] },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
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
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const page = request.query.page ? parseInt(request.query.page, 10) : 1;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      const result = await unmatchedProductService.getUnmatchedProducts({
        page,
        limit,
        adapterId: request.query.adapterId,
        failureReason: request.query.failureReason,
      });

      return reply.send(
        unmatchedProductListSchema.parse({
          products: result.products.map(p => ({
            rawProductId: p.rawProductId,
            adapterId: p.adapterId,
            title: p.title,
            price: p.price,
            url: p.url,
            crawledAt: p.crawledAt.toISOString(),
            failureReason: p.failureReason,
          })),
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    },
  );

  /**
   * GET /api/v1/admin/unmatched-products/:rawProductId
   * Get details for a specific unmatched product
   */
  app.get<{
    Params: {
      rawProductId: string;
    };
    Reply: typeof unmatchedProductDetailSchema._type;
  }>(
    '/api/v1/admin/unmatched-products/:rawProductId',
    {
      schema: {
        description: 'Get unmatched product details',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            rawProductId: { type: 'string' },
          },
          required: ['rawProductId'],
        },
        response: {
          200: {
            type: 'object',
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const product = await unmatchedProductService.getUnmatchedProduct(
        request.params.rawProductId,
      );

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return reply.send(
        unmatchedProductDetailSchema.parse({
          rawProductId: product.rawProductId,
          adapterId: product.adapterId,
          title: product.title,
          price: product.price,
          url: product.url,
          crawledAt: product.crawledAt.toISOString(),
          failureReason: product.failureReason,
          gtin: product.gtin,
          brand: product.brand,
          model: product.model,
          category: product.category,
          description: product.description,
          rawData: product.rawData,
        }),
      );
    },
  );

  /**
   * POST /api/v1/admin/unmatched-products/:rawProductId/match
   * Manually match an unmatched product to a canonical product
   */
  app.post<{
    Params: {
      rawProductId: string;
    };
    Body: typeof manualMatchSchema._type;
    Reply: typeof manualMatchResponseSchema._type;
  }>(
    '/api/v1/admin/unmatched-products/:rawProductId/match',
    {
      schema: {
        description: 'Manually match unmatched product',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            rawProductId: { type: 'string' },
          },
          required: ['rawProductId'],
        },
        body: {
          type: 'object',
          properties: {
            canonicalProductId: { type: 'string' },
          },
          required: ['canonicalProductId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              rawProductId: { type: 'string' },
              canonicalProductId: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const result = await unmatchedProductService.manualMatch(
        request.params.rawProductId,
        request.body.canonicalProductId,
      );

      if (!result) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return reply.send(
        manualMatchResponseSchema.parse({
          message: 'Product matched successfully',
          rawProductId: request.params.rawProductId,
          canonicalProductId: request.body.canonicalProductId,
        }),
      );
    },
  );

  /**
   * DELETE /api/v1/admin/unmatched-products/:rawProductId
   * Mark a product as rejected (unable to match)
   */
  app.delete<{
    Params: {
      rawProductId: string;
    };
    Body: {
      reason: string;
    };
  }>(
    '/api/v1/admin/unmatched-products/:rawProductId',
    {
      schema: {
        description: 'Reject unmatched product',
        tags: ['Admin Operations'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            rawProductId: { type: 'string' },
          },
          required: ['rawProductId'],
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
          required: ['reason'],
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
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      onRequest: verifyAdminSession,
    },
    async (request, reply) => {
      const result = await unmatchedProductService.reject(
        request.params.rawProductId,
        request.body.reason,
      );

      if (!result) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return reply.send({ message: 'Product rejected' });
    },
  );
}
