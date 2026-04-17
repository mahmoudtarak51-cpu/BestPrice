# Research: Egypt Price Comparison MVP

## Decision 1: Use a TypeScript full-stack web architecture

**Decision**: Use TypeScript 5.6 across both applications, with Next.js 15 for
the shopper/admin frontend and Fastify 5 for the API plus worker runtime.

**Rationale**: One language across frontend and backend reduces coordination
cost, speeds iteration in an empty repo, and keeps validation logic portable.
Fastify keeps the API lean, while Next.js supports server-rendered search pages
for discoverability and fast shopper interactions.

**Alternatives considered**:

- Python/FastAPI backend with Next.js frontend: good backend ergonomics, but
  slower shared-type workflows and more duplication in validation logic.
- Next.js-only monolith: simpler deployment, but muddier boundaries around
  ingestion jobs, admin operations, and adapter lifecycle management.

## Decision 2: Keep PostgreSQL as both source of truth and MVP search engine

**Decision**: Use PostgreSQL 16 as the system of record and the initial search
engine, with normalized search documents and `pg_trgm`-backed fuzzy matching
for bilingual queries.

**Rationale**: Two retailer sources and MVP catalog size do not justify a
second search datastore. PostgreSQL keeps operational complexity low while still
supporting weighted text search, faceting, and denormalized searchable views.
Arabic support is handled through normalization rules and alias fields rather
than a heavier dedicated search platform.

**Alternatives considered**:

- OpenSearch: better large-scale search flexibility, but introduces extra ops
  burden too early.
- Meilisearch: simpler than OpenSearch, but still duplicates indexing concerns
  for a small initial dataset.

## Decision 3: Use Redis and BullMQ for scheduled crawl pipelines

**Decision**: Use Redis 7 and BullMQ for crawl, normalize, match, and reindex
jobs, with each adapter scheduled at least every 6 hours to protect the
12-hour shopper freshness SLA.

**Rationale**: The product already needs asynchronous ingestion, retry control,
and operational visibility. BullMQ provides a small surface area with enough
job-state semantics for crawl observability and admin-triggered reruns.

**Alternatives considered**:

- Database-backed cron tables only: simpler on paper, but weaker retry,
  concurrency, and monitoring support.
- External workflow engines: more powerful, but unnecessary for the MVP scale.

## Decision 4: Use deterministic heuristic matching, not ML

**Decision**: Implement a deterministic matching pipeline with exact, likely,
and similar outcomes based on model numbers, GTIN/EAN, structured attributes,
and title similarity thresholds.

**Rationale**: The constitution explicitly favors correctness and confidence
signaling over breadth. Heuristic rules are easier to debug, review, and
override, and they fit the electronics-first product scope where model data is
usually recoverable.

**Alternatives considered**:

- Embedding or ML-based matching: potentially powerful later, but hard to audit
  and unnecessary for the first two retailer integrations.
- Manual review only: accurate for edge cases, but too slow for initial catalog
  growth and freshness needs.

## Decision 5: Restrict admin access with internal session-based accounts

**Decision**: Use internal admin accounts with role `admin` and secure session
cookies for the operations dashboard. No shopper authentication is included in
the MVP.

**Rationale**: The spec fixes operations access to internal admins only, so the
first release needs an explicit but narrow auth boundary. Session-based admin
access is easier to ship quickly than third-party SSO while still being more
controlled than network-only protection.

**Alternatives considered**:

- Workspace SSO only: stronger for larger teams, but adds identity-provider
  setup overhead too early.
- Public read-only monitoring: violates the clarified admin-only boundary.

## Decision 6: Define the frontend/backend interface with OpenAPI-first REST

**Decision**: Use REST endpoints documented in OpenAPI, with the frontend
calling the backend through typed HTTP requests and contract-tested schemas.

**Rationale**: The MVP has well-bounded read-heavy comparison flows and a small
set of admin write actions. OpenAPI gives a stable contract for frontend,
testing, and future integrations without the overhead of GraphQL schema design.

**Alternatives considered**:

- GraphQL: flexible, but unnecessary for the first release and harder to keep
  simple under evolving ranking semantics.
- Undocumented internal JSON endpoints: faster initially, but increases drift
  risk between frontend, backend, and test suites.

## Decision 7: Hide stale offers from shoppers after 12 hours

**Decision**: Treat any offer as stale more than 12 hours after its last
successful source update, hide it from shopper-facing experiences, and surface
the stale condition only in admin operations tooling.

**Rationale**: The clarification session explicitly locked this behavior. Hiding
stale offers protects user trust more effectively than warning-only behavior and
keeps ranking badges aligned with current data.

**Alternatives considered**:

- Show stale offers with warning: more transparent, but conflicts with the
  clarified shopper behavior.
- Source-specific freshness windows: useful later, but too complex for the
  first two source integrations.

## Decision 8: Log ranking and matching evidence explicitly

**Decision**: Persist ranking scores, match confidence, freshness timestamps,
and reason codes needed to explain why an offer was recommended or suppressed.

**Rationale**: Ranking transparency and operability are core constitutional
requirements. Capturing evidence alongside the offer record supports QA,
admin review, and regression debugging without re-running complex calculations.

**Alternatives considered**:

- Recompute explanations only in memory: cheaper on storage, but weak for audit
  trails and debugging.
- Free-form log messages only: too noisy and too hard to query operationally.
