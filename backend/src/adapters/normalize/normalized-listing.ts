import type {
  AvailabilityStatus,
  NormalizedListing,
} from '../base/source-adapter.js';

export type NormalizedCatalogListing = NormalizedListing & {
  adapterKey: string;
  storeId: string;
  storeName: string;
  trustScore: number;
  imageUrl?: string | null;
};

export type PriceSummary = {
  priceEgp: number | null;
  shippingEgp: number | null;
  landedPriceEgp: number | null;
};

export function buildPriceSummary(input: {
  priceEgp?: number | null;
  shippingEgp?: number | null;
}): PriceSummary {
  const priceEgp = input.priceEgp ?? null;
  const shippingEgp = input.shippingEgp ?? null;

  return {
    priceEgp,
    shippingEgp,
    landedPriceEgp:
      priceEgp === null ? null : priceEgp + Math.max(shippingEgp ?? 0, 0),
  };
}

export function normalizeAvailability(
  input?: string | null,
): AvailabilityStatus {
  const value = (input ?? '').trim().toLowerCase();

  if (['in stock', 'available', 'متوفر', 'available now'].includes(value)) {
    return 'in_stock';
  }

  if (['few left', 'limited', 'كمية محدودة'].includes(value)) {
    return 'limited';
  }

  if (['out of stock', 'sold out', 'غير متوفر'].includes(value)) {
    return 'out_of_stock';
  }

  return 'unknown';
}

export function extractModelNumber(
  title: string,
  attributes: Record<string, unknown>,
): string | null {
  const attributeValue = attributes.modelNumber;

  if (typeof attributeValue === 'string' && attributeValue.trim().length > 0) {
    return attributeValue.trim().toUpperCase();
  }

  const modelMatch = title.match(/[A-Z]{1,4}-?[A-Z0-9]{2,}|\b(?:S24|A55|15|XM5|16IRX9)\b/gi);

  return modelMatch?.[0]?.toUpperCase() ?? null;
}

export function stableIdFromParts(parts: string[]): string {
  const source = parts.join(':').toLowerCase();
  let hash = 0;

  for (const character of source) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }

  const normalized = Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);

  return `00000000-0000-4000-8000-${normalized}`;
}