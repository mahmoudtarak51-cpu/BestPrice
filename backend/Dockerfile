FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend backend

RUN corepack pnpm install --frozen-lockfile --filter backend...

EXPOSE 3001

CMD ["corepack", "pnpm", "--filter", "backend", "serve:api"]
