# Egypt Price Comparison Web App – Implementation Plan

## Project Goal

Build a startup-grade web application for Egypt that compares product prices across multiple sources and returns the best available offer for what the user searches.

The platform should support Arabic and English, and focus initially on electronics where product matching is easier.

---

## Core Product Idea

The app should not only show the cheapest price, but the **best overall offer**, based on:

- Product price
- Shipping cost (if available)
- Stock availability
- Data freshness
- Seller/store trust
- Confidence that listings represent the same product

---

## MVP Scope

Start with:
- Electronics only
- Categories:
  - Phones
  - Laptops
  - Headphones
  - TVs

---

## Source Strategy

Design the system to support multiple types of sources:

- Direct retailers
- Aggregators
- Affiliate feeds
- Future partnerships

Use a **modular adapter architecture** so new sources can be added easily.

---

## User Experience Requirements

### Core Features

- Homepage with search box
- Arabic + English search support
- Results page with grouped products
- “Best price” / “Best overall” badge
- Store/source display
- Price in EGP
- Shipping info (if available)
- Availability status
- Last updated timestamp
- Direct buy link
- Filters:
  - Brand
  - Category
  - Store
  - Price range

### Product Page

- All matched offers for one product
- Clear distinction:
  - Exact matches
  - Similar products

### Future Features

- Watchlist
- Price alerts

---

## Key Domain Concepts

- **Raw Product**: Listing as received from a source
- **Canonical Product**: Normalized product across sources
- **Offer**: Price + availability from one source
- **Price History**: Historical price records

---

## System Architecture

### Frontend
- Next.js
- Tailwind CSS
- SSR for SEO

### Backend
- Node.js or Python

### Database
- PostgreSQL

### Cache
- Redis

### Search
- PostgreSQL full-text OR OpenSearch

### Background Jobs
- Queue system for:
  - Crawling
  - Normalization
  - Matching
  - Indexing

---

## Core System Components

### 1. Source Ingestion Layer

- Modular adapters per source
- Fetch product data
- Store raw data
- Handle parsing per source

### 2. Data Normalization Layer

Extract:
- Brand
- Model
- Specs (RAM, storage, etc.)
- Price normalization
- Category mapping

### 3. Product Matching Engine

- Match using:
  - Model number
  - Brand + structured attributes
  - Fuzzy matching
- Confidence scoring
- Levels:
  - Exact
  - Likely
  - Similar

### 4. Offer Ranking Engine

Score based on:
- Price
- Shipping
- Availability
- Freshness
- Store trust

Expose:
- Cheapest price
- Best overall offer

### 5. Search & Indexing

- Arabic + English support
- Query normalization
- Brand/model extraction

### 6. Admin / Operations

- Crawl monitoring
- Parsing failures
- Unmatched products
- Stale data tracking

---

## Data Model

Main entities:

- stores
- source_adapters
- raw_products
- canonical_products
- offers
- price_history
- categories
- brands
- search_logs
- watchlists
- crawl_jobs
- crawl_failures
- matching_reviews

---

## Matching Engine Strategy

### Level 1: Exact Match
- Model number
- GTIN/EAN

### Level 2: Structured Parsing
- Brand
- Model
- Specs

### Level 3: Fuzzy Matching
- Title similarity

### Level 4: Heuristics
- Images
- Category

### Level 5: Manual Corrections

---

## Ranking Logic

Composite score:

- Price
- Shipping
- Availability
- Freshness
- Trust score

Display:
- Best overall
- Cheapest
- Fastest delivery

---

## Expected Flow

User searches → system:
1. Fetch candidates
2. Normalize data
3. Match products
4. Rank offers
5. Return grouped results

---

## Non-Functional Goals

- Scalable architecture
- Modular source system
- Easy extensibility
- Observability
- Clean codebase

---

## Phased Implementation Plan (Speckit)

### Phase 1 – Foundation

- Project scaffold
- Database schema
- Source adapter interface
- First source ingestion
- Raw data storage

### Phase 2 – Core Logic

- Normalization pipeline
- Canonical product model
- Matching engine v1
- Offer model
- Basic search API

### Phase 3 – Frontend MVP

- Search UI
- Results page
- Product page
- Ranking logic
- Filters

### Phase 4 – Operations

- Admin dashboard
- Crawl monitoring
- Failure handling

### Phase 5 – Growth

- Price history
- Alerts/watchlists
- Matching improvements
- More sources

---

## API Design (High-Level)

### Search API
`GET /search?q=`

### Product Details
`GET /product/{id}`

### Offers
`GET /product/{id}/offers`

### Admin
- Crawl status
- Failures

---

## Source Adapter Interface

Each source should implement:

- fetch()
- parse()
- normalize()
- validate()

---

## MVP Milestones

1. First source ingestion working
2. Basic search returns results
3. Matching engine groups products
4. Offers displayed with ranking
5. UI usable for testing

---

## Constraints

- Egypt-first focus
- Electronics-first MVP
- Source-agnostic design
- Avoid premature ML
- Optimize for fast iteration

---

## Output Requirements for Codex + Speckit

Codex should generate:

1. Phased plan
2. Speckit specs per phase
3. Folder structure
4. Database schema
5. API definitions
6. Matching engine design
7. Source adapter design
8. Implementation order

---

## Final Note

Treat this as a real startup MVP, not a demo. Focus on correctness of product matching and reliability of pricing data over feature bloat.

