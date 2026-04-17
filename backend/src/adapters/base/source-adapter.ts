import type { LaunchCategorySlug } from '../../db/schema.js';
import {
  validateNormalizedListing,
  type ValidationResult,
} from './validation.js';

export type AdapterRunType = 'scheduled' | 'manual' | 'retry';
export type AdapterTransport = 'html' | 'json';
export type AvailabilityStatus =
  | 'in_stock'
  | 'limited'
  | 'out_of_stock'
  | 'unknown';

export type SourceAdapterRunContext = {
  adapterKey: string;
  scheduledAt: Date;
  runType: AdapterRunType;
  cursor?: string | null;
};

export type FetchResult<RecordShape = Record<string, unknown>> = {
  runId: string;
  fetchedAt: string;
  transport: AdapterTransport;
  records: RecordShape[];
  nextCursor?: string | null;
};

export type ParsedListing = {
  externalId: string;
  sourceUrl: string;
  titleRaw: string;
  brandRaw?: string | null;
  categoryRaw?: string | null;
  priceRaw?: string | null;
  shippingRaw?: string | null;
  availabilityRaw?: string | null;
  attributesRaw: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type NormalizedListing = {
  externalId: string;
  canonicalSourceUrl: string;
  title: string;
  brandName?: string | null;
  categorySlug: LaunchCategorySlug;
  modelNumber?: string | null;
  gtin?: string | null;
  specs: Record<string, unknown>;
  priceEgp?: number | null;
  shippingEgp?: number | null;
  availabilityStatus: AvailabilityStatus;
  fetchedAt: string;
};

export interface SourceAdapter {
  readonly key: string;
  readonly transport: AdapterTransport;
  fetch(
    runContext: SourceAdapterRunContext,
  ): Promise<FetchResult> | FetchResult;
  parse(fetchResult: FetchResult): Promise<ParsedListing[]> | ParsedListing[];
  normalize(
    parsedListing: ParsedListing,
  ): Promise<NormalizedListing> | NormalizedListing;
  validate(
    listing: NormalizedListing,
    runContext: SourceAdapterRunContext,
  ): Promise<ValidationResult> | ValidationResult;
}

export abstract class BaseSourceAdapter implements SourceAdapter {
  abstract readonly key: string;
  abstract readonly transport: AdapterTransport;

  abstract fetch(
    runContext: SourceAdapterRunContext,
  ): Promise<FetchResult> | FetchResult;

  abstract parse(fetchResult: FetchResult): Promise<ParsedListing[]> | ParsedListing[];

  abstract normalize(
    parsedListing: ParsedListing,
  ): Promise<NormalizedListing> | NormalizedListing;

  validate(
    listing: NormalizedListing,
    runContext: SourceAdapterRunContext,
  ): Promise<ValidationResult> | ValidationResult {
    return validateNormalizedListing(listing, runContext);
  }
}
