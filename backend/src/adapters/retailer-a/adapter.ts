import {
  BaseSourceAdapter,
  type FetchResult,
  type SourceAdapterRunContext,
} from '../base/source-adapter.js';
import { normalizeListing } from '../normalize/normalization-service.js';
import { parseRetailerAListings } from './parser.js';

const retailerARecords = [
  {
    sku: 'a-iphone-15-128',
    url: 'https://retailer-a.example/iphone-15-128',
    title: 'Apple iPhone 15 128GB',
    brand: 'Apple',
    category: 'phones',
    price: '29999 EGP',
    shipping: '500 EGP',
    availability: 'in stock',
    specs: {
      modelNumber: '15',
      storage: '128GB',
      imageUrl: 'https://images.example/iphone-15.jpg',
    },
  },
  {
    sku: 'a-galaxy-s24-256',
    url: 'https://retailer-a.example/galaxy-s24-256',
    title: 'Samsung Galaxy S24 256GB',
    brand: 'Samsung',
    category: 'phones',
    price: '34999 EGP',
    shipping: '0 EGP',
    availability: 'in stock',
    specs: {
      modelNumber: 'S24',
      storage: '256GB',
      imageUrl: 'https://images.example/galaxy-s24.jpg',
    },
  },
  {
    sku: 'a-stale-tv',
    url: 'https://retailer-a.example/stale-tv',
    title: 'Samsung Crystal UHD TV 55 Inch',
    brand: 'Samsung',
    category: 'tvs',
    price: '21999 EGP',
    shipping: '150 EGP',
    availability: 'in stock',
    specs: {
      modelNumber: '55DU7000',
      size: '55 inch',
      imageUrl: 'https://images.example/samsung-tv.jpg',
    },
  },
] as const;

export class RetailerAAdapter extends BaseSourceAdapter {
  readonly key = 'retailer-a';
  readonly transport = 'json' as const;

  fetch(runContext: SourceAdapterRunContext): FetchResult<(typeof retailerARecords)[number]> {
    return {
      runId: 'run-retailer-a',
      fetchedAt: runContext.scheduledAt.toISOString(),
      transport: this.transport,
      records: [...retailerARecords],
    };
  }

  parse(fetchResult: FetchResult<(typeof retailerARecords)[number]>) {
    return parseRetailerAListings(fetchResult);
  }

  normalize(parsedListing: ReturnType<typeof parseRetailerAListings>[number]) {
    const now = new Date();
    const fetchedAt =
      parsedListing.externalId === 'a-stale-tv'
        ? new Date(now.getTime() - 13 * 60 * 60 * 1000).toISOString()
        : now.toISOString();

    return normalizeListing({
      parsedListing,
      adapterKey: this.key,
      storeId: 'store-retailer-a',
      storeName: 'Retailer A',
      trustScore: 82,
      fetchedAt,
    });
  }
}

export function createRetailerAAdapter(): RetailerAAdapter {
  return new RetailerAAdapter();
}