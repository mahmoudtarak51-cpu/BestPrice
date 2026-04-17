import { normalizeQuery } from '../search/query-normalizer.js';
import type { NormalizedCatalogListing } from '../adapters/normalize/normalized-listing.js';

export function buildCanonicalKey(listing: NormalizedCatalogListing): string {
  const brand = listing.brandName?.toLowerCase() ?? 'unknown';
  const category = listing.categorySlug;
  const model = listing.modelNumber?.toLowerCase();

  if (model) {
    return `${category}:${brand}:${model}`;
  }

  const tokens = normalizeQuery(listing.title).tokens.slice(0, 3).join('-');

  return `${category}:${brand}:${tokens}`;
}

export function calculateTitleSimilarity(
  leftTitle: string,
  rightTitle: string,
): number {
  const left = new Set(normalizeQuery(leftTitle).tokens);
  const right = new Set(normalizeQuery(rightTitle).tokens);

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of left) {
    if (right.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(left.size, right.size);
}

export function determineMatchLevel(input: {
  listing: NormalizedCatalogListing;
  representative: NormalizedCatalogListing;
}): { level: 'exact' | 'likely' | 'similar'; confidence: number } {
  const sameModel =
    input.listing.modelNumber
    && input.representative.modelNumber
    && input.listing.modelNumber === input.representative.modelNumber;

  if (sameModel) {
    return {
      level: 'exact',
      confidence: 1,
    };
  }

  const similarity = calculateTitleSimilarity(
    input.listing.title,
    input.representative.title,
  );

  if (similarity >= 0.7) {
    return {
      level: 'likely',
      confidence: Number(similarity.toFixed(2)),
    };
  }

  return {
    level: 'similar',
    confidence: Number(Math.max(similarity, 0.35).toFixed(2)),
  };
}