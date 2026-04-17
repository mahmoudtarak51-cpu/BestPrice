# Feature Specification: Egypt Price Comparison MVP

**Feature Branch**: `[001-price-comparison-mvp]`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "full project"

## Clarifications

### Session 2026-04-17

- Q: What minimum source mix should the MVP support at launch? -> A: 2 direct retailer sources only
- Q: Who should have access to the operations dashboard in MVP? -> A: internal admins only
- Q: Should watchlists and price alerts be included in MVP? -> A: defer both until after MVP
- Q: How should shopper-facing stale offers be handled? -> A: hide stale offers completely once stale
- Q: After how long should an offer become stale? -> A: 12 hours

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Best Offer (Priority: P1)

An Egyptian shopper searches for an electronics product in Arabic or English
and sees grouped results that help them quickly choose the best overall offer.

**Why this priority**: Search and offer comparison are the core reasons this
product exists and deliver the first meaningful user value.

**Independent Test**: A shopper can search for an in-scope product, review the
grouped results, apply filters, and choose a preferred offer without visiting a
separate system first.

**Acceptance Scenarios**:

1. **Given** a shopper enters an Arabic or English query for an in-scope
   electronics product, **When** matching offers exist, **Then** the system
   groups equivalent listings and highlights both the best overall offer and the
   cheapest offer when they differ.
2. **Given** grouped results are shown, **When** the shopper applies brand,
   category, store, or price-range filters, **Then** the results update to show
   only offers that meet the selected filters.

---

### User Story 2 - Compare Product Offers (Priority: P2)

A shopper opens a product details page to compare all available offers and
understand which listings are exact matches versus similar alternatives.

**Why this priority**: Users need confidence before clicking through to buy, and
that confidence depends on transparent matching and offer details.

**Independent Test**: A shopper can open one grouped product, view all related
offers, distinguish exact matches from similar products, and decide where to
buy.

**Acceptance Scenarios**:

1. **Given** a grouped product contains exact matches and similar alternatives,
   **When** the shopper opens the product page, **Then** the system separates
   exact matches from similar products and labels them clearly.
2. **Given** offers have different availability, shipping coverage, or freshness
   levels, **When** the shopper compares them, **Then** each offer displays its
   price, source, availability, shipping information when available, and last
   updated time without hiding missing values.

---

### User Story 3 - Monitor Data Health (Priority: P3)

An internal admin monitors source freshness, crawl issues, and unmatched
products so the platform remains trustworthy for shoppers.

**Why this priority**: Reliable comparison results depend on operational
visibility into stale data, failures, and matching gaps.

**Independent Test**: An internal admin can review the monitoring view and
identify stale sources, parsing failures, or unmatched listings that require
attention.

**Acceptance Scenarios**:

1. **Given** a source stops updating or starts failing, **When** an internal
   admin checks the monitoring view, **Then** the system highlights the stale or
   failed source and shows the impact on current data quality.
2. **Given** unmatched listings accumulate, **When** an internal admin reviews
   data quality, **Then** the system shows which products or sources require
   follow-up.

---

### Edge Cases

- A shopper searches for a product that has no in-scope electronics matches.
- Multiple listings share a brand and model family but differ in storage, RAM,
  or another critical specification.
- An offer is still the best price but its freshness timestamp is older than the
  12-hour freshness window and must be removed from shopper-visible results.
- Shipping cost, availability, or trust information is missing from one or more
  sources.
- Arabic and English queries point to the same product family while source
  titles remain mixed-language or partially normalized.
- A source listing becomes unavailable after it was last crawled but before the
  shopper clicks through.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow shoppers to search for in-scope electronics
  products using Arabic or English queries.
- **FR-002**: The system MUST group equivalent source listings into a single
  comparison result for a canonical product.
- **FR-003**: The system MUST identify and display the best overall offer for
  each grouped product using price, availability, freshness, trust, shipping,
  and match confidence signals.
- **FR-004**: The system MUST identify and display the cheapest offer when it is
  different from the best overall offer.
- **FR-005**: The system MUST show source or store name, price in EGP,
  availability status, last updated time, and a direct buy link for every
  displayed offer.
- **FR-006**: The system MUST display shipping information when a source
  provides it and clearly indicate when shipping information is unavailable.
- **FR-007**: The system MUST provide filters for brand, category, store, and
  price range on the shopper results experience.
- **FR-008**: The system MUST provide a product details view that shows all
  matched offers for a selected product.
- **FR-009**: The system MUST clearly separate exact matches from similar
  products on product details pages.
- **FR-010**: The system MUST support the initial product scope of phones,
  laptops, headphones, and TVs for Egypt-first launch.
- **FR-011**: The system MUST ingest and retain offers from at least 2 direct
  retailer sources at launch while preserving source attribution for every
  offer.
- **FR-012**: The system MUST label low-confidence offers so shoppers can
  understand when a recommendation is less certain.
- **FR-013**: The system MUST retain price history for tracked offers so price
  movement can be analyzed over time.
- **FR-014**: The system MUST provide operational visibility into crawl status,
  parsing failures, stale data, and unmatched products.
- **FR-015**: The system MUST allow internal admins to identify the affected
  source or product records behind a freshness, parsing, or matching issue.
- **FR-016**: Aggregator, affiliate-feed, and partner-source support MUST be
  treated as post-MVP expansion unless explicitly added in a later feature.
- **FR-017**: The system MUST restrict the operations dashboard and related data
  health workflows to internal admins only.
- **FR-018**: Watchlists and price alerts MUST remain out of scope for the MVP
  and be treated as post-MVP expansion features.
- **FR-019**: The system MUST remove stale offers from shopper-facing search
  results and product pages once they exceed the 12-hour freshness window,
  while still exposing stale-data conditions to internal admins.
- **FR-020**: The system MUST treat an offer as stale when more than 12 hours
  have passed since its last successful source update.

### Comparison Domain Requirements *(required when feature touches ingestion,
catalog, search, ranking, or product pages)*

- **CD-001**: This feature creates and maintains raw products, canonical
  products, offers, and price history records for in-scope electronics listings.
- **CD-002**: The platform MUST determine exact, likely, and similar matches
  before display, and it MUST never present likely or similar products as exact
  matches in user-facing views.
- **CD-003**: All shopper-visible offers MUST show source attribution,
  freshness, availability, shipping information when available, and clear
  handling of unknown or missing values.
- **CD-004**: User-facing search and comparison flows MUST support Arabic and
  English queries and continue to work when source titles are mixed-language.
- **CD-005**: Offers that exceed the 12-hour freshness window MUST remain
  available for internal operations review but MUST NOT appear in
  shopper-facing experiences.

### Key Entities *(include if feature involves data)*

- **Raw Product**: A product listing captured from one source, including source
  title, pricing, availability, shipping details, and crawl timestamp.
- **Canonical Product**: The normalized product record used to group equivalent
  listings across sources.
- **Offer**: A source-specific purchasable option for a canonical product,
  including price, source, freshness, availability, shipping, and buy link.
- **Store**: The retailer, marketplace, or partner source associated with one
  or more offers and trust signals.
- **Price History**: A time-ordered record of offer price changes used to track
  movement over time.
- **Crawl Issue**: A failure, stale-data alert, or unmatched-product condition
  that requires operations review.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of pilot shoppers can find a comparable in-scope
  product and identify a preferred offer within 2 minutes.
- **SC-002**: At least 95% of in-scope searches with known source coverage
  return at least one grouped comparison result.
- **SC-003**: At least 95% of displayed offers show source name, price,
  availability status, and last updated time, and shipping information is shown
  whenever it is provided by the source.
- **SC-004**: At least 90% of curated comparison QA cases correctly distinguish
  exact matches from similar products according to the published matching rules.
- **SC-005**: Operations users can detect stale sources, crawl failures, or
  unmatched-product spikes within 15 minutes of those issues appearing in the
  platform.
- **SC-006**: 100% of shopper-visible offers in acceptance testing have been
  refreshed within the last 12 hours.

## Assumptions

- The phrase "full project" is interpreted as the full MVP product described in
  `plan.md`, excluding the future watchlist and price-alert roadmap items.
- Shoppers can search and compare offers without creating an account.
- The first release is limited to Egypt and the categories phones, laptops,
  headphones, and TVs.
- The initial source footprint is limited to 2 direct retailer integrations;
  broader source types are deferred until after MVP validation.
- The operations dashboard is intended for internal admins only, not public
  users or general staff.
- Watchlists and price alerts are intentionally deferred until the comparison
  and operations flows are validated in MVP.
- Offers older than 12 hours are considered stale and removed from
  shopper-facing experiences until refreshed.
- Offer trust is based on internal business rules and source reputation rather
  than public shopper ratings in the first release.
- When a source does not provide shipping or availability details, the system
  may display those values as unknown rather than suppressing the offer.
- Price history collection starts in this feature so later trend and alert
  features can build on it, even if alerts themselves are not in the first
  shopper release.
