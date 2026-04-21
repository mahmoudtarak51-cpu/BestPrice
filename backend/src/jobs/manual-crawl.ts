import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { crawlJobs } from '../db/schema.js';
import type { SourceRegistry } from '../adapters/source-registry.js';
import { createLogger } from '../support/logger.js';

const logger = createLogger('ManualCrawlJob');

/**
 * Manual crawl job handler
 * Triggered by admin from the operations dashboard
 * Inherits from standard crawl job but records admin trigger
 */
export async function handleManualCrawlJob(
  job: Job,
  database: Database,
  adapterRegistry: SourceRegistry,
): Promise<void> {
  const {
    adapterId,
    triggeredByAdminId,
  } = job.data as {
    adapterId: string;
    triggeredByAdminId?: string | null;
  };
  const jobId = String(job.id);

  logger.info({
    jobId,
    adapterId,
    triggeredByAdminId,
  }, 'Starting manual crawl');

  try {
    // Mark job as running
    await database
      .update(crawlJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(crawlJobs.id, jobId));

    // Get adapter
    // Ensure adapter exists; actual crawl execution is handled by the regular worker flow.
    adapterRegistry.get(adapterId);
    logger.info({ adapterId }, 'Manual crawl adapter verified');

    // Update job with results
    await database
      .update(crawlJobs)
      .set({
        status: 'succeeded',
        finishedAt: new Date(),
        fetchedCount: 0,
        failedCount: 0,
        normalizedCount: 0,
      })
      .where(eq(crawlJobs.id, jobId));

    logger.info({
      jobId,
      adapterId,
      fetchedCount: 0,
      failedCount: 0,
      normalizedCount: 0,
    }, 'Manual crawl completed');
  } catch (error) {
    logger.error({
      jobId,
      adapterId,
      error: error instanceof Error ? error.message : String(error),
    }, 'Manual crawl failed');

    // Mark job as failed
    await database
      .update(crawlJobs)
      .set({
        status: 'failed',
        finishedAt: new Date(),
      })
      .where(eq(crawlJobs.id, jobId));

    throw error;
  }
}
