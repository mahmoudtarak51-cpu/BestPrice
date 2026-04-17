import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

export type DependencyHealth = {
  name: string;
  ok: boolean;
  latencyMs: number;
  details?: string;
};

export type HealthSnapshot = {
  status: 'ok' | 'degraded';
  checkedAt: string;
  dependencies: DependencyHealth[];
};

export type DependencyCheck = () => Promise<
  boolean | { ok: boolean; details?: string }
>;

export class AppMetrics {
  readonly registry: Registry;
  readonly httpRequestDurationSeconds: Histogram<'method' | 'route' | 'status'>;
  readonly backgroundJobDurationSeconds: Histogram<'queue' | 'status'>;
  readonly backgroundJobsTotal: Counter<'queue' | 'status'>;
  readonly sourceFreshnessHours: Gauge<'adapter_key'>;
  readonly dependencyHealth: Gauge<'dependency'>;

  constructor(prefix = 'bestprice_') {
    this.registry = new Registry();
    collectDefaultMetrics({
      prefix,
      register: this.registry,
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status'] as const,
      buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.backgroundJobDurationSeconds = new Histogram({
      name: `${prefix}background_job_duration_seconds`,
      help: 'Background job execution duration in seconds.',
      labelNames: ['queue', 'status'] as const,
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 15, 30, 60],
      registers: [this.registry],
    });

    this.backgroundJobsTotal = new Counter({
      name: `${prefix}background_jobs_total`,
      help: 'Total number of processed background jobs.',
      labelNames: ['queue', 'status'] as const,
      registers: [this.registry],
    });

    this.sourceFreshnessHours = new Gauge({
      name: `${prefix}source_freshness_hours`,
      help: 'Current freshness age for source adapters in hours.',
      labelNames: ['adapter_key'] as const,
      registers: [this.registry],
    });

    this.dependencyHealth = new Gauge({
      name: `${prefix}dependency_health`,
      help: 'Dependency health status where 1 is healthy and 0 is unhealthy.',
      labelNames: ['dependency'] as const,
      registers: [this.registry],
    });
  }

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    this.httpRequestDurationSeconds.observe(
      { method, route, status: String(statusCode) },
      durationSeconds,
    );
  }

  observeJob(queue: string, status: string, durationSeconds: number): void {
    this.backgroundJobDurationSeconds.observe(
      { queue, status },
      durationSeconds,
    );
    this.backgroundJobsTotal.inc({ queue, status });
  }

  recordDependency(name: string, ok: boolean): void {
    this.dependencyHealth.set({ dependency: name }, ok ? 1 : 0);
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}

export async function runDependencyChecks(
  checks: Record<string, DependencyCheck>,
  metrics?: AppMetrics,
): Promise<HealthSnapshot> {
  const dependencies: DependencyHealth[] = [];

  for (const [name, check] of Object.entries(checks)) {
    const startedAt = performance.now();

    try {
      const result = await check();
      const latencyMs = roundToMilliseconds(performance.now() - startedAt);
      const normalized =
        typeof result === 'boolean' ? { ok: result } : result;

      metrics?.recordDependency(name, normalized.ok);
      dependencies.push({
        name,
        ok: normalized.ok,
        latencyMs,
        details: normalized.details,
      });
    } catch (error) {
      const latencyMs = roundToMilliseconds(performance.now() - startedAt);
      const details =
        error instanceof Error ? error.message : 'Unknown dependency failure';

      metrics?.recordDependency(name, false);
      dependencies.push({
        name,
        ok: false,
        latencyMs,
        details,
      });
    }
  }

  return {
    status: dependencies.every((dependency) => dependency.ok)
      ? 'ok'
      : 'degraded',
    checkedAt: new Date().toISOString(),
    dependencies,
  };
}

function roundToMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}
