import {
  BaseSourceAdapter,
  type FetchResult,
  type SourceAdapterRunContext,
} from '../base/source-adapter.js';
import { normalizeListing } from '../normalize/normalization-service.js';
import { parseRetailerBListings } from './parser.js';

const retailerBRecords = [
  {
    id: 'b-iphone-15-128',
    productUrl: 'https://retailer-b.example/iphone-15-128',
    headline: 'ابل ايفون 15 سعة 128 جيجابايت',
    maker: 'ابل',
    department: 'هواتف',
    currentPrice: '30499 EGP',
    deliveryFee: '0 EGP',
    stockStatus: 'متوفر',
    attributes: {
      modelNumber: '15',
      storage: '128GB',
      imageUrl: 'https://images.example/iphone-15-b.jpg',
    },
  },
  {
    id: 'b-galaxy-s24-256',
    productUrl: 'https://retailer-b.example/galaxy-s24-256',
    headline: 'سامسونج جالكسي S24 256 جيجابايت',
    maker: 'سامسونج',
    department: 'هواتف',
    currentPrice: '33999 EGP',
    deliveryFee: '250 EGP',
    stockStatus: 'متوفر',
    attributes: {
      modelNumber: 'S24',
      storage: '256GB',
      imageUrl: 'https://images.example/galaxy-s24-b.jpg',
    },
  },
] as const;

export class RetailerBAdapter extends BaseSourceAdapter {
  readonly key = 'retailer-b';
  readonly transport = 'json' as const;

  fetch(runContext: SourceAdapterRunContext): FetchResult<(typeof retailerBRecords)[number]> {
    return {
      runId: 'run-retailer-b',
      fetchedAt: runContext.scheduledAt.toISOString(),
      transport: this.transport,
      records: [...retailerBRecords],
    };
  }

  parse(fetchResult: FetchResult<(typeof retailerBRecords)[number]>) {
    return parseRetailerBListings(fetchResult);
  }

  normalize(parsedListing: ReturnType<typeof parseRetailerBListings>[number]) {
    return normalizeListing({
      parsedListing,
      adapterKey: this.key,
      storeId: 'store-retailer-b',
      storeName: 'Retailer B',
      trustScore: 91,
      fetchedAt: new Date().toISOString(),
    });
  }
}

export function createRetailerBAdapter(): RetailerBAdapter {
  return new RetailerBAdapter();
}