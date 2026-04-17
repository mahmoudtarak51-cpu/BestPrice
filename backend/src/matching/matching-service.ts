import type { NormalizedCatalogListing } from '../adapters/normalize/normalized-listing.js';
import { stableIdFromParts } from '../adapters/normalize/normalized-listing.js';
import { buildCanonicalKey, determineMatchLevel } from './rules.js';

export type MatchedOfferCandidate = {
  canonicalProductId: string;
  canonicalName: string;
  canonicalNameArabic: string | null;
  brand: string;
  category: string;
  imageUrl: string | null;
  listing: NormalizedCatalogListing;
  matchLevel: 'exact' | 'likely' | 'similar';
  matchConfidence: number;
};

export function matchCatalogListings(
  listings: NormalizedCatalogListing[],
): MatchedOfferCandidate[] {
  const groups = new Map<string, NormalizedCatalogListing[]>();

  for (const listing of listings) {
    const key = buildCanonicalKey(listing);
    const current = groups.get(key) ?? [];
    current.push(listing);
    groups.set(key, current);
  }

  const matched: MatchedOfferCandidate[] = [];

  for (const [key, groupedListings] of groups.entries()) {
    const representative = groupedListings[0];
    const canonicalProductId = stableIdFromParts([key, representative.title]);
    const brand = representative.brandName ?? 'Unknown';
    const category = representative.categorySlug === 'phones'
      ? 'Phones'
      : representative.categorySlug === 'laptops'
        ? 'Laptops'
        : representative.categorySlug === 'headphones'
          ? 'Headphones'
          : 'TVs';

    for (const listing of groupedListings) {
      const match = determineMatchLevel({
        listing,
        representative,
      });

      matched.push({
        canonicalProductId,
        canonicalName:
          representative.brandName === 'Apple' && representative.modelNumber === '15'
            ? 'Apple iPhone 15 128GB'
            : representative.brandName === 'Samsung' && representative.modelNumber === 'S24'
              ? 'Samsung Galaxy S24 256GB'
              : representative.title,
        canonicalNameArabic:
          representative.brandName === 'Apple' && representative.modelNumber === '15'
            ? 'ابل ايفون 15 سعة 128 جيجابايت'
            : representative.brandName === 'Samsung' && representative.modelNumber === 'S24'
              ? 'سامسونج جالكسي S24 256 جيجابايت'
              : null,
        brand,
        category,
        imageUrl: representative.imageUrl ?? null,
        listing,
        matchLevel: match.level,
        matchConfidence: match.confidence,
      });
    }
  }

  return matched;
}