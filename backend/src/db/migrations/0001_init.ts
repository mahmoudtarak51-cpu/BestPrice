import postgres from 'postgres';

import { loadConfig } from '../../support/config.js';
import { isMainModule } from '../../support/runtime.js';
import {
  ensureSearchResultView,
  SEARCH_RESULT_VIEW_NAME,
} from '../views/search-result-view.js';
import {
  ensureSourceHealthView,
  SOURCE_HEALTH_VIEW_NAME,
} from '../views/source-health-view.js';

const migrationStatements = [
  `create extension if not exists pgcrypto;`,
  `create extension if not exists pg_trgm;`,
  `do $$ begin create type source_adapter_type as enum ('html_scrape', 'json_api'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type source_adapter_status as enum ('active', 'paused', 'disabled'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type admin_role as enum ('admin'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type admin_status as enum ('invited', 'active', 'disabled'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type crawl_job_type as enum ('scheduled', 'manual', 'retry'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type crawl_job_status as enum ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type crawl_failure_stage as enum ('fetch', 'parse', 'normalize', 'validate', 'match', 'index'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type failure_severity as enum ('warning', 'error', 'critical'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type raw_product_ingest_status as enum ('fetched', 'parsed', 'normalized', 'matched', 'rejected'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type catalog_status as enum ('active', 'review_needed', 'hidden'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type offer_match_level as enum ('exact', 'likely', 'similar'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type offer_availability_status as enum ('in_stock', 'limited', 'out_of_stock', 'unknown'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type language_code as enum ('ar', 'en', 'mixed', 'unknown'); exception when duplicate_object then null; end $$;`,
  `do $$ begin create type matching_review_status as enum ('pending', 'accepted', 'rejected'); exception when duplicate_object then null; end $$;`,
  `
    create table if not exists stores (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      display_name text not null,
      country_code text not null default 'EG',
      base_url text not null,
      trust_score numeric(5, 2) not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint stores_trust_score_range check (trust_score >= 0 and trust_score <= 100)
    );
  `,
  `
    create table if not exists source_adapters (
      id uuid primary key default gen_random_uuid(),
      store_id uuid not null references stores(id) on delete restrict,
      key text not null unique,
      adapter_type source_adapter_type not null,
      status source_adapter_status not null default 'active',
      freshness_sla_hours integer not null default 12,
      crawl_interval_minutes integer not null default 360,
      config_json jsonb not null default '{}'::jsonb,
      last_successful_crawl_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint source_adapters_crawl_interval_limit check (crawl_interval_minutes <= 360)
    );
  `,
  `
    create table if not exists admin_users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      password_hash text not null,
      full_name text not null,
      role admin_role not null default 'admin',
      status admin_status not null default 'invited',
      last_login_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists crawl_jobs (
      id uuid primary key default gen_random_uuid(),
      source_adapter_id uuid not null references source_adapters(id) on delete cascade,
      triggered_by_admin_id uuid references admin_users(id) on delete set null,
      job_type crawl_job_type not null,
      status crawl_job_status not null default 'queued',
      scheduled_for timestamptz not null default now(),
      started_at timestamptz,
      finished_at timestamptz,
      fetched_count integer not null default 0,
      normalized_count integer not null default 0,
      failed_count integer not null default 0,
      notes text,
      created_at timestamptz not null default now()
    );
  `,
  `
    create unique index if not exists crawl_jobs_active_per_adapter_idx
      on crawl_jobs(source_adapter_id)
      where status in ('queued', 'running');
  `,
  `
    create table if not exists crawl_failures (
      id uuid primary key default gen_random_uuid(),
      crawl_job_id uuid not null references crawl_jobs(id) on delete cascade,
      source_adapter_id uuid not null references source_adapters(id) on delete cascade,
      failure_stage crawl_failure_stage not null,
      severity failure_severity not null,
      external_reference text,
      message text not null,
      retriable boolean not null default false,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists categories (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      name_en text not null,
      name_ar text not null,
      parent_category_id uuid,
      is_active boolean not null default true
    );
  `,
  `
    create table if not exists brands (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      canonical_name text not null unique,
      aliases_json jsonb not null default '{}'::jsonb,
      is_active boolean not null default true
    );
  `,
  `
    create table if not exists raw_products (
      id uuid primary key default gen_random_uuid(),
      source_adapter_id uuid not null references source_adapters(id) on delete cascade,
      external_id text not null,
      source_url text not null,
      title_raw text not null,
      description_raw text,
      brand_raw text,
      category_raw text,
      price_amount_egp numeric(12, 2),
      shipping_amount_egp numeric(12, 2),
      availability_raw text,
      payload_json jsonb not null default '{}'::jsonb,
      content_hash text not null,
      fetched_at timestamptz not null,
      ingest_status raw_product_ingest_status not null default 'fetched',
      constraint raw_products_source_external_fetched_unique unique (source_adapter_id, external_id, fetched_at),
      constraint raw_products_price_non_negative check (price_amount_egp is null or price_amount_egp >= 0),
      constraint raw_products_shipping_non_negative check (shipping_amount_egp is null or shipping_amount_egp >= 0)
    );
  `,
  `
    create table if not exists canonical_products (
      id uuid primary key default gen_random_uuid(),
      category_id uuid not null references categories(id) on delete restrict,
      brand_id uuid not null references brands(id) on delete restrict,
      canonical_name_en text not null,
      canonical_name_ar text,
      model_number text,
      gtin text,
      specs_json jsonb not null default '{}'::jsonb,
      image_url text,
      search_document text not null default '',
      catalog_status catalog_status not null default 'review_needed',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists offers (
      id uuid primary key default gen_random_uuid(),
      canonical_product_id uuid not null references canonical_products(id) on delete cascade,
      raw_product_id uuid not null unique references raw_products(id) on delete cascade,
      store_id uuid not null references stores(id) on delete restrict,
      match_level offer_match_level not null,
      match_confidence numeric(5, 2) not null default 0,
      price_amount_egp numeric(12, 2) not null,
      shipping_amount_egp numeric(12, 2),
      landed_price_egp numeric(12, 2),
      availability_status offer_availability_status not null default 'unknown',
      last_successful_update_at timestamptz not null,
      stale_after_at timestamptz not null,
      shopper_visible boolean not null default true,
      trust_score_snapshot numeric(5, 2) not null default 0,
      ranking_score numeric(8, 4),
      reason_codes_json jsonb not null default '[]'::jsonb,
      buy_url text not null,
      constraint offers_match_confidence_range check (match_confidence >= 0 and match_confidence <= 1)
    );
  `,
  `
    create table if not exists price_history (
      id uuid primary key default gen_random_uuid(),
      offer_id uuid not null references offers(id) on delete cascade,
      observed_at timestamptz not null,
      price_amount_egp numeric(12, 2) not null,
      shipping_amount_egp numeric(12, 2),
      availability_status offer_availability_status not null default 'unknown',
      constraint price_history_offer_observed_unique unique (offer_id, observed_at)
    );
  `,
  `
    create table if not exists search_logs (
      id uuid primary key default gen_random_uuid(),
      query_text text not null,
      normalized_query text not null,
      detected_language language_code not null default 'unknown',
      filters_json jsonb not null default '{}'::jsonb,
      result_count integer not null default 0,
      clicked_canonical_product_id uuid references canonical_products(id) on delete set null,
      latency_ms integer not null default 0,
      created_at timestamptz not null default now()
    );
  `,
  `
    create table if not exists matching_reviews (
      id uuid primary key default gen_random_uuid(),
      raw_product_id uuid not null references raw_products(id) on delete cascade,
      canonical_product_id uuid references canonical_products(id) on delete set null,
      reviewer_admin_id uuid references admin_users(id) on delete set null,
      review_status matching_review_status not null default 'pending',
      reason text,
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    );
  `,
  `create index if not exists source_adapters_store_idx on source_adapters(store_id);`,
  `create index if not exists crawl_jobs_source_adapter_idx on crawl_jobs(source_adapter_id);`,
  `create index if not exists crawl_failures_crawl_job_idx on crawl_failures(crawl_job_id);`,
  `create index if not exists crawl_failures_source_adapter_idx on crawl_failures(source_adapter_id);`,
  `create index if not exists raw_products_source_adapter_idx on raw_products(source_adapter_id);`,
  `create index if not exists canonical_products_category_idx on canonical_products(category_id);`,
  `create index if not exists canonical_products_brand_idx on canonical_products(brand_id);`,
  `create index if not exists canonical_products_model_idx on canonical_products(model_number);`,
  `create index if not exists canonical_products_gtin_idx on canonical_products(gtin);`,
  `create index if not exists offers_canonical_product_idx on offers(canonical_product_id);`,
  `create index if not exists offers_store_idx on offers(store_id);`,
  `create index if not exists search_logs_created_at_idx on search_logs(created_at);`,
  `create index if not exists matching_reviews_raw_product_idx on matching_reviews(raw_product_id);`,
  `create index if not exists matching_reviews_review_status_idx on matching_reviews(review_status);`,
  `drop view if exists ${SEARCH_RESULT_VIEW_NAME};`,
  `drop view if exists ${SOURCE_HEALTH_VIEW_NAME};`,
] as const;

export async function runMigration0001(databaseUrl = loadConfig().databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      for (const statement of migrationStatements) {
        await transaction.unsafe(statement);
      }

      await ensureSearchResultView(transaction);
      await ensureSourceHealthView(transaction);
    });
  } finally {
    await sql.end();
  }
}

if (isMainModule(import.meta.url)) {
  void runMigration0001()
    .then(() => {
      console.log('Migration 0001 completed successfully.');
    })
    .catch((error: unknown) => {
      console.error('Migration 0001 failed.', error);
      process.exitCode = 1;
    });
}
