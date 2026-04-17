const offerSummarySchema = {
  type: 'object',
  required: ['offerId', 'store', 'priceEgp', 'availability', 'lastUpdatedAt'],
  properties: {
    offerId: { type: 'string', format: 'uuid' },
    store: { type: 'string' },
    priceEgp: { type: 'number' },
    shippingEgp: { type: 'number', nullable: true },
    landedPriceEgp: { type: 'number', nullable: true },
    availability: {
      type: 'string',
      enum: ['in_stock', 'limited', 'out_of_stock', 'unknown'],
    },
    lastUpdatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const searchQuerystringSchema = {
  type: 'object',
  required: ['q'],
  properties: {
    q: { type: 'string', minLength: 1 },
    lang: { type: 'string', enum: ['auto', 'ar', 'en'], default: 'auto' },
    category: { type: 'string' },
    brand: { type: 'string' },
    store: { type: 'string' },
    minPrice: { type: 'number', minimum: 0 },
    maxPrice: { type: 'number', minimum: 0 },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  },
} as const;

export const searchResponseSchema = {
  type: 'object',
  required: ['query', 'detectedLanguage', 'page', 'pageSize', 'totalResults', 'groups'],
  properties: {
    query: { type: 'string' },
    detectedLanguage: {
      type: 'string',
      enum: ['ar', 'en', 'mixed', 'unknown'],
    },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    totalResults: { type: 'integer' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'productId',
          'canonicalName',
          'category',
          'brand',
          'bestOverallOffer',
          'exactOfferCount',
          'lastUpdatedAt',
        ],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          canonicalName: { type: 'string' },
          canonicalNameArabic: { type: 'string', nullable: true },
          category: { type: 'string' },
          brand: { type: 'string' },
          imageUrl: { type: 'string', nullable: true },
          badges: {
            type: 'array',
            items: { type: 'string', enum: ['best_overall', 'cheapest'] },
          },
          bestOverallOffer: offerSummarySchema,
          cheapestOffer: {
            ...offerSummarySchema,
            nullable: true,
          },
          exactOfferCount: { type: 'integer' },
          similarProductCount: { type: 'integer' },
          lastUpdatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;