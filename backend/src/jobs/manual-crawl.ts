import type { Job } from 'bullmq';
import type { Database } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { crawlJobsTable } from '../db/schema.js';
import type { SourceAdapterRegistry } from '../adapters/source-registry.js';
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
  adapterRegistry: SourceAdapterRegistry,
) {
  const { adapterId, jobId, triggeredByAdminId } = job.data;

  logger.info('Starting manual crawl', {
    jobId,
    adapterId,
    triggeredByAdminId,
  });

  try {
    // Mark job as running
    await database
      .update(crawlJobsTable)
      .set({
        status: 'running',
        started_at: new Date(),
      })
      .where(eq(crawlJobsTable.id, jobId));

    // Get adapter
    const adapter = adapterRegistry.getAdapter(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    // Run the crawl
    logger.info('Executing adapter crawl', { adapterId });
    const result = await adapter.crawl({
      runId: jobId,
      manual: true,
    });

    // Update job with results
    await database
      .update(crawlJobsTable)
      .set({
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date(),
        items_processed: result.itemsProcessed,
        items_failed: result.itemsFailed,
        items_matched: result.itemsMatched,
      })
      .where(eq(crawlJobsTable.id, jobId));

    logger.info('Manual crawl completed', {
      jobId,
      adapterId,
      itemsProcessed: result.itemsProcessed,
      itemsFailed: result.itemsFailed,
      itemsMatched: result.itemsMatched,
    });

    return result;
  } catch (error) {
    logger.error('Manual crawl failed', {
      jobId,
      adapterId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Mark job as failed
    await database
      .update(crawlJobsTable)
      .set({
        status: 'failed',
        completed_at: new Date(),
      })
      .where(eq(crawlJobsTable.id, jobId));

    throw error;
  }
}
