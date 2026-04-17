import { z } from 'zod';

export const freshnessStatusSchema = z.object({
  hoursOld: z.number().describe('Hours since last update'),
  isStale: z.boolean().describe('Whether the offer exceeds 12-hour SLA'),
  lastUpdatedAt: z.date().describe('Timestamp of last update'),
});

export const provenanceSchema = z.object({
  lastFetchedAt: z.date().describe('When the data was fetched from source'),
  sourceUrl: z.string().url().optional().describe('Direct URL to offer on source'),
});

export const offerSchema = z.object({
  id: z.string().uuid().describe('Unique offer identifier'),
  storeId: z.string().uuid().describe('Store/retailer identifier'),
  storeName: z.string().describe('Shopper-visible store name'),
  price: z.number().positive().describe('Price in primary currency (EGP)'),
  currency: z.literal('EGP').describe('Currency code'),
  availability: z.enum(['in_stock', 'limited', 'out_of_stock']).describe('Stock status'),
  shippingInfo: z
    .object({
      available: z.boolean(),
      cost: z.number().optional(),
      message: z.string().optional(),
      estimatedDays: z.number().optional(),
    })
    .optional()
    .describe('Shipping details or null if not available'),
  freshness: freshnessStatusSchema.describe('Data freshness information'),
  rankingReason: z
    .enum(['best_overall', 'cheapest', 'trusted_seller', 'fast_shipping', 'good_value'])
    .optional()
    .describe('Why this offer was selected/ranked'),
  provenance: provenanceSchema.describe('Source information for transparency'),
});

export const similarProductSchema = z.object({
  id: z.string().uuid().describe('Product identifier'),
  title: z.string().describe('Product title in requested language'),
  brand: z.string().describe('Brand name'),
  model: z.string().optional().describe('Model number if available'),
  category: z.string().describe('Product category'),
  matchConfidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence score 0-100 for similarity'),
  matchReason: z.string().describe('Human-readable explanation of why products are similar'),
  hasOffers: z.boolean().describe('Whether this product has available offers'),
});

export const productDetailSchema = z.object({
  id: z.string().uuid().describe('Canonical product identifier'),
  title: z.string().describe('Product title in requested language'),
  category: z.string().describe('Product category (phones, laptops, etc.)'),
  brand: z.string().describe('Brand name'),
  model: z.string().optional().describe('Model number or variant'),
  gtin: z.string().optional().describe('Global Trade Item Number for exact matching'),
  description: z.string().optional().describe('Product description'),
  images: z.array(z.string().url()).optional().describe('Product images'),
  specifications: z
    .record(z.string())
    .optional()
    .describe('Key technical specifications'),
  exactOffers: z
    .array(offerSchema)
    .describe('Offers for exact product match, sorted by ranking'),
  similarProducts: z
    .array(similarProductSchema)
    .describe('Similar/variant products with offers'),
  updatedAt: z.date().describe('When the product data was last updated'),
});

export const offersListSchema = z.object({
  productId: z.string().uuid().describe('Product identifier'),
  offers: z
    .array(
      offerSchema.extend({
        explanation: z
          .object({
            rankingReason: z.string(),
            rankingScore: z.number().min(0).max(100),
            confidence: z.number().min(0).max(100),
            factors: z.array(
              z.object({
                name: z.string(),
                weight: z.number(),
                value: z.number(),
                contribution: z.number(),
                explanation: z.string(),
              })
            ),
          })
          .optional(),
      })
    )
    .describe('All offers for this product with ranking explanations'),
});

export const similarProductsListSchema = z.object({
  productId: z.string().uuid().describe('Base product identifier'),
  products: z
    .array(
      similarProductSchema.extend({
        offers: z.array(
          z.object({
            id: z.string().uuid(),
            storeId: z.string().uuid(),
            storeName: z.string(),
            price: z.number().positive(),
            currency: z.literal('EGP'),
            availability: z.enum(['in_stock', 'limited', 'out_of_stock']),
            rankingReason: z.string().optional(),
          })
        ),
      })
    )
    .describe('Similar products with their available offers'),
});

export const rankingExplanationSchema = z.object({
  offerId: z.string().uuid(),
  storeId: z.string().uuid(),
  storeName: z.string(),
  price: z.number().positive(),
  rankingScore: z.number().min(0).max(100),
  rankingReason: z.enum(['best_overall', 'cheapest', 'trusted_seller', 'fast_shipping', 'good_value']),
  factors: z.array(
    z.object({
      name: z.string(),
      weight: z.number(),
      value: z.number(),
      contribution: z.number(),
      explanation: z.string(),
    })
  ),
  freshnessStatus: z.object({
    hoursOld: z.number(),
    isStale: z.boolean(),
    lastUpdatedAt: z.date(),
    freshnessPenalty: z.number(),
    freshnessExplanation: z.string(),
  }),
  shippingIssues: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(100),
});

// JSON Schema conversions for Fastify
export const productDetailJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    category: { type: 'string' },
    brand: { type: 'string' },
    model: { type: 'string' },
    gtin: { type: 'string' },
    description: { type: 'string' },
    images: { type: 'array', items: { type: 'string' } },
    specifications: { type: 'object' },
    exactOffers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          storeName: { type: 'string' },
          price: { type: 'number' },
          currency: { type: 'string', enum: ['EGP'] },
          availability: { type: 'string', enum: ['in_stock', 'limited', 'out_of_stock'] },
          rankingReason: { type: 'string' },
          freshness: {
            type: 'object',
            properties: {
              hoursOld: { type: 'number' },
              isStale: { type: 'boolean' },
              lastUpdatedAt: { type: 'string', format: 'date-time' },
            },
          },
          provenance: {
            type: 'object',
            properties: {
              lastFetchedAt: { type: 'string', format: 'date-time' },
              sourceUrl: { type: 'string' },
            },
          },
        },
      },
    },
    similarProducts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          brand: { type: 'string' },
          model: { type: 'string' },
          category: { type: 'string' },
          matchConfidence: { type: 'number' },
          matchReason: { type: 'string' },
          hasOffers: { type: 'boolean' },
        },
      },
    },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'category', 'brand', 'exactOffers', 'similarProducts', 'updatedAt'],
};

export const offersListJsonSchema = {
  type: 'object' as const,
  properties: {
    productId: { type: 'string', format: 'uuid' },
    offers: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  required: ['productId', 'offers'],
};
