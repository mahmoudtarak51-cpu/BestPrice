import { z } from 'zod';

/**
 * OpenAPI schemas for admin unmatched products
 */

export const unmatchedProductSchema = z.object({
  rawProductId: z.string().uuid().describe('Unique ID for raw product'),
  adapterId: z.string().describe('Source adapter ID'),
  title: z.string().describe('Product title from source'),
  price: z.number().describe('Price in source currency'),
  url: z.string().url().describe('Source URL'),
  crawledAt: z.string().datetime().describe('Crawl timestamp'),
  failureReason: z
    .enum([
      'PARSE_FAILURE',
      'NO_MATCH',
      'AMBIGUOUS',
      'GTIN_COLLISION',
      'ADMIN_REJECTED',
    ])
    .nullable()
    .describe('Reason why product was not matched'),
});

export const unmatchedProductDetailSchema = unmatchedProductSchema.extend({
  gtin: z.string().nullable().describe('Global Trade Item Number if available'),
  brand: z.string().nullable().describe('Brand extracted from source'),
  model: z.string().nullable().describe('Model number if available'),
  category: z.string().nullable().describe('Category from source'),
  description: z.string().nullable().describe('Full description from source'),
  rawData: z
    .record(z.any())
    .nullable()
    .describe('Full raw data object from source'),
});

export const unmatchedProductsListSchema = z.object({
  products: z.array(unmatchedProductSchema),
  total: z.number().int().describe('Total unmatched products'),
  page: z.number().int().positive().describe('Current page'),
  limit: z.number().int().positive().describe('Items per page'),
});

export const manualMatchRequestSchema = z.object({
  canonicalProductId: z.string().uuid().describe('Canonical product ID to match to'),
});

export const manualMatchResponseSchema = z.object({
  message: z.string().describe('Success message'),
  rawProductId: z.string().uuid().describe('Matched raw product ID'),
  canonicalProductId: z.string().uuid().describe('Target canonical product ID'),
});

export const rejectProductRequestSchema = z.object({
  reason: z
    .string()
    .describe('Reason for rejection')
    .min(1)
    .max(500),
});

export const unmatchedProductsStatisticsSchema = z.object({
  total: z.number().int().describe('Total unmatched products'),
  byAdapter: z.array(
    z.object({
      adapterId: z.string(),
      count: z.number().int(),
    }),
  ),
  byReason: z.array(
    z.object({
      reason: z.string(),
      count: z.number().int(),
    }),
  ),
});
