# Quickstart: Egypt Price Comparison MVP

## Prerequisites

- Node.js 22 LTS
- pnpm 10+
- Docker Desktop or Docker Engine with Compose support

## 0. Verify the local toolchain

Use the package manager version pinned by the workspace before running any app
scripts.

```bash
node --version
corepack enable
corepack use pnpm@10.0.0
pnpm --version
docker compose version
```

Expected baseline:

- Node.js 22 LTS
- `pnpm 10.x`
- Docker Compose available on the command line

## 1. Start local infrastructure

```bash
docker compose up -d postgres redis
```

Expected services:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## 2. Install workspace dependencies

```bash
pnpm install
```

## 3. Configure environment variables

Create local environment files for both apps.

Backend minimum values:

```bash
DATABASE_URL=postgres://bestprice:bestprice@localhost:5432/bestprice
REDIS_URL=redis://localhost:6379
SESSION_SECRET=replace-me
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=replace-me
SOURCE_A_BASE_URL=https://retailer-a.example
SOURCE_B_BASE_URL=https://retailer-b.example
```

Frontend minimum values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
API_BASE_URL=http://localhost:3001/api/v1
```

## 4. Initialize the database

```bash
pnpm --filter backend db:migrate
pnpm --filter backend db:seed:catalog
pnpm --filter backend db:seed:admins
```

The seed step should create:

- Launch categories: phones, laptops, headphones, TVs
- Initial brand aliases used for bilingual matching
- One internal admin account for local dashboard access

## 5. Run the applications

Start the API:

```bash
pnpm --filter backend dev:api
```

Start the background worker:

```bash
pnpm --filter backend dev:worker
```

Start the frontend:

```bash
pnpm --filter frontend dev
```

## 6. Register and sync the two MVP retailers

Create the two direct-retailer adapter records and run an initial crawl.

```bash
pnpm --filter backend adapters:register
pnpm --filter backend crawl:run -- --adapter retailer-a
pnpm --filter backend crawl:run -- --adapter retailer-b
```

The worker should:

1. Fetch raw listings from each source
2. Parse and normalize the listings
3. Match them into canonical products
4. Create offers and price-history snapshots
5. Refresh the shopper search view

## 7. Validate the shopper experience

Use the frontend to confirm:

1. Arabic search returns grouped product results
2. English search returns the same canonical products for equivalent queries
3. Search filters work for category, brand, store, and price range
4. Product pages separate exact matches from similar products
5. Offers older than 12 hours do not appear to shoppers

## 8. Validate the admin operations experience

Open the admin area and confirm:

1. Internal admin login succeeds
2. Source freshness and last crawl statuses are visible
3. Parse failures and unmatched listings are visible
4. Manual crawl reruns can be triggered
5. Stale offers remain inspectable internally even though shoppers cannot see
   them

## 9. Minimum test suite before shipping

```bash
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend test:contract
pnpm --filter frontend test:unit
pnpm --filter frontend test:e2e
```

Required MVP checks:

- Search endpoints respect bilingual query normalization
- Matching thresholds classify exact and similar products correctly
- Ranking badges distinguish best overall versus cheapest offers
- Stale offers are hidden after 12 hours
- Admin overview surfaces crawl failures within 15 minutes

## Smoke Run Notes

Smoke validation was attempted on April 17, 2026 against the current local
machine before the polish phase was closed out.

Observed local tool versions:

- `node v24.14.0`
- `npm 11.9.0`
- `git 2.53.0.windows.2`

Observed blockers:

- `pnpm` was not installed on `PATH`, so `npm run typecheck` stopped at the
  workspace script boundary with `pnpm` not recognized.
- `docker` was not installed on `PATH`, so local PostgreSQL and Redis could not
  be started from `docker compose`.
- The machine was running Node 24 instead of the documented Node 22 LTS
  baseline.

Recommended fix before rerunning the full smoke flow:

```bash
corepack enable
corepack use pnpm@10.0.0
docker compose version
pnpm install
pnpm typecheck
pnpm test
```
