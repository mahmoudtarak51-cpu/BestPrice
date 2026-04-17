import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1).default('postgres://bestprice:bestprice@localhost:5432/bestprice'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(16).default('development-only-session-secret'),
  ADMIN_SEED_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_SEED_PASSWORD: z.string().min(8).default('change-me-now'),
  SOURCE_A_BASE_URL: z.string().min(1).default('https://retailer-a.example'),
  SOURCE_B_BASE_URL: z.string().min(1).default('https://retailer-b.example'),
  API_BASE_PATH: z.string().min(1).default('/api/v1'),
  OPENAPI_DOCS_PATH: z.string().min(1).default('/docs'),
  METRICS_PATH: z.string().min(1).default('/metrics'),
  HEALTH_PATH: z.string().min(1).default('/health'),
  ADMIN_SESSION_COOKIE_NAME: z.string().min(1).default('bestprice_admin_session'),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
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

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(source);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    sessionSecret: env.SESSION_SECRET,
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

function normalizePath(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}
