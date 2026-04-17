import { FastifyInstance } from 'fastify';
import { ProductDetailService } from '../../matching/product-detail-service';
import { RankingExplanationService } from '../../ranking/product-explanation-service';
import { OfferRepository } from '../../db/repositories/offer-repository';
import { getDatabase } from '../../db/client';
import { productDetailSchema, offersListSchema } from '../schemas/product-detail';

export async function registerProductRoutes(app: FastifyInstance) {
  const db = getDatabase();
  const productDetailService = new ProductDetailService(db);
  const offerRepo = new OfferRepository(db);
  const rankingService = new RankingExplanationService(db, offerRepo);

  /**
   * GET /api/v1/products/:productId
   * Get detailed product information with offers and similar products
   */
  app.get<{ Params: { productId: string }; Querystring: { lang?: string; includeStale?: string } }>(
    '/api/v1/products/:productId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            lang: { type: 'string', enum: ['ar', 'en'] },
            includeStale: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: productDetailSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { productId } = request.params;
        const lang = (request.query.lang || 'en') as 'ar' | 'en';
        const includeStale = request.query.includeStale === 'true';

        const product = await productDetailService.getProductDetail(productId, {
          includeStale,
          lang,
        });

        if (!product) {
          return reply.status(404).send({
            error: 'Product not found',
            code: 'PRODUCT_NOT_FOUND',
          });
        }

        // Log search for analytics
        app.log.info({
          event: 'product_detail_viewed',
          productId,
          language: lang,
          timestamp: new Date(),
        });

        return reply.status(200).send(product);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: 'Failed to retrieve product details',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }
  );

  /**
   * GET /api/v1/products/:productId/offers
   * Get all offers for a product with detailed comparison data
   */
  app.get<{
    Params: { productId: string };
    Querystring: { exactMatch?: string; includeStale?: string; limit?: string; offset?: string };
  }>(
    '/api/v1/products/:productId/offers',
    {
      schema: {
        params: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            exactMatch: { type: 'string', enum: ['true', 'false'] },
            includeStale: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'string' },
            offset: { type: 'string' },
          },
        },
        response: {
          200: offersListSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { productId } = request.params;
        const includeStale = request.query.includeStale === 'true';

        // Get offers comparison
        const offerComparison = await productDetailService.getOfferComparison(
          productId,
          { includeStale }
        );

        if (!offerComparison) {
          return reply.status(404).send({
            error: 'Product not found',
            code: 'PRODUCT_NOT_FOUND',
          });
        }

        // Generate ranking explanations for each offer
        const offersWithExplanations = await Promise.all(
          offerComparison.offers.map(async (offer) => {
            const explanation = await rankingService.explainOfferRanking(
              offer.id,
              productId
            );
            return {
              ...offer,
              explanation: explanation
                ? {
                    rankingReason: explanation.rankingReason,
                    rankingScore: explanation.rankingScore,
                    confidence: explanation.confidence,
                    factors: explanation.factors,
                  }
                : undefined,
            };
          })
        );

        // Log offer comparison view
        app.log.info({
          event: 'offers_comparison_viewed',
          productId,
          offersCount: offersWithExplanations.length,
          timestamp: new Date(),
        });

        return reply.status(200).send({
          productId,
          offers: offersWithExplanations,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: 'Failed to retrieve offers',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }
  );

  /**
   * GET /api/v1/products/:productId/similar
   * Get similar products for cross-selling or alternative suggestions
   */
  app.get<{
    Params: { productId: string };
    Querystring: { limit?: string; includeStale?: string };
  }>(
    '/api/v1/products/:productId/similar',
    {
      schema: {
        params: {
          type: 'object',
          required: ['productId'],
          properties: {
            productId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string' },
            includeStale: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    brand: { type: 'string' },
                    model: { type: 'string' },
                    category: { type: 'string' },
                    matchConfidence: { type: 'number' },
                    matchReason: { type: 'string' },
                    offers: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { productId } = request.params;
        const limit = parseInt(request.query.limit || '10', 10);
        const includeStale = request.query.includeStale === 'true';

        const similarProducts = await productDetailService.getSimilarProducts(
          productId,
          { limit, includeStale }
        );

        if (!similarProducts) {
          return reply.status(404).send({
            error: 'Product not found',
            code: 'PRODUCT_NOT_FOUND',
          });
        }

        return reply.status(200).send(similarProducts);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: 'Failed to retrieve similar products',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }
  );

  /**
   * GET /api/v1/products/:productId/offers/:offerId/explanation
   * Get detailed ranking explanation for a specific offer
   */
  app.get<{
    Params: { productId: string; offerId: string };
  }>(
    '/api/v1/products/:productId/offers/:offerId/explanation',
    {
      schema: {
        params: {
          type: 'object',
          required: ['productId', 'offerId'],
          properties: {
            productId: { type: 'string' },
            offerId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              offerId: { type: 'string' },
              storeId: { type: 'string' },
              storeName: { type: 'string' },
              price: { type: 'number' },
              rankingScore: { type: 'number' },
              rankingReason: { type: 'string' },
              confidence: { type: 'number' },
              factors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    weight: { type: 'number' },
                    value: { type: 'number' },
                    contribution: { type: 'number' },
                    explanation: { type: 'string' },
                  },
                },
              },
              freshnessStatus: {
                type: 'object',
                properties: {
                  hoursOld: { type: 'number' },
                  isStale: { type: 'boolean' },
                  lastUpdatedAt: { type: 'string', format: 'date-time' },
                  freshnessPenalty: { type: 'number' },
                  freshnessExplanation: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { productId, offerId } = request.params;

        const explanation = await rankingService.explainOfferRanking(
          offerId,
          productId
        );

        if (!explanation) {
          return reply.status(404).send({
            error: 'Offer not found',
            code: 'OFFER_NOT_FOUND',
          });
        }

        return reply.status(200).send(explanation);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: 'Failed to retrieve ranking explanation',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }
  );
}
