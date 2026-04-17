<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Placeholder Principle 1 -> I. Egypt-First Bilingual Experience
- Placeholder Principle 2 -> II. Canonical Matching Before Feature Breadth
- Placeholder Principle 3 -> III. Source Modularity And Provenance
- Placeholder Principle 4 -> IV. Transparent Ranking And Freshness
- Placeholder Principle 5 -> V. Operability And Risk-Based Quality Gates
Added sections:
- Product Data & Offer Integrity
- Delivery Workflow & Quality Gates
Removed sections:
- None
Templates requiring updates:
- updated .specify/templates/plan-template.md
- updated .specify/templates/spec-template.md
- updated .specify/templates/tasks-template.md
Follow-up TODOs:
- None
-->
# BestPrice Constitution

## Core Principles

### I. Egypt-First Bilingual Experience
All user-facing experiences MUST treat Egypt as the primary market and MUST
support both Arabic and English in core search and comparison flows. Prices MUST
be represented in EGP by default, and any scope expansion beyond Egypt or
electronics MUST be explicitly documented in the feature spec and plan before
implementation.

Rationale: The product differentiates through local relevance and bilingual
accessibility; broadening geography or category scope too early weakens accuracy
and execution speed.

### II. Canonical Matching Before Feature Breadth
The platform MUST preserve a clear separation between raw source listings,
canonical products, offers, and price history. Features that affect search,
comparison, or product pages MUST define how exact, likely, and similar matches
are produced, scored, and exposed to users. The team MUST favor matching
correctness and confidence signaling over catalog growth or UI breadth.

Rationale: A price comparison product fails when unlike products are grouped
together or uncertain matches are presented as exact.

### III. Source Modularity And Provenance
Every data source MUST integrate through a modular adapter boundary with
explicit `fetch`, `parse`, `normalize`, and `validate` responsibilities. The
system MUST retain source provenance, crawl timestamps, availability state, and
seller identity for every offer shown to users. Adding a new source MUST NOT
require rewriting existing adapter contracts or ranking logic.

Rationale: The roadmap depends on scaling from early retailer integrations to
aggregators, affiliate feeds, and partnerships without destabilizing the
ingestion pipeline.

### IV. Transparent Ranking And Freshness
The product MUST rank offers using explicit inputs that include price, shipping,
availability, freshness, store trust, and match confidence. User-facing
surfaces MUST distinguish "best overall" from "cheapest" when those outcomes
differ and MUST NOT present stale or low-confidence data without clear labeling.
Changes to ranking logic MUST document the signals used, expected user impact,
and rollback strategy.

Rationale: Users need to trust why one offer is recommended over another,
especially when the lowest price is not the best purchase outcome.

### V. Operability And Risk-Based Quality Gates
Ingestion, normalization, matching, search, and ranking changes MUST ship with
the observability and tests needed to detect regressions. Teams MUST define
logging or metrics for crawl failures, stale data, unmatched products, and
ranking anomalies, and MUST add automated tests for changes to source adapters,
APIs, matching rules, or ranking behavior. Work MAY ship incrementally, but
each increment MUST remain independently testable and operationally reviewable.

Rationale: This product is only as strong as the freshness and reliability of
its data pipeline, not just the UI.

## Product Data & Offer Integrity

- The canonical data model MUST support stores, source adapters, raw products,
  canonical products, offers, price history, categories, brands, search logs,
  watchlists, crawl jobs, crawl failures, and matching reviews when those
  capabilities are in scope.
- Search and product details MUST preserve a clear distinction between exact
  matches and similar products.
- Offer presentation MUST include source or store attribution, last updated
  information, availability, and shipping data when available.
- MVP scope is Egypt-first and electronics-first, with phones, laptops,
  headphones, and TVs as the default launch categories.
- Machine-learning-heavy approaches are deferred unless a plan explicitly
  justifies why heuristic and structured matching are insufficient.

## Delivery Workflow & Quality Gates

- Every feature MUST start with a spec that states user stories, localization
  expectations, edge cases for stale, unavailable, or ambiguous offers, and
  measurable success criteria.
- Every plan MUST pass a Constitution Check before design proceeds and MUST
  record any approved deviations in Complexity Tracking.
- Tasks MUST remain organized by independently testable user stories, and
  cross-cutting work MUST include required observability, provenance, and
  data-quality tasks when applicable.
- Changes affecting ingestion, matching, ranking, search, or API contracts MUST
  include automated validation at the most appropriate level: contract,
  integration, or unit.
- Operational surfaces for crawl monitoring, parsing failures, unmatched
  products, and stale data are part of the core system, not optional polish,
  when the impacted feature touches those workflows.

## Governance

This constitution overrides conflicting local practices for BestPrice.
Amendments MUST be documented in `.specify/memory/constitution.md`, include a
Sync Impact Report, and use semantic versioning for governance changes: MAJOR
for incompatible principle changes or removals, MINOR for new principles or
materially expanded sections, PATCH for clarifications and wording-only
refinements. Constitution compliance MUST be reviewed in every plan, spec, and
task set that introduces or changes product behavior. Reviews MUST explicitly
confirm Egypt-first scope, bilingual experience coverage where user-facing,
adapter modularity and provenance for source data, ranking transparency, and
the required observability and automated validation for risk-bearing changes.

**Version**: 1.0.0 | **Ratified**: 2026-04-17 | **Last Amended**: 2026-04-17
