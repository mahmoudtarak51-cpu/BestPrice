# Implementation Plan: Egypt Price Comparison MVP

**Branch**: `master` (intended feature branch: `001-price-comparison-mvp`) | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-price-comparison-mvp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build an Egypt-first bilingual electronics price-comparison MVP using a
TypeScript web architecture with a shopper search experience, product details
comparison, and an internal admin operations view. The design uses two direct
retailer adapters, a heuristic matching engine, transparent offer ranking, and
a 12-hour freshness policy that removes stale offers from shopper-facing
surfaces while preserving them for internal review.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js 22 LTS
**Primary Dependencies**: Next.js 15 (App Router), Fastify 5, Drizzle ORM, BullMQ, Zod
**Storage**: PostgreSQL 16, Redis 7
**Testing**: Vitest, Playwright, Supertest, OpenAPI contract validation
**Target Platform**: Linux containers in a single Middle East region deployment
**Project Type**: Web application with background workers
**Performance Goals**: Search results p95 <= 1.5s, product page p95 <= 1.0s, admin issue visibility <= 15 minutes, complete source refresh within 12 hours
**Constraints**: Egypt-first scope, 2 direct retailer sources only, shopper-visible offers stale after 12 hours, no shopper accounts, internal-admin-only operations access, heuristic matching only
**Scale/Scope**: 2 sources, up to 100k raw listings, up to 25k canonical products, 10k daily searches during MVP pilot
**Localization**: Arabic and English UI and query normalization, EGP default currency
**Data Sources**: 2 direct retailer adapters with scheduled crawls and manual re-run support
**Observability**: Structured request and job logs, crawl and freshness metrics, unmatched-product dashboards, ranking audit fields, health checks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Egypt-first scope is preserved with Egypt-only pricing, EGP defaults, and
      initial electronics categories limited to phones, laptops, headphones,
      and TVs.
- [x] Arabic and English behavior is defined for shopper-facing search and
      product discovery flows.
- [x] The design preserves separation between raw products, canonical products,
      offers, and price history.
- [x] Source integrations use modular adapter boundaries and retain provenance,
      freshness, availability, and seller metadata.
- [x] Matching and ranking behavior document confidence, freshness, trust
      inputs, and user-visible labeling decisions.
- [x] Observability and automated validation are defined for ingestion,
      matching, search, ranking, and admin operations.

Post-design gate review: Pass. The generated research, data model, API
contracts, and quickstart artifacts preserve all constitution principles with
no waivers required.

## Project Structure

### Documentation (this feature)

```text
specs/001-price-comparison-mvp/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- http-api.openapi.yaml
|   `-- source-adapter-contract.md
`-- tasks.md
```

### Source Code (repository root)

```text
backend/
|-- src/
|   |-- adapters/
|   |-- api/
|   |-- auth/
|   |-- db/
|   |-- jobs/
|   |-- matching/
|   |-- ranking/
|   |-- search/
|   `-- support/
`-- tests/
    |-- contract/
    |-- integration/
    `-- unit/

frontend/
|-- src/
|   |-- app/
|   |-- components/
|   |-- features/
|   |-- i18n/
|   `-- lib/
`-- tests/
    |-- e2e/
    `-- unit/
```

**Structure Decision**: Use a two-app TypeScript workspace with a Next.js
frontend and a Fastify backend. The backend owns ingestion, matching, ranking,
search, admin APIs, and worker processes so adapter logic and data-quality
controls stay centralized while the frontend remains focused on shopper and
admin user experiences.

## Complexity Tracking

No constitution violations or complexity waivers are required for this plan.
