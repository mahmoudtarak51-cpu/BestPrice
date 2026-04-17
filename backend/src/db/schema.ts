import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const launchCategorySlugs = [
  'phones',
  'laptops',
  'headphones',
  'tvs',
] as const;

export type LaunchCategorySlug = (typeof launchCategorySlugs)[number];

export const sourceAdapterTypeEnum = pgEnum('source_adapter_type', [
  'html_scrape',
  'json_api',
]);
export const sourceAdapterStatusEnum = pgEnum('source_adapter_status', [
  'active',
  'paused',
  'disabled',
]);
export const adminRoleEnum = pgEnum('admin_role', ['admin']);
export const adminStatusEnum = pgEnum('admin_status', [
  'invited',
  'active',
  'disabled',
]);
export const crawlJobTypeEnum = pgEnum('crawl_job_type', [
  'scheduled',
  'manual',
  'retry',
]);
export const crawlJobStatusEnum = pgEnum('crawl_job_status', [
  'queued',
  'running',
  'succeeded',
  'partial',
  'failed',
  'cancelled',
]);
export const crawlFailureStageEnum = pgEnum('crawl_failure_stage', [
  'fetch',
  'parse',
  'normalize',
  'validate',
  'match',
  'index',
]);
export const failureSeverityEnum = pgEnum('failure_severity', [
  'warning',
  'error',
  'critical',
]);
export const rawProductIngestStatusEnum = pgEnum('raw_product_ingest_status', [
  'fetched',
  'parsed',
  'normalized',
  'matched',
  'rejected',
]);
export const catalogStatusEnum = pgEnum('catalog_status', [
  'active',
  'review_needed',
  'hidden',
]);
export const offerMatchLevelEnum = pgEnum('offer_match_level', [
  'exact',
  'likely',
  'similar',
]);
export const offerAvailabilityStatusEnum = pgEnum('offer_availability_status', [
  'in_stock',
  'limited',
  'out_of_stock',
  'unknown',
]);
export const languageCodeEnum = pgEnum('language_code', [
  'ar',
  'en',
  'mixed',
  'unknown',
]);
export const matchingReviewStatusEnum = pgEnum('matching_review_status', [
  'pending',
  'accepted',
  'rejected',
]);

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    countryCode: text('country_code').notNull().default('EG'),
    baseUrl: text('base_url').notNull(),
    trustScore: numeric('trust_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('stores_slug_idx').on(table.slug),
    trustScoreRange: check(
      'stores_trust_score_range',
      sql`${table.trustScore} >= 0 and ${table.trustScore} <= 100`,
    ),
  }),
);

export const sourceAdapters = pgTable(
  'source_adapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    adapterType: sourceAdapterTypeEnum('adapter_type').notNull(),
    status: sourceAdapterStatusEnum('status').notNull().default('active'),
    freshnessSlaHours: integer('freshness_sla_hours').notNull().default(12),
    crawlIntervalMinutes: integer('crawl_interval_minutes')
      .notNull()
      .default(360),
    configJson: jsonb('config_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSuccessfulCrawlAt: timestamp('last_successful_crawl_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyIdx: uniqueIndex('source_adapters_key_idx').on(table.key),
    storeIdx: index('source_adapters_store_idx').on(table.storeId),
    crawlIntervalLimit: check(
      'source_adapters_crawl_interval_limit',
      sql`${table.crawlIntervalMinutes} <= 360`,
    ),
  }),
);

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: adminRoleEnum('role').notNull().default('admin'),
    status: adminStatusEnum('status').notNull().default('invited'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('admin_users_email_idx').on(table.email),
  }),
);

export const crawlJobs = pgTable(
  'crawl_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceAdapterId: uuid('source_adapter_id')
      .notNull()
      .references(() => sourceAdapters.id, { onDelete: 'cascade' }),
    triggeredByAdminId: uuid('triggered_by_admin_id').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),
    jobType: crawlJobTypeEnum('job_type').notNull(),
    status: crawlJobStatusEnum('status').notNull().default('queued'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    fetchedCount: integer('fetched_count').notNull().default(0),
    normalizedCount: integer('normalized_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceAdapterIdx: index('crawl_jobs_source_adapter_idx').on(
      table.sourceAdapterId,
    ),
  }),
);

export const crawlFailures = pgTable(
  'crawl_failures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    crawlJobId: uuid('crawl_job_id')
      .notNull()
      .references(() => crawlJobs.id, { onDelete: 'cascade' }),
    sourceAdapterId: uuid('source_adapter_id')
      .notNull()
      .references(() => sourceAdapters.id, { onDelete: 'cascade' }),
    failureStage: crawlFailureStageEnum('failure_stage').notNull(),
    severity: failureSeverityEnum('severity').notNull(),
    externalReference: text('external_reference'),
    message: text('message').notNull(),
    retriable: boolean('retriable').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    crawlJobIdx: index('crawl_failures_crawl_job_idx').on(table.crawlJobId),
    sourceAdapterIdx: index('crawl_failures_source_adapter_idx').on(
      table.sourceAdapterId,
    ),
  }),
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    parentCategoryId: uuid('parent_category_id'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    slugIdx: uniqueIndex('categories_slug_idx').on(table.slug),
  }),
);

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    canonicalName: text('canonical_name').notNull(),
    aliasesJson: jsonb('aliases_json')
      .$type<{ ar?: string[]; en?: string[]; transliterations?: string[] }>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    slugIdx: uniqueIndex('brands_slug_idx').on(table.slug),
    canonicalNameIdx: uniqueIndex('brands_canonical_name_idx').on(
      table.canonicalName,
    ),
  }),
);

export const rawProducts = pgTable(
  'raw_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceAdapterId: uuid('source_adapter_id')
      .notNull()
      .references(() => sourceAdapters.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    titleRaw: text('title_raw').notNull(),
    descriptionRaw: text('description_raw'),
    brandRaw: text('brand_raw'),
    categoryRaw: text('category_raw'),
    priceAmountEgp: numeric('price_amount_egp', { precision: 12, scale: 2 }),
    shippingAmountEgp: numeric('shipping_amount_egp', {
      precision: 12,
      scale: 2,
    }),
    availabilityRaw: text('availability_raw'),
    payloadJson: jsonb('payload_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    ingestStatus: rawProductIngestStatusEnum('ingest_status')
      .notNull()
      .default('fetched'),
  },
  (table) => ({
    sourceExternalIdx: uniqueIndex('raw_products_source_external_fetched_idx').on(
      table.sourceAdapterId,
      table.externalId,
      table.fetchedAt,
    ),
    sourceAdapterIdx: index('raw_products_source_adapter_idx').on(
      table.sourceAdapterId,
    ),
    priceNonNegative: check(
      'raw_products_price_non_negative',
      sql`${table.priceAmountEgp} is null or ${table.priceAmountEgp} >= 0`,
    ),
    shippingNonNegative: check(
      'raw_products_shipping_non_negative',
      sql`${table.shippingAmountEgp} is null or ${table.shippingAmountEgp} >= 0`,
    ),
  }),
);

export const canonicalProducts = pgTable(
  'canonical_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    canonicalNameEn: text('canonical_name_en').notNull(),
    canonicalNameAr: text('canonical_name_ar'),
    modelNumber: text('model_number'),
    gtin: text('gtin'),
    specsJson: jsonb('specs_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    imageUrl: text('image_url'),
    searchDocument: text('search_document').notNull().default(''),
    catalogStatus: catalogStatusEnum('catalog_status').notNull().default('review_needed'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    categoryIdx: index('canonical_products_category_idx').on(table.categoryId),
    brandIdx: index('canonical_products_brand_idx').on(table.brandId),
    modelIdx: index('canonical_products_model_idx').on(table.modelNumber),
    gtinIdx: index('canonical_products_gtin_idx').on(table.gtin),
  }),
);

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canonicalProductId: uuid('canonical_product_id')
      .notNull()
      .references(() => canonicalProducts.id, { onDelete: 'cascade' }),
    rawProductId: uuid('raw_product_id')
      .notNull()
      .references(() => rawProducts.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    matchLevel: offerMatchLevelEnum('match_level').notNull(),
    matchConfidence: numeric('match_confidence', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    priceAmountEgp: numeric('price_amount_egp', { precision: 12, scale: 2 })
      .notNull(),
    shippingAmountEgp: numeric('shipping_amount_egp', {
      precision: 12,
      scale: 2,
    }),
    landedPriceEgp: numeric('landed_price_egp', { precision: 12, scale: 2 }),
    availabilityStatus: offerAvailabilityStatusEnum('availability_status')
      .notNull()
      .default('unknown'),
    lastSuccessfulUpdateAt: timestamp('last_successful_update_at', {
      withTimezone: true,
    }).notNull(),
    staleAfterAt: timestamp('stale_after_at', { withTimezone: true }).notNull(),
    shopperVisible: boolean('shopper_visible').notNull().default(true),
    trustScoreSnapshot: numeric('trust_score_snapshot', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0'),
    rankingScore: numeric('ranking_score', { precision: 8, scale: 4 }),
    reasonCodesJson: jsonb('reason_codes_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    buyUrl: text('buy_url').notNull(),
  },
  (table) => ({
    canonicalProductIdx: index('offers_canonical_product_idx').on(
      table.canonicalProductId,
    ),
    storeIdx: index('offers_store_idx').on(table.storeId),
    rawProductIdx: uniqueIndex('offers_raw_product_idx').on(table.rawProductId),
    matchConfidenceRange: check(
      'offers_match_confidence_range',
      sql`${table.matchConfidence} >= 0 and ${table.matchConfidence} <= 1`,
    ),
  }),
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    priceAmountEgp: numeric('price_amount_egp', { precision: 12, scale: 2 })
      .notNull(),
    shippingAmountEgp: numeric('shipping_amount_egp', {
      precision: 12,
      scale: 2,
    }),
    availabilityStatus: offerAvailabilityStatusEnum('availability_status')
      .notNull()
      .default('unknown'),
  },
  (table) => ({
    offerObservedIdx: uniqueIndex('price_history_offer_observed_idx').on(
      table.offerId,
      table.observedAt,
    ),
  }),
);

export const searchLogs = pgTable(
  'search_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    queryText: text('query_text').notNull(),
    normalizedQuery: text('normalized_query').notNull(),
    detectedLanguage: languageCodeEnum('detected_language')
      .notNull()
      .default('unknown'),
    filtersJson: jsonb('filters_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    resultCount: integer('result_count').notNull().default(0),
    clickedCanonicalProductId: uuid('clicked_canonical_product_id').references(
      () => canonicalProducts.id,
      { onDelete: 'set null' },
    ),
    latencyMs: integer('latency_ms').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('search_logs_created_at_idx').on(table.createdAt),
  }),
);

export const matchingReviews = pgTable(
  'matching_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rawProductId: uuid('raw_product_id')
      .notNull()
      .references(() => rawProducts.id, { onDelete: 'cascade' }),
    canonicalProductId: uuid('canonical_product_id').references(
      () => canonicalProducts.id,
      { onDelete: 'set null' },
    ),
    reviewerAdminId: uuid('reviewer_admin_id').references(
      () => adminUsers.id,
      { onDelete: 'set null' },
    ),
    reviewStatus: matchingReviewStatusEnum('review_status')
      .notNull()
      .default('pending'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    rawProductIdx: index('matching_reviews_raw_product_idx').on(table.rawProductId),
    reviewStatusIdx: index('matching_reviews_review_status_idx').on(
      table.reviewStatus,
    ),
  }),
);
