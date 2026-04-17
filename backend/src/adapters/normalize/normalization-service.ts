import { normalizeArabicText, normalizeLatinText } from '../../search/query-normalizer.js';
import type { ParsedListing } from '../base/source-adapter.js';
import type { LaunchCategorySlug } from '../../db/schema.js';
import {
  buildPriceSummary,
  extractModelNumber,
  normalizeAvailability,
  type NormalizedCatalogListing,
} from './normalized-listing.js';

const brandAliases = new Map<string, string>([
  ['apple', 'Apple'],
  ['ابل', 'Apple'],
  ['أبل', 'Apple'],
  ['iphone', 'Apple'],
  ['samsung', 'Samsung'],
  ['سامسونج', 'Samsung'],
  ['lenovo', 'Lenovo'],
  ['لينوفو', 'Lenovo'],
  ['sony', 'Sony'],
  ['سوني', 'Sony'],
]);

const categoryAliases = new Map<string, LaunchCategorySlug>([
  ['phones', 'phones'],
  ['phone', 'phones'],
  ['هواتف', 'phones'],
  ['لابتوب', 'laptops'],
  ['laptop', 'laptops'],
  ['laptops', 'laptops'],
  ['headphones', 'headphones'],
  ['سماعات', 'headphones'],
  ['tv', 'tvs'],
  ['tvs', 'tvs'],
  ['تلفزيون', 'tvs'],
]);

export function normalizeBrandName(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const candidate = normalizeArabicText(normalizeLatinText(input));

  for (const [alias, brand] of brandAliases.entries()) {
    if (candidate.includes(normalizeArabicText(normalizeLatinText(alias)))) {
      return brand;
    }
  }

  return input.trim();
}

export function normalizeCategorySlug(input?: string | null): LaunchCategorySlug {
  const candidate = normalizeArabicText(normalizeLatinText(input ?? 'phones'));

  for (const [alias, category] of categoryAliases.entries()) {
    if (candidate.includes(normalizeArabicText(normalizeLatinText(alias)))) {
      return category;
    }
  }

  return 'phones';
}

export function parseMoneyValue(input?: string | null): number | null {
  if (!input) {
    return null;
  }

  const sanitized = input.replace(/[^0-9.]/g, '');
  const parsed = Number(sanitized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeListing(input: {
  parsedListing: ParsedListing;
  adapterKey: string;
  storeId: string;
  storeName: string;
  trustScore: number;
  fetchedAt: string;
}): NormalizedCatalogListing {
  const parsedListing = input.parsedListing;
  const brandName = normalizeBrandName(parsedListing.brandRaw);
  const categorySlug = normalizeCategorySlug(parsedListing.categoryRaw);
  const priceSummary = buildPriceSummary({
    priceEgp: parseMoneyValue(parsedListing.priceRaw),
    shippingEgp: parseMoneyValue(parsedListing.shippingRaw),
  });
  const normalizedTitle = parsedListing.titleRaw.trim();

  return {
    adapterKey: input.adapterKey,
    storeId: input.storeId,
    storeName: input.storeName,
    trustScore: input.trustScore,
    externalId: parsedListing.externalId,
    canonicalSourceUrl: parsedListing.sourceUrl,
    title: normalizedTitle,
    brandName,
    categorySlug,
    modelNumber: extractModelNumber(normalizedTitle, parsedListing.attributesRaw),
    gtin:
      typeof parsedListing.attributesRaw.gtin === 'string'
        ? parsedListing.attributesRaw.gtin
        : null,
    specs: parsedListing.attributesRaw,
    priceEgp: priceSummary.priceEgp,
    shippingEgp: priceSummary.shippingEgp,
    availabilityStatus: normalizeAvailability(parsedListing.availabilityRaw),
    fetchedAt: input.fetchedAt,
    imageUrl:
      typeof parsedListing.attributesRaw.imageUrl === 'string'
        ? parsedListing.attributesRaw.imageUrl
        : null,
  };
}