FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY frontend frontend

RUN corepack pnpm install --frozen-lockfile --filter frontend...

RUN corepack pnpm --filter frontend build

EXPOSE 3000

CMD ["corepack", "pnpm", "--filter", "frontend", "start", "--hostname", "0.0.0.0", "--port", "3000"]
