import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from '../setup/database';
import { buildServer } from '../../src/api/server';
import Fastify from 'fastify';

describe('Product Detail Flow Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;
  let db: Database;

  beforeAll(async () => {
    app = await buildServer();
    db = new Database();
    await db.connect();
  });

  afterAll(async () => {
    await app.close();
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clearTestData();
    await db.seedTestData();
  });

  describe('Product Detail Page Flow', () => {
    it('should retrieve product details with exact and similar offers', async () => {
      // Setup: Create a canonical product with offers from two retailers
      const productId = await db.createCanonicalProduct({
        title: 'iPhone 15 Pro',
        category: 'phones',
        brand: 'Apple',
        model: 'A2846',
      });

      // Create exact match offers from both retailers
      const storeA = await db.getStoreId('retailer-a');
      const storeB = await db.getStoreId('retailer-b');

      await db.createOffer({
        productId,
        storeId: storeA,
        price: 45000,
        currency: 'EGP',
        availability: 'in_stock',
      });

      await db.createOffer({
        productId,
        storeId: storeB,
        price: 46000,
        currency: 'EGP',
        availability: 'in_stock',
      });

      // Create a similar product (e.g., iPhone 15 standard)
      const similarProductId = await db.createCanonicalProduct({
        title: 'iPhone 15',
        category: 'phones',
        brand: 'Apple',
        model: 'A2844',
      });

      // Act: Request product detail page
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}`,
      });

      // Assert: Response includes exact and similar products
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe(productId);
      expect(body.exactOffers).toHaveLength(2);
      expect(body.similarProducts.map((p: any) => p.id)).toContain(
        similarProductId
      );

      // Verify offer ordering (best overall first, then cheapest)
      const offers = body.exactOffers;
      expect(offers[0].price).toBeLessThanOrEqual(offers[1].price);
    });

    it('should exclude stale offers from shopper view but include in admin view', async () => {
      // Setup: Create a product with a stale offer
      const productId = await db.createCanonicalProduct({
        title: 'Samsung Galaxy S24',
        category: 'phones',
        brand: 'Samsung',
        model: 'SM-S921B',
      });

      const storeId = await db.getStoreId('retailer-a');

      // Create an offer that is 13 hours old (beyond 12-hour SLA)
      const staleCrawlTime = new Date(Date.now() - 13 * 60 * 60 * 1000);
      await db.createOffer({
        productId,
        storeId,
        price: 35000,
        currency: 'EGP',
        availability: 'in_stock',
        lastUpdatedAt: staleCrawlTime,
      });

      // Act: Request product detail (shopper view - no includeStale)
      const shoppingResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}`,
      });

      expect(shoppingResponse.statusCode).toBe(200);
      const shoppingBody = JSON.parse(shoppingResponse.body);

      // Assert: Stale offers are not shown to shoppers
      expect(shoppingBody.exactOffers).toHaveLength(0);

      // Act: Request with includeStale for admin/testing
      const adminResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}?includeStale=true`,
      });

      expect(adminResponse.statusCode).toBe(200);
      const adminBody = JSON.parse(adminResponse.body);

      // Assert: Stale offers are shown to admins
      expect(adminBody.exactOffers.length).toBeGreaterThan(0);
      const staleOffer = adminBody.exactOffers[0];
      expect(staleOffer.freshness.isStale).toBe(true);
      expect(staleOffer.freshness.hoursOld).toBeGreaterThan(12);
    });

    it('should correctly classify exact vs similar product matches', async () => {
      // Setup: Create exact match and similar variants
      const exactProductId = await db.createCanonicalProduct({
        title: 'Dell XPS 15 (9530)',
        category: 'laptops',
        brand: 'Dell',
        model: 'XPS9530',
        gtin: '5397184506429',
      });

      const similarProductId = await db.createCanonicalProduct({
        title: 'Dell XPS 15 (9520)',
        category: 'laptops',
        brand: 'Dell',
        model: 'XPS9520',
        gtin: '5397184506420',
      });

      // Create offers for exact product
      const storeId = await db.getStoreId('retailer-a');
      await db.createOffer({
        productId: exactProductId,
        storeId,
        price: 80000,
        currency: 'EGP',
        availability: 'in_stock',
      });

      // Act: Request product detail for exact product
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${exactProductId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Assert: Similar product is classified with match confidence
      expect(body.similarProducts).toHaveLength(1);
      const similar = body.similarProducts[0];
      expect(similar.id).toBe(similarProductId);
      expect(similar).toHaveProperty('matchConfidence');
      expect(similar).toHaveProperty('matchReason');
      expect(similar.matchReason).toContain('Dell');
      expect(similar.matchReason).toContain('XPS');
    });

    it('should return best overall and cheapest offer badges', async () => {
      // Setup: Create product with varying prices and trust scores
      const productId = await db.createCanonicalProduct({
        title: 'Sony WH-CH720 Headphones',
        category: 'headphones',
        brand: 'Sony',
        model: 'WH-CH720',
      });

      const store1 = await db.getStoreId('retailer-a');
      const store2 = await db.getStoreId('retailer-b');

      // Store A: Higher price but higher trust
      await db.createOffer({
        productId,
        storeId: store1,
        price: 3500,
        currency: 'EGP',
        availability: 'in_stock',
        rankingReason: 'best_overall',
      });

      // Store B: Lower price but lower trust
      await db.createOffer({
        productId,
        storeId: store2,
        price: 3200,
        currency: 'EGP',
        availability: 'in_stock',
        rankingReason: 'cheapest',
      });

      // Act: Request product detail
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Assert: Offers have ranking reasons
      expect(body.exactOffers).toHaveLength(2);
      const bestOverall = body.exactOffers.find(
        (o: any) => o.rankingReason === 'best_overall'
      );
      const cheapest = body.exactOffers.find(
        (o: any) => o.rankingReason === 'cheapest'
      );

      expect(bestOverall).toBeDefined();
      expect(cheapest).toBeDefined();
      expect(bestOverall.price).toBeGreaterThan(cheapest.price);
    });

    it('should handle missing shipping information gracefully', async () => {
      // Setup: Create product with offers having varying shipping info
      const productId = await db.createCanonicalProduct({
        title: 'Test Product',
        category: 'electronics',
        brand: 'Test Brand',
        model: 'TEST-001',
      });

      const storeId = await db.getStoreId('retailer-a');
      await db.createOffer({
        productId,
        storeId,
        price: 5000,
        currency: 'EGP',
        availability: 'in_stock',
        shippingInfo: null,
      });

      // Act: Request product detail
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Assert: Handle missing shipping gracefully
      expect(body.exactOffers[0]).toHaveProperty('shippingInfo');
      expect(body.exactOffers[0].shippingInfo).toEqual({
        available: false,
        message: 'Shipping information not available',
      });
    });
  });

  describe('Offers Comparison Flow', () => {
    it('should return complete offers list with all metadata', async () => {
      // Setup
      const productId = await db.createCanonicalProduct({
        title: 'LG 55UP7550 TV',
        category: 'tvs',
        brand: 'LG',
        model: '55UP7550',
      });

      const storeId = await db.getStoreId('retailer-a');
      await db.createOffer({
        productId,
        storeId,
        price: 28000,
        currency: 'EGP',
        availability: 'in_stock',
        provenance: {
          lastFetchedAt: new Date(),
          sourceUrl: 'https://retailer-a.example/products/123',
        },
      });

      // Act: Request offers list
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${productId}/offers`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Assert: All required metadata is present
      expect(body.offers).toHaveLength(1);
      const offer = body.offers[0];

      expect(offer).toHaveProperty('id');
      expect(offer).toHaveProperty('storeId');
      expect(offer).toHaveProperty('storeName');
      expect(offer).toHaveProperty('price');
      expect(offer).toHaveProperty('currency');
      expect(offer).toHaveProperty('availability');
      expect(offer).toHaveProperty('freshness');
      expect(offer).toHaveProperty('rankingReason');
      expect(offer).toHaveProperty('provenance');
      expect(offer.provenance).toHaveProperty('lastFetchedAt');
      expect(offer.provenance).toHaveProperty('sourceUrl');
    });
  });
});
