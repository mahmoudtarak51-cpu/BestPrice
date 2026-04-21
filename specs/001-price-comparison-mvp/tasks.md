---

description: "Task list for implementing the Egypt Price Comparison MVP"
---

# Tasks: Egypt Price Comparison MVP

**Input**: Design documents from `/specs/001-price-comparison-mvp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required for this feature because it changes source adapters, ingestion, search, matching, ranking, shopper APIs, and admin operations.

**Organization**: Tasks are grouped by user story to keep each increment independently testable.
**Constitution Alignment**: Tasks include localization, provenance, freshness handling, observability, and data-quality work where those concerns apply.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths

## Path Conventions

- **Web app**: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`
- **Docs**: `specs/001-price-comparison-mvp/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the workspace, package management, and baseline developer tooling.

- [X] T001 Create the pnpm workspace bootstrap in `package.json`, `pnpm-workspace.yaml`, and `docker-compose.yml`
- [X] T002 Initialize backend workspace configuration in `backend/package.json`, `backend/tsconfig.json`, and `backend/vitest.config.ts`
- [X] T003 [P] Initialize frontend workspace configuration in `frontend/package.json`, `frontend/tsconfig.json`, and `frontend/playwright.config.ts`
- [X] T004 [P] Add local environment templates in `backend/.env.example` and `frontend/.env.example`
- [X] T005 [P] Configure linting, formatting, and CI entrypoints in `eslint.config.mjs`, `prettier.config.mjs`, and `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared platform pieces that all user stories depend on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T006 Create the core database schema and first migration in `backend/src/db/schema.ts` and `backend/src/db/migrations/0001_init.ts`
- [X] T007 [P] Add seed scripts for launch categories, brand aliases, and internal admins in `backend/src/db/seeds/catalog.ts` and `backend/src/db/seeds/admins.ts`
- [X] T008 [P] Implement BullMQ queue bootstrap and worker registration in `backend/src/jobs/queue.ts` and `backend/src/jobs/worker.ts`
- [X] T009 [P] Implement Fastify server bootstrap and OpenAPI plugin wiring in `backend/src/api/server.ts` and `backend/src/api/plugins/openapi.ts`
- [X] T010 [P] Implement admin session and authorization foundations in `backend/src/auth/session.ts` and `backend/src/auth/admin-auth.ts`
- [X] T011 [P] Implement bilingual normalization foundations in `backend/src/search/query-normalizer.ts` and `frontend/src/i18n/config.ts`
- [X] T012 [P] Implement structured logging, metrics, and health checks in `backend/src/support/logger.ts`, `backend/src/support/metrics.ts`, and `backend/src/api/routes/health.ts`
- [X] T013 [P] Implement the shared source-adapter interface and registry in `backend/src/adapters/base/source-adapter.ts`, `backend/src/adapters/base/validation.ts`, and `backend/src/adapters/source-registry.ts`
- [X] T014 Create shopper search and admin health database views in `backend/src/db/views/search-result-view.ts` and `backend/src/db/views/source-health-view.ts`

**Checkpoint**: Foundation is ready; user story work can now proceed in priority order.

---

## Phase 3: User Story 1 - Search Best Offer (Priority: P1) MVP

**Goal**: Deliver bilingual shopper search with grouped products, filters, provenance, and best-overall versus cheapest offers.

**Independent Test**: A shopper can search in Arabic or English, see grouped in-scope results from the two direct retailers, apply filters, and identify a preferred offer without leaving the product-discovery flow.

### Tests for User Story 1

> **NOTE: Write these tests first and confirm they fail before implementation.**

- [X] T015 [P] [US1] Add OpenAPI contract coverage for `GET /search` in `backend/tests/contract/search.contract.test.ts`
- [X] T016 [P] [US1] Add backend integration coverage for crawl-to-search flow in `backend/tests/integration/search-flow.test.ts`
- [X] T017 [P] [US1] Add shopper e2e coverage for Arabic and English search with filters in `frontend/tests/e2e/search-results.spec.ts`
- [X] T018 [P] [US1] Add unit coverage for freshness cutoff and ranking inputs in `backend/tests/unit/freshness-policy.test.ts` and `backend/tests/unit/ranking-service.test.ts`

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement retailer A adapter fetch and parse stages in `backend/src/adapters/retailer-a/adapter.ts` and `backend/src/adapters/retailer-a/parser.ts`
- [X] T020 [P] [US1] Implement retailer B adapter fetch and parse stages in `backend/src/adapters/retailer-b/adapter.ts` and `backend/src/adapters/retailer-b/parser.ts`
- [X] T021 [US1] Implement normalization and category-brand mapping in `backend/src/adapters/normalize/normalized-listing.ts` and `backend/src/adapters/normalize/normalization-service.ts`
- [X] T022 [US1] Implement deterministic exact-likely-similar matching in `backend/src/matching/matching-service.ts` and `backend/src/matching/rules.ts`
- [X] T023 [US1] Implement offer ranking, reason codes, and 12-hour freshness hiding in `backend/src/ranking/ranking-service.ts` and `backend/src/ranking/freshness-policy.ts`
- [X] T024 [US1] Implement crawl orchestration and search refresh jobs in `backend/src/jobs/crawl-job.ts` and `backend/src/jobs/search-index-job.ts`
- [X] T025 [US1] Implement shopper search service and provenance-aware query logging in `backend/src/search/search-service.ts` and `backend/src/support/search-log-service.ts`
- [X] T026 [US1] Implement the `GET /search` route and schema handling in `backend/src/api/routes/search.ts` and `backend/src/api/schemas/search.ts`
- [X] T027 [P] [US1] Implement the shopper search API client in `frontend/src/lib/api/search-client.ts` and `frontend/src/lib/types/search.ts`
- [X] T028 [US1] Implement the bilingual search page in `frontend/src/app/[lang]/search/page.tsx` and `frontend/src/features/search/search-page.tsx`
- [X] T029 [P] [US1] Implement grouped result cards and badge presentation in `frontend/src/features/search/search-results.tsx` and `frontend/src/features/search/result-card.tsx`
- [X] T030 [P] [US1] Implement filter controls and URL-state handling in `frontend/src/features/search/search-filters.tsx` and `frontend/src/features/search/use-search-filters.ts`
- [X] T031 [US1] Add search observability and ranking audit persistence in `backend/src/support/ranking-audit.ts` and `backend/src/support/source-health-metrics.ts`

**Checkpoint**: User Story 1 is fully functional when shoppers can search bilingual queries, see grouped offers from both retailers, and rely on badges that exclude stale offers.

---

## Phase 4: User Story 2 - Compare Product Offers (Priority: P2)

**Goal**: Deliver product details pages that separate exact matches from similar products and expose full offer comparison data.

**Independent Test**: A shopper can open a product details page, compare all shopper-visible offers, and clearly distinguish exact matches from similar alternatives.

### Tests for User Story 2

- [X] T032 [P] [US2] Add OpenAPI contract coverage for `GET /products/{productId}` and `GET /products/{productId}/offers` in `backend/tests/contract/product-detail.contract.test.ts`
- [X] T033 [P] [US2] Add backend integration coverage for exact-versus-similar grouping in `backend/tests/integration/product-detail-flow.test.ts`
- [X] T034 [P] [US2] Add shopper e2e coverage for product comparison in `frontend/tests/e2e/product-detail.spec.ts`

### Implementation for User Story 2

- [X] T035 [P] [US2] Implement canonical product and offer repositories for product detail projections in `backend/src/db/repositories/canonical-product-repository.ts` and `backend/src/db/repositories/offer-repository.ts`
- [X] T036 [US2] Implement product detail aggregation and similar-product separation in `backend/src/matching/product-detail-service.ts` and `backend/src/matching/presentation.ts`
- [X] T037 [US2] Implement ranking explanation and missing-shipping handling for product details in `backend/src/ranking/product-explanation-service.ts` and `backend/src/ranking/offer-display.ts`
- [X] T038 [US2] Implement product detail and offers routes in `backend/src/api/routes/products.ts` and `backend/src/api/schemas/product-detail.ts`
- [X] T039 [P] [US2] Implement the product detail API client in `frontend/src/lib/api/product-client.ts` and `frontend/src/lib/types/product.ts`
- [X] T040 [US2] Implement the product detail page in `frontend/src/app/[lang]/products/[productId]/page.tsx` and `frontend/src/features/product/product-page.tsx`
- [X] T041 [P] [US2] Implement exact-offer comparison components in `frontend/src/features/product/product-offers.tsx` and `frontend/src/features/product/offer-card.tsx`
- [X] T042 [P] [US2] Implement similar-product sections and match-confidence labels in `frontend/src/features/product/similar-products.tsx` and `frontend/src/features/product/match-confidence-badge.tsx`
- [X] T043 [US2] Add shopper-facing offer metadata presentation for shipping, freshness, and provenance in `frontend/src/features/product/offer-meta.tsx` and `frontend/src/features/product/product-summary.tsx`

**Checkpoint**: User Story 2 is fully functional when shoppers can inspect a grouped product and understand both exact offers and similar alternatives without ambiguity.

---

## Phase 5: User Story 3 - Monitor Data Health (Priority: P3)

**Goal**: Deliver the internal admin operations dashboard for source freshness, crawl failures, unmatched products, and manual crawl reruns.

**Independent Test**: An internal admin can sign in, review source health, inspect unmatched-product queues, and trigger a manual crawl rerun for one or more adapters.

### Tests for User Story 3

- [X] T044 [P] [US3] Add OpenAPI contract coverage for admin overview, sources, crawl jobs, and unmatched products in `backend/tests/contract/admin-operations.contract.test.ts`
- [X] T045 [P] [US3] Add backend integration coverage for stale-source and failure visibility in `backend/tests/integration/admin-operations-flow.test.ts`
- [X] T046 [P] [US3] Add admin e2e coverage for sign-in and monitoring workflows in `frontend/tests/e2e/admin-operations.spec.ts`

### Implementation for User Story 3

- [X] T047 [P] [US3] Implement admin user repository and auth routes in `backend/src/auth/admin-user-repository.ts` and `backend/src/api/routes/admin-auth.ts`
- [X] T048 [US3] Implement source health and unmatched-product services in `backend/src/api/services/source-health-service.ts` and `backend/src/api/services/unmatched-product-service.ts`
- [X] T049 [US3] Implement admin overview and source health routes in `backend/src/api/routes/admin-overview.ts` and `backend/src/api/routes/admin-sources.ts`
- [X] T050 [US3] Implement manual crawl rerun route and queue handoff in `backend/src/api/routes/admin-crawl-jobs.ts` and `backend/src/jobs/manual-crawl.ts`
- [X] T051 [US3] Implement the unmatched-products admin route in `backend/src/api/routes/admin-unmatched-products.ts` and `backend/src/api/schemas/admin-unmatched-products.ts`
- [X] T052 [P] [US3] Implement the admin dashboard layout and auth guard in `frontend/src/app/admin/layout.tsx` and `frontend/src/app/admin/page.tsx`
- [X] T053 [P] [US3] Implement source health and crawl summary widgets in `frontend/src/features/admin/source-health-panel.tsx` and `frontend/src/features/admin/crawl-summary-cards.tsx`
- [X] T054 [P] [US3] Implement unmatched-product queue and rerun controls in `frontend/src/features/admin/unmatched-queue.tsx` and `frontend/src/features/admin/manual-crawl-form.tsx`
- [X] T055 [US3] Add stale-data alerts and crawl-failure metric emission in `backend/src/support/alerts.ts` and `backend/src/support/source-health-metrics.ts`

**Checkpoint**: User Story 3 is fully functional when internal admins can observe source health, diagnose failures, and manually recover stalled pipelines.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening work that spans multiple user stories.

- [X] T056 [P] Document the delivered workspace and run commands in `README.md` and `specs/001-price-comparison-mvp/quickstart.md`
- [X] T057 Refine shared API types and remove duplication in `backend/src/lib/api-types.ts` and `frontend/src/lib/types/api.ts`
- [X] T058 [P] Add regression coverage for bilingual normalization and matching thresholds in `backend/tests/unit/query-normalizer.test.ts` and `backend/tests/unit/matching-service.test.ts`
- [X] T059 [P] Tune ranking audit dashboards and source-health metrics in `backend/src/support/ranking-audit.ts` and `backend/src/support/source-health-metrics.ts`
- [X] T060 Harden admin session security and secret validation in `backend/src/auth/session.ts` and `backend/src/support/config.ts`
- [X] T061 Run the quickstart smoke flow and record any fixes in `specs/001-price-comparison-mvp/quickstart.md` and `specs/001-price-comparison-mvp/checklists/requirements.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and establishes the ingestion, matching, ranking, and search baseline for the MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because product details consume the canonical products and shopper-visible offers created by the search pipeline.
- **User Story 3 (Phase 5)**: Depends on Foundational plus the crawl and source data created in User Story 1; it can begin after US1 is stable.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No story dependency beyond Foundational and is the MVP slice.
- **User Story 2 (P2)**: Depends on User Story 1 search, catalog, and offer data.
- **User Story 3 (P3)**: Depends on User Story 1 ingestion and crawl telemetry, but remains independently testable from the shopper UI.

### Within Each User Story

- Contract, integration, and e2e tests should be written before implementation and verified failing.
- Backend data and service layers should land before route handlers.
- Frontend API clients should land before page integration.
- Localization, provenance, freshness, and observability work must ship with the story they affect.
- Each story should reach its own checkpoint before moving to the next priority.

### Parallel Opportunities

- `T003`, `T004`, and `T005` can run in parallel after `T001`.
- `T007` through `T013` can run in parallel once `T006` defines the shared schema baseline.
- In US1, `T019` and `T020` can run in parallel, as can `T027`, `T029`, and `T030`.
- In US2, `T035` and `T039` can run in parallel, as can `T041` and `T042`.
- In US3, `T047`, `T052`, `T053`, and `T054` can run in parallel once the foundational auth and API scaffolding exist.
- `T056`, `T058`, and `T059` can run in parallel during the polish phase.

---

## Parallel Example: User Story 1

```bash
# Launch contract and integration coverage together:
Task: "T015 [US1] Add OpenAPI contract coverage for GET /search in backend/tests/contract/search.contract.test.ts"
Task: "T016 [US1] Add backend integration coverage for crawl-to-search flow in backend/tests/integration/search-flow.test.ts"

# Launch source adapters together:
Task: "T019 [US1] Implement retailer A adapter fetch and parse stages in backend/src/adapters/retailer-a/adapter.ts and backend/src/adapters/retailer-a/parser.ts"
Task: "T020 [US1] Implement retailer B adapter fetch and parse stages in backend/src/adapters/retailer-b/adapter.ts and backend/src/adapters/retailer-b/parser.ts"

# Launch frontend presentation work together:
Task: "T029 [US1] Implement grouped result cards and badge presentation in frontend/src/features/search/search-results.tsx and frontend/src/features/search/result-card.tsx"
Task: "T030 [US1] Implement filter controls and URL-state handling in frontend/src/features/search/search-filters.tsx and frontend/src/features/search/use-search-filters.ts"
```

## Parallel Example: User Story 2

```bash
# Launch backend and frontend client work together:
Task: "T035 [US2] Implement canonical product and offer repositories for product detail projections in backend/src/db/repositories/canonical-product-repository.ts and backend/src/db/repositories/offer-repository.ts"
Task: "T039 [US2] Implement the product detail API client in frontend/src/lib/api/product-client.ts and frontend/src/lib/types/product.ts"

# Launch exact and similar presentation work together:
Task: "T041 [US2] Implement exact-offer comparison components in frontend/src/features/product/product-offers.tsx and frontend/src/features/product/offer-card.tsx"
Task: "T042 [US2] Implement similar-product sections and match-confidence labels in frontend/src/features/product/similar-products.tsx and frontend/src/features/product/match-confidence-badge.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch admin API and UI groundwork together:
Task: "T047 [US3] Implement admin user repository and auth routes in backend/src/auth/admin-user-repository.ts and backend/src/api/routes/admin-auth.ts"
Task: "T052 [US3] Implement the admin dashboard layout and auth guard in frontend/src/app/admin/layout.tsx and frontend/src/app/admin/page.tsx"

# Launch admin widgets together:
Task: "T053 [US3] Implement source health and crawl summary widgets in frontend/src/features/admin/source-health-panel.tsx and frontend/src/features/admin/crawl-summary-cards.tsx"
Task: "T054 [US3] Implement unmatched-product queue and rerun controls in frontend/src/features/admin/unmatched-queue.tsx and frontend/src/features/admin/manual-crawl-form.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate bilingual search, grouped results, filters, provenance, and freshness cutoffs.
5. Demo the shopper search MVP before layering on detail pages or admin tooling.

### Incremental Delivery

1. Setup + Foundational establish the shared platform.
2. Add User Story 1 to deliver the shopper-facing MVP.
3. Add User Story 2 to deepen comparison confidence on product details.
4. Add User Story 3 to give internal admins operational visibility and recovery tools.
5. Finish with polish tasks that harden the whole product.

### Parallel Team Strategy

1. One engineer owns platform setup and foundational backend wiring.
2. Once Foundational is complete:
   - Engineer A: User Story 1 backend ingestion, matching, and ranking
   - Engineer B: User Story 1 frontend shopper experience
3. After US1 stabilizes:
   - Engineer A: User Story 2 backend detail and explanation services
   - Engineer B: User Story 2 frontend detail UI
   - Engineer C: User Story 3 admin APIs and dashboard

---

## Notes

- Total tasks: 61
- User Story 1 tasks: 17 (`T015`-`T031`)
- User Story 2 tasks: 12 (`T032`-`T043`)
- User Story 3 tasks: 12 (`T044`-`T055`)
- Setup/Foundation tasks: 14 (`T001`-`T014`)
- Polish tasks: 6 (`T056`-`T061`)
- Every task follows the required checklist format with a task ID, optional `[P]` marker, story label where required, and explicit file paths.
