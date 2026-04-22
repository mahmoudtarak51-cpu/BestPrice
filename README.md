# BestPrice

BestPrice is an Egypt-first price comparison workspace for bilingual shopper
search, offer comparison, and internal admin operations. The repository is
split into a Fastify backend, a Next.js frontend, and a spec-driven delivery
flow under `specs/001-price-comparison-mvp/`.

## Workspace Layout

```text
backend/   Fastify API, jobs, adapters, matching, ranking, and tests
frontend/  Next.js shopper and admin interfaces
specs/     Product specs, plans, contracts, checklists, and task tracking
```

## Prerequisites

- Node.js 22 LTS
- Corepack enabled so `pnpm@10.0.0` can be provisioned from the pinned
  `packageManager`
- Docker with Compose support for PostgreSQL and Redis

Recommended bootstrap:

```bash
corepack enable
corepack use pnpm@10.0.0
```

## Common Commands

From the repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Backend-focused commands:

```bash
pnpm --filter backend dev:api
pnpm --filter backend dev:worker
pnpm --filter backend db:migrate
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter backend test:contract
```

Frontend-focused commands:

```bash
pnpm --filter frontend dev
pnpm --filter frontend test:e2e
```

## Deployment

This repository now includes a Render blueprint at `render.yaml` for:

- `bestprice-frontend` as a Next.js web service
- `bestprice-api` as a Fastify web service
- `bestprice-worker` as a BullMQ worker service
- managed PostgreSQL and Redis

The backend runtime uses `tsx` source execution in production (`serve:api` and
`serve:worker`) so the app can deploy cleanly even while unrelated TypeScript
build errors still exist in unfinished backend modules.

Render deployment flow:

1. Push the repository to GitHub.
2. In Render, create a new Blueprint instance from the repo root.
3. Set a secure value for `ADMIN_SEED_PASSWORD` when Render prompts for unsynced
  environment variables. `SESSION_SECRET` is generated automatically by the
  Blueprint.
4. The API service runs `db:migrate` automatically as a Render pre-deploy step.
5. After the first deploy succeeds, open a Render shell for the backend service
  and run:

  ```bash
  corepack pnpm --filter backend db:seed:catalog
  corepack pnpm --filter backend db:seed:admins
  ```

6. Redeploy `bestprice-api` and `bestprice-worker` if needed after the seed
  step.

The frontend service expects the default Render hostname for the backend:
`https://bestprice-api.onrender.com/api/v1`. If you rename the API service or
attach a custom domain, update `API_BASE_URL` and `NEXT_PUBLIC_APP_URL` in the
frontend service settings.

### Oracle Cloud VM (Always Free)

If Render requires payment for your plan, you can run the full stack on a
single Oracle Cloud Ubuntu VM using Docker Compose.

Included files:

- `docker-compose.oracle.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `deploy/oracle/install-docker.sh`
- `deploy/oracle/deploy.sh`
- `deploy/oracle/.env.vm.example`
- `deploy/oracle/.env.api.example`
- `deploy/oracle/.env.frontend.example`

Setup flow on the VM:

1. Clone this repository.
2. Install Docker:

  ```bash
  bash deploy/oracle/install-docker.sh
  ```

3. Reconnect your SSH session, then prepare env files:

  ```bash
  cp deploy/oracle/.env.vm.example deploy/oracle/.env.vm
  cp deploy/oracle/.env.api.example deploy/oracle/.env.api
  cp deploy/oracle/.env.frontend.example deploy/oracle/.env.frontend
  ```

4. Edit those files with strong production secrets and your VM public IP.
5. Deploy the stack:

  ```bash
  bash deploy/oracle/deploy.sh
  ```

6. Run database migration and seed once:

  ```bash
  docker compose --env-file deploy/oracle/.env.vm -f docker-compose.oracle.yml exec api corepack pnpm --filter backend db:migrate
  docker compose --env-file deploy/oracle/.env.vm -f docker-compose.oracle.yml exec api corepack pnpm --filter backend db:seed:catalog
  docker compose --env-file deploy/oracle/.env.vm -f docker-compose.oracle.yml exec api corepack pnpm --filter backend db:seed:admins
  ```

7. Open VM firewall/security list ports:
  - `3000` for frontend
  - `3001` for API

Checks:

- Frontend: `http://<vm-public-ip>:3000`
- API health: `http://<vm-public-ip>:3001/api/v1/health/live`

## Environment

Backend variables live in `backend/.env.example`. Frontend variables live in
`frontend/.env.example`.

Backend scripts auto-load `backend/.env`, `backend/.env.local`, and matching
environment-specific variants. Shell-provided environment variables still win,
so production should keep using platform secrets instead of committed files.

Recommended local backend bootstrap:

```bash
cp backend/.env.example backend/.env
pnpm --filter backend db:migrate
pnpm --filter backend db:seed:admins
```

Important frontend values:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1`

## Spec Artifacts

The active MVP implementation plan is tracked in:

- `specs/001-price-comparison-mvp/plan.md`
- `specs/001-price-comparison-mvp/quickstart.md`
- `specs/001-price-comparison-mvp/tasks.md`

## Smoke Status

Quickstart smoke validation was attempted on April 17, 2026. The current local
machine reported `node v24.14.0`, `npm 11.9.0`, and `git 2.53.0.windows.2`, but
the flow stopped before dependency install because both `pnpm` and `docker`
were missing from `PATH`. The feature quickstart includes the exact blocker
notes and the recommended fix path.
