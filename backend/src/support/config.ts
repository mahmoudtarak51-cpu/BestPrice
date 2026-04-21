import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_DEVELOPMENT_SESSION_SECRET =
  'development-only-session-secret';
const DEFAULT_DEVELOPMENT_ADMIN_PASSWORD = 'change-me-now';
const MIN_SESSION_SECRET_LENGTH = 24;
const MAX_ADMIN_SESSION_TTL_HOURS = 24;
const MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH = 12;
const placeholderSecretPattern = /replace-me|change-me|development-only/i;
type EnvSource = Record<string, string | undefined>;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://bestprice:bestprice@localhost:5432/bestprice'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH).optional(),
  ADMIN_SEED_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_SEED_PASSWORD: z.string().min(6).default(DEFAULT_DEVELOPMENT_ADMIN_PASSWORD),
  SOURCE_A_BASE_URL: z.string().min(1).default('https://retailer-a.example'),
  SOURCE_B_BASE_URL: z.string().min(1).default('https://retailer-b.example'),
  API_BASE_PATH: z.string().min(1).default('/api/v1'),
  OPENAPI_DOCS_PATH: z.string().min(1).default('/docs'),
  METRICS_PATH: z.string().min(1).default('/metrics'),
  HEALTH_PATH: z.string().min(1).default('/health'),
  ADMIN_SESSION_COOKIE_NAME: z
    .string()
    .min(1)
    .default('bestprice_admin_session'),
  ADMIN_SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_ADMIN_SESSION_TTL_HOURS)
    .default(12),
  QUEUE_PREFIX: z.string().min(1).default('bestprice'),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof envSchema>['NODE_ENV'];
  port: number;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  databaseUrl: string;
  redisUrl: string;
  sessionSecret: string;
  adminSeedEmail: string;
  adminSeedPassword: string;
  sourceBaseUrls: {
    retailerA: string;
    retailerB: string;
  };
  apiBasePath: string;
  openApiDocsPath: string;
  metricsPath: string;
  healthPath: string;
  adminSessionCookieName: string;
  adminSessionTtlHours: number;
  queuePrefix: string;
};

export function loadConfig(source: EnvSource = process.env): AppConfig {
  const env = envSchema.parse(resolveConfigSource(source));
  const sessionSecret = resolveSessionSecret(env);

  validateSecretQuality(env.NODE_ENV, sessionSecret, 'SESSION_SECRET');
  validateSecretQuality(
    env.NODE_ENV,
    env.ADMIN_SEED_PASSWORD,
    'ADMIN_SEED_PASSWORD',
  );

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    sessionSecret,
    adminSeedEmail: env.ADMIN_SEED_EMAIL,
    adminSeedPassword: env.ADMIN_SEED_PASSWORD,
    sourceBaseUrls: {
      retailerA: env.SOURCE_A_BASE_URL,
      retailerB: env.SOURCE_B_BASE_URL,
    },
    apiBasePath: normalizePath(env.API_BASE_PATH),
    openApiDocsPath: normalizePath(env.OPENAPI_DOCS_PATH),
    metricsPath: normalizePath(env.METRICS_PATH),
    healthPath: normalizePath(env.HEALTH_PATH),
    adminSessionCookieName: env.ADMIN_SESSION_COOKIE_NAME,
    adminSessionTtlHours: env.ADMIN_SESSION_TTL_HOURS,
    queuePrefix: env.QUEUE_PREFIX,
  };
}

function resolveConfigSource(source: EnvSource): EnvSource {
  if (source !== process.env) {
    return source;
  }

  return loadEnvironmentFiles(source);
}

function normalizePath(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function loadEnvironmentFiles(source: EnvSource): EnvSource {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const filePaths = [
    join(BACKEND_ROOT, '.env'),
    join(BACKEND_ROOT, `.env.${nodeEnv}`),
    join(BACKEND_ROOT, '.env.local'),
    join(BACKEND_ROOT, `.env.${nodeEnv}.local`),
  ];
  const merged = { ...source };
  const lockedKeys = new Set(
    Object.entries(source)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key),
  );

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvironmentFile(filePath);

    for (const [key, value] of Object.entries(parsed)) {
      if (!lockedKeys.has(key)) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function parseEnvironmentFile(filePath: string): Record<string, string> {
  const contents = readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    values[key] = normalizeEnvironmentValue(rawValue);
  }

  return values;
}

function normalizeEnvironmentValue(rawValue: string): string {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    const unwrapped = value.slice(1, -1);

    if (value.startsWith('"')) {
      return unwrapped
        .replace(/\\n/gu, '\n')
        .replace(/\\r/gu, '\r')
        .replace(/\\t/gu, '\t');
    }

    return unwrapped;
  }

  return value;
}

function resolveSessionSecret(
  env: z.infer<typeof envSchema>,
): string {
  if (env.SESSION_SECRET) {
    return env.SESSION_SECRET;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is required in production and must not rely on the development fallback.',
    );
  }

  return DEFAULT_DEVELOPMENT_SESSION_SECRET;
}

function validateSecretQuality(
  nodeEnv: z.infer<typeof envSchema>['NODE_ENV'],
  value: string,
  fieldName: 'SESSION_SECRET' | 'ADMIN_SEED_PASSWORD',
): void {
  if (nodeEnv !== 'production') {
    return;
  }

  if (placeholderSecretPattern.test(value)) {
    throw new Error(
      `${fieldName} must be replaced with a strong production secret before deployment.`,
    );
  }

  if (
    fieldName === 'ADMIN_SEED_PASSWORD'
    && value.length < MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH
  ) {
    throw new Error(
      `ADMIN_SEED_PASSWORD must be at least ${MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH} characters in production.`,
    );
  }
}
