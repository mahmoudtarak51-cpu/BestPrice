# Source Adapter Contract: Egypt Price Comparison MVP

## Purpose

This contract defines the internal adapter boundary every direct retailer
integration must implement. It exists to keep fetch, parse, normalize, and
validate responsibilities explicit and swappable.

## Interface

Each adapter MUST implement four stages:

1. `fetch(runContext) -> FetchResult`
2. `parse(fetchResult) -> ParsedListing[]`
3. `normalize(parsedListing) -> NormalizedListing`
4. `validate(normalizedListing) -> ValidationResult`

## Stage 1: Fetch

### Input

- `adapterKey`: unique adapter identifier
- `scheduledAt`: queue timestamp
- `runType`: `scheduled | manual | retry`
- `cursor`: optional pagination or continuation token

### Output: FetchResult

| Field | Type | Notes |
|-------|------|-------|
| runId | string | Unique per crawl run |
| fetchedAt | ISO timestamp | Fetch completion time |
| transport | enum | `html`, `json` |
| records | array | Raw source payload items |
| nextCursor | string nullable | Pagination continuation |

## Stage 2: Parse

### Output: ParsedListing

| Field | Type | Notes |
|-------|------|-------|
| externalId | string | Required unique listing key from source |
| sourceUrl | string | Required click-through URL |
| titleRaw | string | Required title |
| brandRaw | string nullable | Optional source brand |
| categoryRaw | string nullable | Optional source category |
| priceRaw | string nullable | Raw price string before normalization |
| shippingRaw | string nullable | Raw shipping text |
| availabilityRaw | string nullable | Raw stock text |
| attributesRaw | object | Unstructured specs |
| payload | object | Raw record snapshot |

## Stage 3: Normalize

### Output: NormalizedListing

| Field | Type | Notes |
|-------|------|-------|
| externalId | string | Required carry-over identifier |
| canonicalSourceUrl | string | Required normalized URL |
| title | string | Required cleaned title |
| brandName | string nullable | Normalized brand string |
| categorySlug | string | One of launch categories |
| modelNumber | string nullable | High-confidence match key |
| gtin | string nullable | Optional exact-match key |
| specs | object | Structured comparison attributes |
| priceEgp | number nullable | Current price in EGP |
| shippingEgp | number nullable | Shipping in EGP when known |
| availabilityStatus | enum | `in_stock`, `limited`, `out_of_stock`, `unknown` |
| fetchedAt | ISO timestamp | Required freshness anchor |

Normalization rules:

- Arabic and English punctuation and whitespace must be normalized consistently.
- Electronics listings outside launch categories must be rejected.
- Currency values must be converted or mapped into EGP before validation passes.

## Stage 4: Validate

### Output: ValidationResult

| Field | Type | Notes |
|-------|------|-------|
| accepted | boolean | Whether listing may continue |
| severity | enum | `info`, `warning`, `error` |
| rejectionCode | string nullable | Stable reason code |
| messages | array | Human-readable diagnostics |

Required validations:

- `externalId`, `canonicalSourceUrl`, `title`, `categorySlug`, and `fetchedAt`
  must be present.
- Negative prices or shipping values are invalid.
- Listings older than the job start time by more than 24 hours are rejected.
- Unsupported categories are rejected.

## Operational Rules

- Every adapter must complete at least one successful crawl every 6 hours to
  protect the 12-hour shopper freshness rule.
- Only one active crawl job per adapter may run at a time.
- Parse or normalize failures must emit structured reason codes for admin
  dashboards.
- Adapters may be paused without deleting historical raw-product records.

## Matching Handoff

Validated listings hand off these fields to the matching engine:

- `brandName`
- `modelNumber`
- `gtin`
- `specs`
- `title`
- `categorySlug`

The matching engine then classifies the listing as `exact`, `likely`, or
`similar` and either links it to a canonical product or places it into the
review queue.
