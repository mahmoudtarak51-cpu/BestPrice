import type { FetchResult, ParsedListing } from '../base/source-adapter.js';

type RetailerARecord = {
  sku: string;
  url: string;
  title: string;
  brand: string;
  category: string;
  price: string;
  shipping: string;
  availability: string;
  specs: Record<string, unknown>;
};

export function parseRetailerAListings(
  fetchResult: FetchResult<RetailerARecord>,
): ParsedListing[] {
  return fetchResult.records.map((record) => ({
    externalId: record.sku,
    sourceUrl: record.url,
    titleRaw: record.title,
    brandRaw: record.brand,
    categoryRaw: record.category,
    priceRaw: record.price,
    shippingRaw: record.shipping,
    availabilityRaw: record.availability,
    attributesRaw: record.specs,
    payload: record,
  }));
}