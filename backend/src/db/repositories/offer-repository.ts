import type { Database } from '../client.js';
import { desc, eq, lt } from 'drizzle-orm';
import { offers, stores, sourceAdapters } from '../schema.js';

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

  private toNumber(value: unknown): number {
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

  private toOfferDetail(row: {
    id: string;
    storeId: string;
    storeName: string;
    priceAmountEgp: unknown;
    shippingAmountEgp: unknown;
    availabilityStatus: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown';
    reasonCodesJson: string[];
    matchConfidence: unknown;
    lastSuccessfulUpdateAt: Date;
    sourceAdapterLastCrawl: Date | null;
    buyUrl: string;
    matchLevel: 'exact' | 'likely' | 'similar';
  }): OfferDetail {
    const now = new Date();
    const hoursOld =
      (now.getTime() - row.lastSuccessfulUpdateAt.getTime()) / (1000 * 60 * 60);
    const shippingCost =
      row.shippingAmountEgp === null || row.shippingAmountEgp === undefined
        ? undefined
        : this.toNumber(row.shippingAmountEgp);

    const rankingReason = row.reasonCodesJson.find((code) => (
      code === 'best_overall'
      || code === 'cheapest'
      || code === 'trusted_seller'
      || code === 'fast_shipping'
      || code === 'good_value'
    ));

    return {
      id: row.id,
      storeId: row.storeId,
      storeName: row.storeName,
      price: this.toNumber(row.priceAmountEgp),
      currency: 'EGP',
      availability: row.availabilityStatus,
      shippingInfo: {
        available: shippingCost !== undefined,
        cost: shippingCost,
      },
      freshness: {
        hoursOld: Math.round(hoursOld * 10) / 10,
        isStale: hoursOld >= this.STALE_THRESHOLD_HOURS,
        lastUpdatedAt: row.lastSuccessfulUpdateAt,
      },
      rankingReason,
      provenance: {
        lastFetchedAt: row.sourceAdapterLastCrawl ?? row.lastSuccessfulUpdateAt,
        sourceUrl: row.buyUrl,
      },
      matchType: row.matchLevel === 'exact' ? 'exact' : 'similar',
      matchConfidence: this.toNumber(row.matchConfidence),
    };
  }

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
    const rows = await this.db
      .select({
        id: offers.id,
        storeId: offers.storeId,
        storeName: stores.displayName,
        priceAmountEgp: offers.priceAmountEgp,
        shippingAmountEgp: offers.shippingAmountEgp,
        availabilityStatus: offers.availabilityStatus,
        reasonCodesJson: offers.reasonCodesJson,
        matchConfidence: offers.matchConfidence,
        lastSuccessfulUpdateAt: offers.lastSuccessfulUpdateAt,
        sourceAdapterLastCrawl: sourceAdapters.lastSuccessfulCrawlAt,
        buyUrl: offers.buyUrl,
        matchLevel: offers.matchLevel,
      })
      .from(offers)
      .innerJoin(stores, eq(offers.storeId, stores.id))
      .innerJoin(
        sourceAdapters,
        eq(stores.id, sourceAdapters.storeId)
      )
      .where(eq(offers.canonicalProductId, productId));

    let mapped = rows.map((row) => this.toOfferDetail(row));

    if (options?.matchType) {
      mapped = mapped.filter((row) => row.matchType === options.matchType);
    }

    // Filter stale offers if not explicitly included
    if (!options?.includeStale) {
      mapped = mapped.filter((offer) => !offer.freshness.isStale);
    }

    return mapped.sort((a, b) => {
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
    const rows = await this.db
      .select({
        id: offers.id,
        storeId: offers.storeId,
        storeName: stores.displayName,
        priceAmountEgp: offers.priceAmountEgp,
        shippingAmountEgp: offers.shippingAmountEgp,
        availabilityStatus: offers.availabilityStatus,
        reasonCodesJson: offers.reasonCodesJson,
        matchConfidence: offers.matchConfidence,
        lastSuccessfulUpdateAt: offers.lastSuccessfulUpdateAt,
        sourceAdapterLastCrawl: sourceAdapters.lastSuccessfulCrawlAt,
        buyUrl: offers.buyUrl,
        matchLevel: offers.matchLevel,
      })
      .from(offers)
      .innerJoin(stores, eq(offers.storeId, stores.id))
      .innerJoin(
        sourceAdapters,
        eq(stores.id, sourceAdapters.storeId)
      );

    let mapped = rows.map((row) => this.toOfferDetail(row));

    if (options?.storeId) {
      mapped = mapped.filter((row) => row.storeId === options.storeId);
    }
    if (!options?.includeStale) {
      mapped = mapped.filter((row) => !row.freshness.isStale);
    }
    if (options?.offset) {
      mapped = mapped.slice(options.offset);
    }
    if (options?.limit) {
      mapped = mapped.slice(0, options.limit);
    }

    return mapped;
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
        id: offers.id,
        storeId: offers.storeId,
        storeName: stores.displayName,
        priceAmountEgp: offers.priceAmountEgp,
        shippingAmountEgp: offers.shippingAmountEgp,
        availabilityStatus: offers.availabilityStatus,
        reasonCodesJson: offers.reasonCodesJson,
        matchConfidence: offers.matchConfidence,
        lastSuccessfulUpdateAt: offers.lastSuccessfulUpdateAt,
        sourceAdapterLastCrawl: sourceAdapters.lastSuccessfulCrawlAt,
        buyUrl: offers.buyUrl,
        matchLevel: offers.matchLevel,
      })
      .from(offers)
      .innerJoin(stores, eq(offers.storeId, stores.id))
      .innerJoin(
        sourceAdapters,
        eq(stores.id, sourceAdapters.storeId)
      )
      .where(lt(offers.lastSuccessfulUpdateAt, staleBefore))
      .orderBy(desc(offers.lastSuccessfulUpdateAt));

    const rows = await query;
    let mapped = rows.map((row) => this.toOfferDetail(row));
    mapped = mapped.filter((row) => row.freshness.hoursOld >= hoursThreshold);

    if (options?.offset) {
      mapped = mapped.slice(options.offset);
    }
    if (options?.limit) {
      mapped = mapped.slice(0, options.limit);
    }

    return mapped;
  }
}
