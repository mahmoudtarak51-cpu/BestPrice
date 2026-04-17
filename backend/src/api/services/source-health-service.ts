import type { Database } from 'drizzle-orm';
import { desc, eq, and, gte, sql, count, lte } from 'drizzle-orm';
import {
  sourceAdaptersTable,
  crawlJobsTable,
  crawlFailuresTable,
  offersTable,
  rawProductsTable,
} from '../db/schema.js';

/**
 * Service for monitoring source adapter health and crawl status
 */
export class SourceHealthService {
  constructor(private database: Database) {}

  /**
   * Get health status for a single source
   */
  async getSourceHealth(adapterId: string) {
    const adapter = await this.database
      .select()
      .from(sourceAdaptersTable)
      .where(eq(sourceAdaptersTable.id, adapterId));

    if (!adapter.length) {
      return null;
    }

    const source = adapter[0];

    // Get recent crawl jobs
    const crawlJobs = await this.database
      .select()
      .from(crawlJobsTable)
      .where(eq(crawlJobsTable.adapter_id, adapterId))
      .orderBy(desc(crawlJobsTable.started_at))
      .limit(10);

    // Get recent failures
    const failures = await this.database
      .select({
        failedAt: crawlFailuresTable.failed_at,
        reason: crawlFailuresTable.reason,
        retryCount: crawlFailuresTable.retry_count,
      })
      .from(crawlFailuresTable)
      .innerJoin(
        crawlJobsTable,
        eq(crawlJobsTable.id, crawlFailuresTable.crawl_job_id),
      )
      .where(eq(crawlJobsTable.adapter_id, adapterId))
      .orderBy(desc(crawlFailuresTable.failed_at))
      .limit(5);

    // Count current offers
    const [{ offerCount }] = await this.database
      .select({ offerCount: count() })
      .from(offersTable)
      .where(eq(offersTable.source_adapter_id, adapterId));

    // Check for stale data (>12 hours)
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const isStale = source.last_successful_crawl_at === null ||
      new Date(source.last_successful_crawl_at) < twelveHoursAgo;

    return {
      adapterId: source.id,
      name: source.name,
      isStale,
      lastCrawlAt: source.last_successful_crawl_at,
      lastFailureAt: failures.length > 0 ? failures[0].failedAt : null,
      offerCount,
      unmatchedCount: 0, // Will be populated by UnmatchedProductService
      crawlIntervalMinutes: source.crawl_interval_minutes,
      recentCrawlJobs: crawlJobs.map(job => ({
        jobId: job.id,
        status: job.status,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        itemsProcessed: job.items_processed,
      })),
      recentFailures: failures.map(f => ({
        failedAt: f.failedAt,
        reason: f.reason,
        retryCount: f.retryCount,
      })),
    };
  }

  /**
   * Get health overview for all sources
   */
  async getOverview() {
    const sources = await this.database
      .select()
      .from(sourceAdaptersTable)
      .orderBy(sourceAdaptersTable.created_at);

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    let activeSources = 0;
    let staleSources = 0;

    for (const source of sources) {
      const isStale = source.last_successful_crawl_at === null ||
        new Date(source.last_successful_crawl_at) < twelveHoursAgo;
      
      if (isStale) {
        staleSources++;
      } else {
        activeSources++;
      }
    }

    // Get recent failures (within 15 minutes)
    const recentFailures = await this.database
      .select({
        adapterId: crawlJobsTable.adapter_id,
        adapterName: sourceAdaptersTable.name,
        failedAt: crawlFailuresTable.failed_at,
        reason: crawlFailuresTable.reason,
        jobId: crawlJobsTable.id,
      })
      .from(crawlFailuresTable)
      .innerJoin(
        crawlJobsTable,
        eq(crawlJobsTable.id, crawlFailuresTable.crawl_job_id),
      )
      .innerJoin(
        sourceAdaptersTable,
        eq(sourceAdaptersTable.id, crawlJobsTable.adapter_id),
      )
      .where(gte(crawlFailuresTable.failed_at, fifteenMinutesAgo))
      .orderBy(desc(crawlFailuresTable.failed_at))
      .limit(10);

    // Count unmatched products
    const [{ unmatchedCount }] = await this.database
      .select({ unmatchedCount: count() })
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null));

    return {
      totalSources: sources.length,
      activeSources,
      staleSources,
      recentFailures: recentFailures.map(f => ({
        jobId: f.jobId,
        adapterId: f.adapterId,
        adapterName: f.adapterName,
        failedAt: f.failedAt,
        reason: f.reason,
      })),
      unmatchedCount,
      lastUpdatedAt: new Date(),
    };
  }

  /**
   * Get paginated list of all sources
   */
  async listSources(options: {
    page?: number;
    limit?: number;
    isStale?: boolean;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Get all sources
    const sources = await this.database
      .select()
      .from(sourceAdaptersTable)
      .orderBy(sourceAdaptersTable.created_at)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await this.database
      .select({ total: count() })
      .from(sourceAdaptersTable);

    // Hydrate with health data
    const sourceList = await Promise.all(
      sources.map(async source => {
        const isStale = source.last_successful_crawl_at === null ||
          new Date(source.last_successful_crawl_at) < twelveHoursAgo;
        
        // Skip if filtering by stale status
        if (options.isStale !== undefined && options.isStale !== isStale) {
          return null;
        }

        const [{ offerCount }] = await this.database
          .select({ offerCount: count() })
          .from(offersTable)
          .where(eq(offersTable.source_adapter_id, source.id));

        return {
          adapterId: source.id,
          name: source.name,
          isStale,
          lastCrawlAt: source.last_successful_crawl_at,
          offerCount,
          unmatchedCount: 0,
        };
      }),
    );

    return {
      sources: sourceList.filter(s => s !== null),
      total,
      page,
      limit,
    };
  }
}

/**
 * Service for managing unmatched products queue
 */
export class UnmatchedProductService {
  constructor(private database: Database) {}

  /**
   * Get unmatched products with pagination and filtering
   */
  async getUnmatchedProducts(options: {
    page?: number;
    limit?: number;
    adapterId?: string;
    failureReason?: string;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    // Build query
    let query = this.database
      .select()
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null));

    if (options.adapterId) {
      query = query.where(eq(rawProductsTable.source_adapter_id, options.adapterId));
    }

    if (options.failureReason) {
      query = query.where(eq(rawProductsTable.match_failure_reason, options.failureReason));
    }

    // Apply pagination
    const products = await query
      .orderBy(desc(rawProductsTable.crawled_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    let countQuery = this.database
      .select({ total: count() })
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null));

    if (options.adapterId) {
      countQuery = countQuery.where(eq(rawProductsTable.source_adapter_id, options.adapterId));
    }

    if (options.failureReason) {
      countQuery = countQuery.where(eq(rawProductsTable.match_failure_reason, options.failureReason));
    }

    const [{ total }] = await countQuery;

    return {
      products: products.map(p => ({
        rawProductId: p.id,
        adapterId: p.source_adapter_id,
        title: p.title,
        price: p.price,
        url: p.source_url,
        crawledAt: p.crawled_at,
        failureReason: p.match_failure_reason,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get single unmatched product details
   */
  async getUnmatchedProduct(rawProductId: string) {
    const product = await this.database
      .select()
      .from(rawProductsTable)
      .where(and(
        eq(rawProductsTable.id, rawProductId),
        eq(rawProductsTable.canonical_product_id, null),
      ));

    if (!product.length) {
      return null;
    }

    const p = product[0];
    return {
      rawProductId: p.id,
      adapterId: p.source_adapter_id,
      title: p.title,
      price: p.price,
      url: p.source_url,
      crawledAt: p.crawled_at,
      failureReason: p.match_failure_reason,
      gtin: p.gtin,
      brand: p.brand,
      model: p.model,
      category: p.category,
      description: p.description,
      rawData: p.raw_data,
    };
  }

  /**
   * Manually match an unmatched product to a canonical product
   */
  async manualMatch(rawProductId: string, canonicalProductId: string) {
    const result = await this.database
      .update(rawProductsTable)
      .set({
        canonical_product_id: canonicalProductId,
        match_failure_reason: null,
        updated_at: new Date(),
      })
      .where(eq(rawProductsTable.id, rawProductId))
      .returning();

    return result[0] || null;
  }

  /**
   * Reject a product (mark as unable to match)
   */
  async reject(rawProductId: string, reason: string) {
    const result = await this.database
      .update(rawProductsTable)
      .set({
        match_failure_reason: reason,
        updated_at: new Date(),
      })
      .where(eq(rawProductsTable.id, rawProductId))
      .returning();

    return result[0] || null;
  }

  /**
   * Get unmatched product statistics
   */
  async getStatistics() {
    const [{ total }] = await this.database
      .select({ total: count() })
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null));

    // Get breakdown by adapter
    const byAdapter = await this.database
      .select({
        adapterId: rawProductsTable.source_adapter_id,
        count: count(),
      })
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null))
      .groupBy(rawProductsTable.source_adapter_id);

    // Get breakdown by failure reason
    const byReason = await this.database
      .select({
        reason: rawProductsTable.match_failure_reason,
        count: count(),
      })
      .from(rawProductsTable)
      .where(eq(rawProductsTable.canonical_product_id, null))
      .groupBy(rawProductsTable.match_failure_reason);

    return {
      total,
      byAdapter: byAdapter.map(a => ({
        adapterId: a.adapterId,
        count: a.count,
      })),
      byReason: byReason.map(r => ({
        reason: r.reason,
        count: r.count,
      })),
    };
  }
}
