import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';

import {
  crawlFailures,
  crawlJobs,
  offers,
  rawProducts,
  sourceAdapters,
  stores,
} from '../../db/schema.js';

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return 0;
}

/**
 * Service for monitoring source adapter health and crawl status.
 */
export class SourceHealthService {
  constructor(private database: Database) {}

  async getSourceHealth(adapterId: string) {
    const adapterRows = await this.database
      .select({
        id: sourceAdapters.id,
        key: sourceAdapters.key,
        lastSuccessfulCrawlAt: sourceAdapters.lastSuccessfulCrawlAt,
        crawlIntervalMinutes: sourceAdapters.crawlIntervalMinutes,
        storeName: stores.displayName,
      })
      .from(sourceAdapters)
      .innerJoin(stores, eq(stores.id, sourceAdapters.storeId))
      .where(eq(sourceAdapters.id, adapterId))
      .limit(1);

    if (!adapterRows.length) {
      return null;
    }

    const adapter = adapterRows[0];

    const recentJobs = await this.database
      .select({
        jobId: crawlJobs.id,
        status: crawlJobs.status,
        startedAt: crawlJobs.startedAt,
        completedAt: crawlJobs.finishedAt,
        fetchedCount: crawlJobs.fetchedCount,
      })
      .from(crawlJobs)
      .where(eq(crawlJobs.sourceAdapterId, adapterId))
      .orderBy(desc(crawlJobs.startedAt))
      .limit(10);

    const recentFailures = await this.database
      .select({
        failedAt: crawlFailures.lastSeenAt,
        reason: crawlFailures.message,
        severity: crawlFailures.severity,
      })
      .from(crawlFailures)
      .where(eq(crawlFailures.sourceAdapterId, adapterId))
      .orderBy(desc(crawlFailures.lastSeenAt))
      .limit(5);

    const [{ offerCount }] = await this.database
      .select({ offerCount: count() })
      .from(offers)
      .innerJoin(rawProducts, eq(rawProducts.id, offers.rawProductId))
      .where(eq(rawProducts.sourceAdapterId, adapterId));

    const [{ unmatchedCount }] = await this.database
      .select({ unmatchedCount: count() })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(and(eq(rawProducts.sourceAdapterId, adapterId), isNull(offers.id)));

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const lastCrawlDate = adapter.lastSuccessfulCrawlAt
      ? new Date(adapter.lastSuccessfulCrawlAt)
      : null;
    const isStale = !lastCrawlDate || lastCrawlDate < twelveHoursAgo;

    return {
      adapterId: adapter.id,
      name: adapter.storeName || adapter.key,
      isStale,
      lastCrawlAt: adapter.lastSuccessfulCrawlAt,
      lastFailureAt: recentFailures[0]?.failedAt ?? null,
      offerCount: toNumber(offerCount),
      unmatchedCount: toNumber(unmatchedCount),
      crawlIntervalMinutes: adapter.crawlIntervalMinutes,
      recentCrawlJobs: recentJobs.map((job) => ({
        jobId: job.jobId,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        itemsProcessed: toNumber(job.fetchedCount),
      })),
      recentFailures: recentFailures.map((failure) => ({
        failedAt: failure.failedAt,
        reason: failure.reason,
        retryCount: failure.severity === 'warning' ? 1 : 0,
      })),
    };
  }

  async getOverview() {
    const sources = await this.database
      .select({
        id: sourceAdapters.id,
        lastSuccessfulCrawlAt: sourceAdapters.lastSuccessfulCrawlAt,
      })
      .from(sourceAdapters);

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    let activeSources = 0;
    let staleSources = 0;

    for (const source of sources) {
      const isStale = !source.lastSuccessfulCrawlAt
        || new Date(source.lastSuccessfulCrawlAt) < twelveHoursAgo;
      if (isStale) {
        staleSources += 1;
      } else {
        activeSources += 1;
      }
    }

    const recentFailures = await this.database
      .select({
        adapterId: sourceAdapters.id,
        adapterName: stores.displayName,
        failedAt: crawlFailures.lastSeenAt,
        reason: crawlFailures.message,
        jobId: crawlJobs.id,
      })
      .from(crawlFailures)
      .innerJoin(crawlJobs, eq(crawlJobs.id, crawlFailures.crawlJobId))
      .innerJoin(sourceAdapters, eq(sourceAdapters.id, crawlFailures.sourceAdapterId))
      .innerJoin(stores, eq(stores.id, sourceAdapters.storeId))
      .where(gte(crawlFailures.lastSeenAt, fifteenMinutesAgo))
      .orderBy(desc(crawlFailures.lastSeenAt))
      .limit(10);

    const [{ unmatchedCount }] = await this.database
      .select({ unmatchedCount: count() })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(isNull(offers.id));

    return {
      totalSources: sources.length,
      activeSources,
      staleSources,
      recentFailures: recentFailures.map((failure) => ({
        jobId: failure.jobId,
        adapterId: failure.adapterId,
        adapterName: failure.adapterName,
        failedAt: failure.failedAt,
        reason: failure.reason,
      })),
      unmatchedCount: toNumber(unmatchedCount),
      lastUpdatedAt: new Date(),
    };
  }

  async listSources(options: { page?: number; limit?: number; isStale?: boolean } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const rows = await this.database
      .select({
        adapterId: sourceAdapters.id,
        adapterKey: sourceAdapters.key,
        storeName: stores.displayName,
        lastCrawlAt: sourceAdapters.lastSuccessfulCrawlAt,
      })
      .from(sourceAdapters)
      .innerJoin(stores, eq(stores.id, sourceAdapters.storeId))
      .orderBy(sourceAdapters.createdAt)
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.database
      .select({ total: count() })
      .from(sourceAdapters);

    const hydrated = await Promise.all(
      rows.map(async (row) => {
        const isStale = !row.lastCrawlAt || new Date(row.lastCrawlAt) < twelveHoursAgo;

        if (options.isStale !== undefined && options.isStale !== isStale) {
          return null;
        }

        const [{ offerCount }] = await this.database
          .select({ offerCount: count() })
          .from(offers)
          .innerJoin(rawProducts, eq(rawProducts.id, offers.rawProductId))
          .where(eq(rawProducts.sourceAdapterId, row.adapterId));

        const [{ unmatchedCount }] = await this.database
          .select({ unmatchedCount: count() })
          .from(rawProducts)
          .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
          .where(and(eq(rawProducts.sourceAdapterId, row.adapterId), isNull(offers.id)));

        return {
          adapterId: row.adapterId,
          name: row.storeName || row.adapterKey,
          isStale,
          lastCrawlAt: row.lastCrawlAt,
          offerCount: toNumber(offerCount),
          unmatchedCount: toNumber(unmatchedCount),
        };
      }),
    );

    return {
      sources: hydrated.filter((source) => source !== null),
      total: toNumber(total),
      page,
      limit,
    };
  }
}

/**
 * Service for managing unmatched products queue.
 */
export class UnmatchedProductService {
  constructor(private database: Database) {}

  async getUnmatchedProducts(options: {
    page?: number;
    limit?: number;
    adapterId?: string;
    failureReason?: string;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const predicates = [isNull(offers.id)];
    if (options.adapterId) {
      predicates.push(eq(rawProducts.sourceAdapterId, options.adapterId));
    }
    if (options.failureReason) {
      predicates.push(eq(rawProducts.ingestStatus, options.failureReason as never));
    }

    const products = await this.database
      .select({
        rawProductId: rawProducts.id,
        adapterId: rawProducts.sourceAdapterId,
        title: rawProducts.titleRaw,
        price: rawProducts.priceAmountEgp,
        url: rawProducts.sourceUrl,
        crawledAt: rawProducts.fetchedAt,
        failureReason: rawProducts.ingestStatus,
      })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(and(...predicates))
      .orderBy(desc(rawProducts.fetchedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.database
      .select({ total: count() })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(and(...predicates));

    return {
      products: products.map((product) => ({
        rawProductId: product.rawProductId,
        adapterId: product.adapterId,
        title: product.title,
        price: toNumber(product.price),
        url: product.url,
        crawledAt: product.crawledAt,
        failureReason: product.failureReason,
      })),
      total: toNumber(total),
      page,
      limit,
    };
  }

  async getUnmatchedProduct(rawProductId: string) {
    const rows = await this.database
      .select({
        rawProductId: rawProducts.id,
        adapterId: rawProducts.sourceAdapterId,
        title: rawProducts.titleRaw,
        price: rawProducts.priceAmountEgp,
        url: rawProducts.sourceUrl,
        crawledAt: rawProducts.fetchedAt,
        failureReason: rawProducts.ingestStatus,
        gtin: sql<string | null>`null`,
        brand: rawProducts.brandRaw,
        model: sql<string | null>`null`,
        category: rawProducts.categoryRaw,
        description: rawProducts.descriptionRaw,
        rawData: rawProducts.payloadJson,
      })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(and(eq(rawProducts.id, rawProductId), isNull(offers.id)))
      .limit(1);

    if (!rows.length) {
      return null;
    }

    const product = rows[0];
    return {
      rawProductId: product.rawProductId,
      adapterId: product.adapterId,
      title: product.title,
      price: toNumber(product.price),
      url: product.url,
      crawledAt: product.crawledAt,
      failureReason: product.failureReason,
      gtin: product.gtin,
      brand: product.brand,
      model: product.model,
      category: product.category,
      description: product.description,
      rawData: product.rawData,
    };
  }

  async manualMatch(rawProductId: string, canonicalProductId: string) {
    const existing = await this.database
      .select({
        id: rawProducts.id,
        sourceAdapterId: rawProducts.sourceAdapterId,
      })
      .from(rawProducts)
      .where(eq(rawProducts.id, rawProductId))
      .limit(1);

    if (!existing.length) {
      return null;
    }

    const offerRow = await this.database
      .insert(offers)
      .values({
        canonicalProductId,
        rawProductId,
        storeId: sql`(
          select ${sourceAdapters.storeId}
          from ${sourceAdapters}
          where ${sourceAdapters.id} = ${existing[0].sourceAdapterId}
          limit 1
        )`,
        matchLevel: 'exact',
        matchConfidence: '1',
        priceAmountEgp: sql`coalesce((select ${rawProducts.priceAmountEgp} from ${rawProducts} where ${rawProducts.id} = ${rawProductId}), 0)`,
        shippingAmountEgp: sql`(select ${rawProducts.shippingAmountEgp} from ${rawProducts} where ${rawProducts.id} = ${rawProductId})`,
        landedPriceEgp: sql`coalesce((select ${rawProducts.priceAmountEgp} from ${rawProducts} where ${rawProducts.id} = ${rawProductId}), 0)
          + coalesce((select ${rawProducts.shippingAmountEgp} from ${rawProducts} where ${rawProducts.id} = ${rawProductId}), 0)`,
        availabilityStatus: 'unknown',
        lastSuccessfulUpdateAt: new Date(),
        staleAfterAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        shopperVisible: true,
        trustScoreSnapshot: '0',
        buyUrl: sql`coalesce((select ${rawProducts.sourceUrl} from ${rawProducts} where ${rawProducts.id} = ${rawProductId}), '')`,
      })
      .returning({ id: offers.id });

    await this.database
      .update(rawProducts)
      .set({ ingestStatus: 'matched' })
      .where(eq(rawProducts.id, rawProductId));

    return offerRow[0] || null;
  }

  async reject(rawProductId: string, _reason: string) {
    const result = await this.database
      .update(rawProducts)
      .set({ ingestStatus: 'rejected' })
      .where(eq(rawProducts.id, rawProductId))
      .returning({ id: rawProducts.id });

    return result[0] || null;
  }

  async getStatistics() {
    const [{ total }] = await this.database
      .select({ total: count() })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(isNull(offers.id));

    const byAdapter = await this.database
      .select({
        adapterId: rawProducts.sourceAdapterId,
        count: count(),
      })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(isNull(offers.id))
      .groupBy(rawProducts.sourceAdapterId);

    const byReason = await this.database
      .select({
        reason: rawProducts.ingestStatus,
        count: count(),
      })
      .from(rawProducts)
      .leftJoin(offers, eq(offers.rawProductId, rawProducts.id))
      .where(isNull(offers.id))
      .groupBy(rawProducts.ingestStatus);

    return {
      total: toNumber(total),
      byAdapter: byAdapter.map((row) => ({
        adapterId: row.adapterId,
        count: toNumber(row.count),
      })),
      byReason: byReason.map((row) => ({
        reason: row.reason,
        count: toNumber(row.count),
      })),
    };
  }
}
