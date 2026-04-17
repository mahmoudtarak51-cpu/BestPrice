# Quickstart: Egypt Price Comparison MVP

## Prerequisites

- Node.js 22 LTS
- pnpm 10+
- Docker Desktop or Docker Engine with Compose support

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
