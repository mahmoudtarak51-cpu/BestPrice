# Data Model: Egypt Price Comparison MVP

## Core Relationships

- `Store` 1:N `SourceAdapter`
- `SourceAdapter` 1:N `CrawlJob`
- `SourceAdapter` 1:N `RawProduct`
- `Category` 1:N `CanonicalProduct`
- `Brand` 1:N `CanonicalProduct`
- `RawProduct` 0..1:1 `Offer`
- `CanonicalProduct` 1:N `Offer`
- `Offer` 1:N `PriceHistory`
- `CanonicalProduct` 1:N `MatchingReview`
- `AdminUser` 1:N `CrawlJob` (manual triggers)
- `AdminUser` 1:N `MatchingReview`

## Entity: Store

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| slug | text | Unique canonical store identifier |
| display_name | text | Shopper-visible store name |
| country_code | text | Fixed to `EG` for MVP |
| base_url | text | Source homepage |
| trust_score | numeric(5,2) | Weighted ranking input from 0-100 |
| is_active | boolean | Deactivates store across adapters |
| created_at | timestamptz | Audit field |
| updated_at | timestamptz | Audit field |

Validation rules:

- `slug` must be unique and URL-safe.
- `trust_score` must be between 0 and 100.

## Entity: SourceAdapter

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| store_id | UUID | FK to `Store` |
| key | text | Unique adapter key, e.g. `retailer-a-html` |
| adapter_type | enum | `html_scrape`, `json_api` |
| status | enum | `active`, `paused`, `disabled` |
| freshness_sla_hours | integer | Defaults to `12` |
| crawl_interval_minutes | integer | Defaults to `360` |
| config_json | jsonb | Source-specific selectors and settings |
| last_successful_crawl_at | timestamptz | Operational freshness anchor |
| created_at | timestamptz | Audit field |
| updated_at | timestamptz | Audit field |

Validation rules:

- `key` must be unique.
- `crawl_interval_minutes` must be less than or equal to 360 for MVP sources.

## Entity: AdminUser

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | text | Unique login identifier |
| password_hash | text | Session auth credential |
| full_name | text | Internal display name |
| role | enum | `admin` only in MVP |
| status | enum | `invited`, `active`, `disabled` |
| last_login_at | timestamptz | Security audit |
| created_at | timestamptz | Audit field |
| updated_at | timestamptz | Audit field |

Validation rules:

- Email must be unique and normalized to lowercase.
- Only `admin` role is valid in MVP.

State transitions:

- `invited -> active`
- `active -> disabled`

## Entity: CrawlJob

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| source_adapter_id | UUID | FK to `SourceAdapter` |
| triggered_by_admin_id | UUID nullable | FK to `AdminUser` for manual runs |
| job_type | enum | `scheduled`, `manual`, `retry` |
| status | enum | `queued`, `running`, `succeeded`, `partial`, `failed`, `cancelled` |
| scheduled_for | timestamptz | Queue time |
| started_at | timestamptz nullable | Runtime start |
| finished_at | timestamptz nullable | Runtime end |
| fetched_count | integer | Number of source items fetched |
| normalized_count | integer | Number of usable listings |
| failed_count | integer | Number of rejected listings |
| notes | text nullable | Operator-visible summary |
| created_at | timestamptz | Audit field |

Validation rules:

- Exactly one active `queued` or `running` job per adapter for MVP.
- `finished_at` is required for terminal statuses.

State transitions:

- `queued -> running`
- `running -> succeeded | partial | failed | cancelled`

## Entity: CrawlFailure

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| crawl_job_id | UUID | FK to `CrawlJob` |
| source_adapter_id | UUID | FK to `SourceAdapter` |
| failure_stage | enum | `fetch`, `parse`, `normalize`, `validate`, `match`, `index` |
| severity | enum | `warning`, `error`, `critical` |
| external_reference | text nullable | Source URL or external ID |
| message | text | Operator-facing error message |
| retriable | boolean | Retry guidance |
| first_seen_at | timestamptz | Audit field |
| last_seen_at | timestamptz | Audit field |

## Entity: Category

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| slug | text | Unique category key |
| name_en | text | Shopper label |
| name_ar | text | Shopper label |
| parent_category_id | UUID nullable | Self-reference |
| is_active | boolean | MVP categories remain active |

Validation rules:

- Supported launch slugs: `phones`, `laptops`, `headphones`, `tvs`.

## Entity: Brand

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| slug | text | Unique brand key |
| canonical_name | text | Primary brand name |
| aliases_json | jsonb | Arabic/English aliases and transliterations |
| is_active | boolean | Soft-disable support |

Validation rules:

- `canonical_name` must be unique after normalization.

## Entity: RawProduct

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| source_adapter_id | UUID | FK to `SourceAdapter` |
| external_id | text | Unique per source listing identifier |
| source_url | text | Product URL |
| title_raw | text | Unmodified source title |
| description_raw | text nullable | Optional source body |
| brand_raw | text nullable | Source-provided brand string |
| category_raw | text nullable | Source-provided category string |
| price_amount_egp | numeric(12,2) nullable | Parsed current price |
| shipping_amount_egp | numeric(12,2) nullable | Parsed shipping |
| availability_raw | text nullable | Unmapped source availability |
| payload_json | jsonb | Full source snapshot |
| content_hash | text | Change detection key |
| fetched_at | timestamptz | Time captured from source |
| ingest_status | enum | `fetched`, `parsed`, `normalized`, `matched`, `rejected` |

Validation rules:

- Unique constraint on `(source_adapter_id, external_id, fetched_at)`.
- `price_amount_egp` cannot be negative when present.

State transitions:

- `fetched -> parsed -> normalized -> matched`
- `fetched | parsed | normalized -> rejected`

## Entity: CanonicalProduct

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| category_id | UUID | FK to `Category` |
| brand_id | UUID | FK to `Brand` |
| canonical_name_en | text | Primary shopper title |
| canonical_name_ar | text nullable | Localized shopper title |
| model_number | text nullable | Key exact-match signal |
| gtin | text nullable | Secondary exact-match signal |
| specs_json | jsonb | Structured attributes like RAM, storage, panel size |
| image_url | text nullable | Preferred display image |
| search_document | tsvector or denormalized text | Queryable search field |
| catalog_status | enum | `active`, `review_needed`, `hidden` |
| created_at | timestamptz | Audit field |
| updated_at | timestamptz | Audit field |

Validation rules:

- `canonical_name_en` is required.
- At least one of `model_number`, `gtin`, or distinguishing `specs_json`
  attributes must exist before `catalog_status` can be `active`.

## Entity: Offer

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| canonical_product_id | UUID | FK to `CanonicalProduct` |
| raw_product_id | UUID | FK to `RawProduct` |
| store_id | UUID | FK to `Store` |
| match_level | enum | `exact`, `likely`, `similar` |
| match_confidence | numeric(5,2) | 0.00-1.00 |
| price_amount_egp | numeric(12,2) | Required shopper price |
| shipping_amount_egp | numeric(12,2) nullable | Optional shipping |
| landed_price_egp | numeric(12,2) nullable | Price + shipping when known |
| availability_status | enum | `in_stock`, `limited`, `out_of_stock`, `unknown` |
| last_successful_update_at | timestamptz | Freshness anchor |
| stale_after_at | timestamptz | Derived 12-hour cutoff |
| shopper_visible | boolean | False once stale or retired |
| trust_score_snapshot | numeric(5,2) | Store trust captured at rank time |
| ranking_score | numeric(8,4) | Best-overall comparison score |
| reason_codes_json | jsonb | Why this offer ranked where it did |
| buy_url | text | Shopper click-through |

Validation rules:

- `match_confidence` must be between 0 and 1.
- `stale_after_at` must equal `last_successful_update_at + 12 hours`.
- `shopper_visible` must be false when `stale_after_at < now()`.

State transitions:

- `candidate -> active`
- `active -> stale_hidden`
- `active | stale_hidden -> unavailable | retired`

## Entity: PriceHistory

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| offer_id | UUID | FK to `Offer` |
| observed_at | timestamptz | Snapshot time |
| price_amount_egp | numeric(12,2) | Stored price |
| shipping_amount_egp | numeric(12,2) nullable | Stored shipping |
| availability_status | enum | Availability snapshot |

Validation rules:

- Unique constraint on `(offer_id, observed_at)`.

## Entity: SearchLog

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| query_text | text | Raw shopper query |
| normalized_query | text | Search-normalized query |
| detected_language | enum | `ar`, `en`, `mixed`, `unknown` |
| filters_json | jsonb | Applied search filters |
| result_count | integer | Search response size |
| clicked_canonical_product_id | UUID nullable | Follow-up signal |
| latency_ms | integer | Measured response latency |
| created_at | timestamptz | Audit field |

## Entity: MatchingReview

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| raw_product_id | UUID | FK to `RawProduct` |
| canonical_product_id | UUID nullable | Proposed target |
| reviewer_admin_id | UUID nullable | FK to `AdminUser` |
| review_status | enum | `pending`, `accepted`, `rejected` |
| reason | text nullable | Operator note |
| created_at | timestamptz | Audit field |
| resolved_at | timestamptz nullable | Completion timestamp |

State transitions:

- `pending -> accepted`
- `pending -> rejected`

## Derived Views and Aggregations

- `search_result_view`: joins active `CanonicalProduct` rows with shopper-visible
  `Offer` summaries for low-latency result rendering.
- `source_health_view`: aggregates adapter freshness, last crawl status, stale
  offer counts, and unmatched-product counts for admin monitoring.
- `ranking_explanation_view`: exposes reason codes and score components for QA
  and admin investigations.
