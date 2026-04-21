import { describe, expect, it } from 'vitest';

import type { NormalizedCatalogListing } from '../../src/adapters/normalize/normalized-listing.js';
import { matchCatalogListings } from '../../src/matching/matching-service.js';
import {
  buildCanonicalKey,
  determineMatchLevel,
} from '../../src/matching/rules.js';

function createListing(
  overrides: Partial<NormalizedCatalogListing>,
): NormalizedCatalogListing {
  return {
    adapterKey: 'retailer-a',
    storeId: 'store-a',
    storeName: 'Retailer A',
    trustScore: 88,
    externalId: 'listing-1',
    canonicalSourceUrl: 'https://retailer-a.example/products/listing-1',
    title: 'Samsung Galaxy S24 256GB',
    brandName: 'Samsung',
    categorySlug: 'phones',
    modelNumber: 'S24',
    gtin: null,
    specs: {
      storage: '256GB',
    },
    priceEgp: 33999,
    shippingEgp: 250,
    availabilityStatus: 'in_stock',
    fetchedAt: '2026-04-17T09:55:00.000Z',
    ...overrides,
  };
}

describe('matching service', () => {
  it('uses the model number for deterministic canonical keys', () => {
    const key = buildCanonicalKey(
      createListing({
        title: 'Samsung Galaxy S24 Ultra 256GB',
      }),
    );

    expect(key).toBe('phones:samsung:s24');
  });

  it('classifies identical model numbers as exact matches', () => {
    const representative = createListing({});
    const candidate = createListing({
      externalId: 'listing-2',
      adapterKey: 'retailer-b',
      storeId: 'store-b',
      storeName: 'Retailer B',
      canonicalSourceUrl: 'https://retailer-b.example/products/listing-2',
    });

    expect(
      determineMatchLevel({
        listing: candidate,
        representative,
      }),
    ).toEqual({
      level: 'exact',
      confidence: 1,
    });
  });

  it('falls back to likely matches once title similarity crosses the threshold', () => {
    const representative = createListing({
      title: 'Apple iPhone 15 Pro Max 256GB',
      brandName: 'Apple',
      modelNumber: null,
    });
    const candidate = createListing({
      externalId: 'listing-3',
      title: 'Apple iPhone 15 Pro 256GB',
      brandName: 'Apple',
      modelNumber: null,
    });

    const result = determineMatchLevel({
      listing: candidate,
      representative,
    });

    expect(result.level).toBe('likely');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('keeps low-similarity items in the similar bucket and floors the confidence', () => {
    const representative = createListing({
      title: 'Sony WH-1000XM5 Wireless Headphones',
      brandName: 'Sony',
      categorySlug: 'headphones',
      modelNumber: null,
    });
    const candidate = createListing({
      externalId: 'listing-4',
      title: 'Sony PlayStation 5 Console',
      brandName: 'Sony',
      categorySlug: 'headphones',
      modelNumber: null,
    });

    expect(
      determineMatchLevel({
        listing: candidate,
        representative,
      }),
    ).toEqual({
      level: 'similar',
      confidence: 0.35,
    });
  });

  it('groups listings that share a canonical key under one product id', () => {
    const matched = matchCatalogListings([
      createListing({}),
      createListing({
        externalId: 'listing-5',
        adapterKey: 'retailer-b',
        storeId: 'store-b',
        storeName: 'Retailer B',
        canonicalSourceUrl: 'https://retailer-b.example/products/listing-5',
      }),
    ]);

    expect(matched).toHaveLength(2);
    expect(matched[0]?.canonicalProductId).toBe(matched[1]?.canonicalProductId);
    expect(matched.every((candidate) => candidate.matchLevel === 'exact')).toBe(
      true,
    );
  });
});
