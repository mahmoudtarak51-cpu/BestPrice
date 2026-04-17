import { describe, expect, it } from 'vitest';

import { rankOffers } from '../../src/ranking/ranking-service.js';

describe('ranking service', () => {
  it('prefers fresher in-stock offers for best overall while preserving cheapest badge', () => {
    const ranked = rankOffers([
      {
        offerId: 'offer-a',
        storeId: 'store-a',
        storeName: 'Retailer A',
        priceEgp: 29999,
        shippingEgp: 500,
        availabilityStatus: 'in_stock',
        matchConfidence: 1,
        trustScore: 82,
        lastSuccessfulUpdateAt: '2026-04-17T09:30:00.000Z',
        buyUrl: 'https://retailer-a.example/iphone-15',
      },
      {
        offerId: 'offer-b',
        storeId: 'store-b',
        storeName: 'Retailer B',
        priceEgp: 30499,
        shippingEgp: 0,
        availabilityStatus: 'in_stock',
        matchConfidence: 1,
        trustScore: 91,
        lastSuccessfulUpdateAt: '2026-04-17T09:55:00.000Z',
        buyUrl: 'https://retailer-b.example/iphone-15',
      },
    ], {
      now: new Date('2026-04-17T10:00:00.000Z'),
    });

    expect(ranked.bestOverallOffer.offerId).toBe('offer-b');
    expect(ranked.cheapestOffer?.offerId).toBe('offer-a');
    expect(ranked.offers[0]?.reasonCodes.length).toBeGreaterThan(0);
  });
});