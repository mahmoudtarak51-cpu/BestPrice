import { Database } from '../client';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { offersTable, storesTable, sourceAdaptersTable } from '../schema';

export interface OfferDetail {
  id: string;
  storeId: string;
  storeName: string;
  price: number;
  currency: string;
  availability: string;
  shippingInfo?: {
    available: boolean;
    cost?: number;
    message?: string;
    estimatedDays?: number;
  };
  freshness: {
    hoursOld: number;
    isStale: boolean;
    lastUpdatedAt: Date;
  };
  rankingReason?: string;
  provenance: {
    lastFetchedAt: Date;
    sourceUrl?: string;
  };
  matchType: 'exact' | 'similar';
  matchConfidence?: number;
}

export class OfferRepository {
  private readonly STALE_THRESHOLD_HOURS = 12;

  constructor(private db: Database) {}

  /**
   * Get all offers for a product, with optional stale offer filtering
   */
  async getOffersForProduct(
    productId: string,
    options?: {
      includeStale?: boolean;
      matchType?: 'exact' | 'similar';
    }
  ): Promise<OfferDetail[]> {
    const offersQuery = this.db
      .select({
        id: offersTable.id,
        storeId: offersTable.storeId,
        storeName: storesTable.displayName,
        price: offersTable.price,
        currency: offersTable.currency,
        availability: offersTable.availability,
        shippingInfo: offersTable.shippingInfo,
        rankingReason: offersTable.rankingReason,
        matchConfidence: offersTable.matchConfidence,
        lastUpdatedAt: offersTable.lastUpdatedAt,
        sourceAdapterLastCrawl: sourceAdaptersTable.lastSuccessfulCrawlAt,
        provenanceUrl: offersTable.sourceUrl,
      })
      .from(offersTable)
      .innerJoin(storesTable, eq(offersTable.storeId, storesTable.id))
      .innerJoin(
        sourceAdaptersTable,
        eq(storesTable.id, sourceAdaptersTable.storeId)
      )
      .where(eq(offersTable.canonicalProductId, productId));

    let offers = await offersQuery;

    // Filter stale offers if not explicitly included
    if (!options?.includeStale) {
      const now = new Date();
      offers = offers.filter((offer) => {
        const hoursOld = (now.getTime() - offer.lastUpdatedAt.getTime()) / (1000 * 60 * 60);
        return hoursOld < this.STALE_THRESHOLD_HOURS;
      });
    }

    // Transform to OfferDetail
    const now = new Date();
    return offers.map((offer) => {
      const hoursOld = (now.getTime() - offer.lastUpdatedAt.getTime()) / (1000 * 60 * 60);
      const isStale = hoursOld >= this.STALE_THRESHOLD_HOURS;

      return {
        id: offer.id,
        storeId: offer.storeId,
        storeName: offer.storeName,
        price: offer.price,
        currency: offer.currency,
        availability: offer.availability,
        shippingInfo: offer.shippingInfo
          ? JSON.parse(offer.shippingInfo as string)
          : {
              available: false,
              message: 'Shipping information not available',
            },
        freshness: {
          hoursOld: Math.round(hoursOld * 10) / 10,
          isStale,
          lastUpdatedAt: offer.lastUpdatedAt,
        },
        rankingReason: offer.rankingReason || undefined,
        provenance: {
          lastFetchedAt: offer.sourceAdapterLastCrawl || offer.lastUpdatedAt,
          sourceUrl: offer.provenanceUrl || undefined,
        },
        matchType: 'exact' as const,
        matchConfidence: offer.matchConfidence || 100,
      };
    }).sort((a, b) => {
      // Sort by ranking reason first (best_overall first, then cheapest)
      const reasonOrder: Record<string, number> = {
        best_overall: 0,
        cheapest: 1,
      };

      const aOrder = reasonOrder[a.rankingReason || ''] ?? 2;
      const bOrder = reasonOrder[b.rankingReason || ''] ?? 2;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // Then by price (cheapest first)
      return a.price - b.price;
    });
  }

  /**
   * Get all offers across products with optional filtering
   */
  async getAllOffers(options?: {
    storeId?: string;
    includeStale?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<OfferDetail[]> {
    let query = this.db
      .select({
        id: offersTable.id,
        storeId: offersTable.storeId,
        storeName: storesTable.displayName,
        price: offersTable.price,
        currency: offersTable.currency,
        availability: offersTable.availability,
        shippingInfo: offersTable.shippingInfo,
        rankingReason: offersTable.rankingReason,
        matchConfidence: offersTable.matchConfidence,
        lastUpdatedAt: offersTable.lastUpdatedAt,
        sourceAdapterLastCrawl: sourceAdaptersTable.lastSuccessfulCrawlAt,
        provenanceUrl: offersTable.sourceUrl,
      })
      .from(offersTable)
      .innerJoin(storesTable, eq(offersTable.storeId, storesTable.id))
      .innerJoin(
        sourceAdaptersTable,
        eq(storesTable.id, sourceAdaptersTable.storeId)
      );

    // Apply filters
    const conditions = [];

    if (options?.storeId) {
      conditions.push(eq(offersTable.storeId, options.storeId));
    }

    if (!options?.includeStale) {
      const staleThreshold = new Date(Date.now() - this.STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
      conditions.push(gte(offersTable.lastUpdatedAt, staleThreshold));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Apply pagination
    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    const offers = await query;

    const now = new Date();
    return offers.map((offer) => {
      const hoursOld = (now.getTime() - offer.lastUpdatedAt.getTime()) / (1000 * 60 * 60);
      const isStale = hoursOld >= this.STALE_THRESHOLD_HOURS;

      return {
        id: offer.id,
        storeId: offer.storeId,
        storeName: offer.storeName,
        price: offer.price,
        currency: offer.currency,
        availability: offer.availability,
        shippingInfo: offer.shippingInfo
          ? JSON.parse(offer.shippingInfo as string)
          : {
              available: false,
              message: 'Shipping information not available',
            },
        freshness: {
          hoursOld: Math.round(hoursOld * 10) / 10,
          isStale,
          lastUpdatedAt: offer.lastUpdatedAt,
        },
        rankingReason: offer.rankingReason || undefined,
        provenance: {
          lastFetchedAt: offer.sourceAdapterLastCrawl || offer.lastUpdatedAt,
          sourceUrl: offer.provenanceUrl || undefined,
        },
        matchType: 'exact' as const,
        matchConfidence: offer.matchConfidence || 100,
      };
    });
  }

  /**
   * Get stale offers for admin review
   */
  async getStaleOffers(options?: {
    hoursThreshold?: number;
    limit?: number;
    offset?: number;
  }): Promise<OfferDetail[]> {
    const hoursThreshold = options?.hoursThreshold ?? this.STALE_THRESHOLD_HOURS;
    const staleBefore = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    let query = this.db
      .select({
        id: offersTable.id,
        storeId: offersTable.storeId,
        storeName: storesTable.displayName,
        price: offersTable.price,
        currency: offersTable.currency,
        availability: offersTable.availability,
        shippingInfo: offersTable.shippingInfo,
        rankingReason: offersTable.rankingReason,
        matchConfidence: offersTable.matchConfidence,
        lastUpdatedAt: offersTable.lastUpdatedAt,
        sourceAdapterLastCrawl: sourceAdaptersTable.lastSuccessfulCrawlAt,
        provenanceUrl: offersTable.sourceUrl,
      })
      .from(offersTable)
      .innerJoin(storesTable, eq(offersTable.storeId, storesTable.id))
      .innerJoin(
        sourceAdaptersTable,
        eq(storesTable.id, sourceAdaptersTable.storeId)
      )
      .where(lt(offersTable.lastUpdatedAt, staleBefore))
      .orderBy(desc(offersTable.lastUpdatedAt));

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    const offers = await query;

    const now = new Date();
    return offers.map((offer) => {
      const hoursOld = (now.getTime() - offer.lastUpdatedAt.getTime()) / (1000 * 60 * 60);

      return {
        id: offer.id,
        storeId: offer.storeId,
        storeName: offer.storeName,
        price: offer.price,
        currency: offer.currency,
        availability: offer.availability,
        shippingInfo: offer.shippingInfo
          ? JSON.parse(offer.shippingInfo as string)
          : undefined,
        freshness: {
          hoursOld: Math.round(hoursOld * 10) / 10,
          isStale: true,
          lastUpdatedAt: offer.lastUpdatedAt,
        },
        rankingReason: offer.rankingReason || undefined,
        provenance: {
          lastFetchedAt: offer.sourceAdapterLastCrawl || offer.lastUpdatedAt,
          sourceUrl: offer.provenanceUrl || undefined,
        },
        matchType: 'exact' as const,
        matchConfidence: offer.matchConfidence || 100,
      };
    });
  }
}
