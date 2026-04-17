import { launchCategorySlugs } from '../../db/schema.js';
import type {
  NormalizedListing,
  SourceAdapterRunContext,
} from './source-adapter.js';

export type ValidationSeverity = 'info' | 'warning' | 'error';

export type ValidationResult = {
  accepted: boolean;
  severity: ValidationSeverity;
  rejectionCode: string | null;
  messages: string[];
};

const supportedCategories = new Set<string>(launchCategorySlugs);

export function validateNormalizedListing(
  listing: NormalizedListing,
  runContext: SourceAdapterRunContext,
): ValidationResult {
  const errors: string[] = [];
  let rejectionCode: string | null = null;

  if (!listing.externalId) {
    rejectionCode ??= 'missing_external_id';
    errors.push('Normalized listing is missing externalId.');
  }

  if (!listing.canonicalSourceUrl) {
    rejectionCode ??= 'missing_source_url';
    errors.push('Normalized listing is missing canonicalSourceUrl.');
  }

  if (!listing.title) {
    rejectionCode ??= 'missing_title';
    errors.push('Normalized listing is missing title.');
  }

  if (!listing.categorySlug) {
    rejectionCode ??= 'missing_category';
    errors.push('Normalized listing is missing categorySlug.');
  }

  if (listing.categorySlug && !supportedCategories.has(listing.categorySlug)) {
    rejectionCode ??= 'unsupported_category';
    errors.push(`Unsupported category "${listing.categorySlug}".`);
  }

  if (listing.priceEgp !== null && listing.priceEgp !== undefined && listing.priceEgp < 0) {
    rejectionCode ??= 'negative_price';
    errors.push('Price cannot be negative.');
  }

  if (
    listing.shippingEgp !== null &&
    listing.shippingEgp !== undefined &&
    listing.shippingEgp < 0
  ) {
    rejectionCode ??= 'negative_shipping';
    errors.push('Shipping cannot be negative.');
  }

  const fetchedAt = new Date(listing.fetchedAt);
  const maxAgeMs = 24 * 60 * 60 * 1000;

  if (Number.isNaN(fetchedAt.getTime())) {
    rejectionCode ??= 'invalid_fetched_at';
    errors.push('Fetched timestamp is invalid.');
  } else {
    const ageMs = runContext.scheduledAt.getTime() - fetchedAt.getTime();

    if (ageMs > maxAgeMs) {
      rejectionCode ??= 'listing_too_old';
      errors.push('Listing is older than the 24-hour validation window.');
    }
  }

  if (errors.length > 0) {
    return {
      accepted: false,
      severity: 'error',
      rejectionCode,
      messages: errors,
    };
  }

  return {
    accepted: true,
    severity: 'info',
    rejectionCode: null,
    messages: ['Listing passed shared adapter validation.'],
  };
}
