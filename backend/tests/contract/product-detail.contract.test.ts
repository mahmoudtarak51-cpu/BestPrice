import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { buildServer } from '../../src/api/server';

describe('Product Detail API Contracts', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/products/{productId}', () => {
    it('should return 200 with product detail schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Product detail schema validation
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('canonicalId');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('category');
      expect(body).toHaveProperty('brand');
      expect(body).toHaveProperty('model');
      expect(body).toHaveProperty('description');
      expect(body).toHaveProperty('images');
      expect(body).toHaveProperty('specifications');
      expect(body).toHaveProperty('exactOffers');
      expect(body).toHaveProperty('similarProducts');
      expect(body).toHaveProperty('updatedAt');

      // Exact offers array
      expect(Array.isArray(body.exactOffers)).toBe(true);
      if (body.exactOffers.length > 0) {
        const offer = body.exactOffers[0];
        expect(offer).toHaveProperty('id');
        expect(offer).toHaveProperty('storeId');
        expect(offer).toHaveProperty('storeName');
        expect(offer).toHaveProperty('price');
        expect(offer).toHaveProperty('currency');
        expect(offer).toHaveProperty('availability');
        expect(offer).toHaveProperty('freshness');
        expect(offer).toHaveProperty('rankingReason');
        expect(offer).toHaveProperty('updatedAt');
      }

      // Similar products array
      expect(Array.isArray(body.similarProducts)).toBe(true);
      if (body.similarProducts.length > 0) {
        const similar = body.similarProducts[0];
        expect(similar).toHaveProperty('id');
        expect(similar).toHaveProperty('title');
        expect(similar).toHaveProperty('matchConfidence');
        expect(similar).toHaveProperty('matchReason');
      }
    });

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/non-existent-product-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should support Arabic and English query results', async () => {
      // Test with Arabic language header
      const responseAr = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id?lang=ar',
      });

      expect(responseAr.statusCode).toBe(200);
      const bodyAr = JSON.parse(responseAr.body);
      expect(bodyAr).toHaveProperty('title');

      // Test with English language header
      const responseEn = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id?lang=en',
      });

      expect(responseEn.statusCode).toBe(200);
      const bodyEn = JSON.parse(responseEn.body);
      expect(bodyEn).toHaveProperty('title');
    });
  });

  describe('GET /api/v1/products/{productId}/offers', () => {
    it('should return 200 with offers list schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id/offers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Offers list schema validation
      expect(body).toHaveProperty('productId');
      expect(body).toHaveProperty('offers');
      expect(Array.isArray(body.offers)).toBe(true);

      if (body.offers.length > 0) {
        const offer = body.offers[0];
        expect(offer).toHaveProperty('id');
        expect(offer).toHaveProperty('storeId');
        expect(offer).toHaveProperty('storeName');
        expect(offer).toHaveProperty('price');
        expect(offer).toHaveProperty('currency');
        expect(offer).toHaveProperty('availability');
        expect(offer).toHaveProperty('shippingInfo');
        expect(offer).toHaveProperty('freshness');
        expect(offer).toHaveProperty('rankingReason');
        expect(offer).toHaveProperty('provenance');
      }
    });

    it('should filter offers by exactMatch flag', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id/offers?exactMatch=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.offers)).toBe(true);

      // All returned offers should be marked as exact matches
      if (body.offers.length > 0) {
        body.offers.forEach((offer: any) => {
          expect(offer.matchType).toBe('exact');
        });
      }
    });

    it('should include freshness and stale offer indication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id/offers?includeStale=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.offers.length > 0) {
        const offer = body.offers[0];
        // Freshness is measured in hours since last update
        expect(typeof offer.freshness).toBe('object');
        expect(offer.freshness).toHaveProperty('hoursOld');
        expect(offer.freshness).toHaveProperty('isStale');
        expect(offer.freshness).toHaveProperty('lastUpdatedAt');
      }
    });

    it('should exclude stale offers by default (12-hour SLA)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/test-product-id/offers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Stale offers should not be in default response
      if (body.offers.length > 0) {
        body.offers.forEach((offer: any) => {
          expect(offer.freshness.isStale).toBe(false);
        });
      }
    });

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/non-existent/offers',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('OpenAPI Spec Validation', () => {
    it('should have product endpoints documented in OpenAPI schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/openapi.json',
      });

      expect(response.statusCode).toBe(200);
      const spec = JSON.parse(response.body);

      // Check paths exist
      expect(spec.paths).toHaveProperty('/api/v1/products/{productId}');
      expect(spec.paths).toHaveProperty('/api/v1/products/{productId}/offers');

      // Check schemas exist
      expect(spec.components.schemas).toHaveProperty('ProductDetail');
      expect(spec.components.schemas).toHaveProperty('OffersList');
      expect(spec.components.schemas).toHaveProperty('Offer');
      expect(spec.components.schemas).toHaveProperty('SimilarProduct');
    });
  });
});
