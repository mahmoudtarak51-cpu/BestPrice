import type { FetchResult, ParsedListing } from '../base/source-adapter.js';

type RetailerBRecord = {
  id: string;
  productUrl: string;
  headline: string;
  maker: string;
  department: string;
  currentPrice: string;
  deliveryFee: string;
  stockStatus: string;
  attributes: Record<string, unknown>;
};

export function parseRetailerBListings(
  fetchResult: FetchResult<RetailerBRecord>,
): ParsedListing[] {
  return fetchResult.records.map((record) => ({
    externalId: record.id,
    sourceUrl: record.productUrl,
    titleRaw: record.headline,
    brandRaw: record.maker,
    categoryRaw: record.department,
    priceRaw: record.currentPrice,
    shippingRaw: record.deliveryFee,
    availabilityRaw: record.stockStatus,
    attributesRaw: record.attributes,
    payload: record,
  }));
}