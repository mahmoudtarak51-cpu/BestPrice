import { createRetailerAAdapter } from '../adapters/retailer-a/adapter.js';
import { createRetailerBAdapter } from '../adapters/retailer-b/adapter.js';
import { createSourceRegistry, type SourceRegistry } from '../adapters/source-registry.js';
import { matchCatalogListings } from '../matching/matching-service.js';
import { rankOffers } from '../ranking/ranking-service.js';
import { normalizeQuery } from './query-normalizer.js';
import {
  createRankingAuditStore,
  type RankingAuditStore,
} from '../support/ranking-audit.js';
import {
  createSearchLogService,
  type SearchLogService,
} from '../support/search-log-service.js';
import {
  createSourceHealthMetricStore,
  type SourceHealthMetricStore,
} from '../support/source-health-metrics.js';
import { stableIdFromParts } from '../adapters/normalize/normalized-listing.js';

export type SearchRequest = {
  query: string;
  lang?: 'auto' | 'ar' | 'en';
  category?: string;
  brand?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
};

export type SearchOfferSummary = {
  offerId: string;
  store: string;
  priceEgp: number;
  shippingEgp: number | null;
  landedPriceEgp: number | null;
  availability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown';
  lastUpdatedAt: string;
};

export type SearchResultGroup = {
  productId: string;
  canonicalName: string;
  canonicalNameArabic: string | null;
  category: string;
  brand: string;
  imageUrl: string | null;
  badges: Array<'best_overall' | 'cheapest'>;
  bestOverallOffer: SearchOfferSummary;
  cheapestOffer: SearchOfferSummary | null;
  exactOfferCount: number;
  similarProductCount: number;
  lastUpdatedAt: string;
};

export type SearchResponse = {
  query: string;
  detectedLanguage: 'ar' | 'en' | 'mixed' | 'unknown';
  page: number;
  pageSize: number;
  totalResults: number;
  groups: SearchResultGroup[];
};

type IndexedGroup = SearchResultGroup & {
  normalizedText: string;
  visibleStores: string[];
};

export class SearchService {
  readonly #registry: SourceRegistry;
  readonly #searchLogs: SearchLogService;
  readonly #rankingAudit: RankingAuditStore;
  readonly #sourceHealthMetrics: SourceHealthMetricStore;
  readonly #now: () => Date;
  #groups: IndexedGroup[] = [];

  constructor(options?: {
    registry?: SourceRegistry;
    searchLogs?: SearchLogService;
    rankingAudit?: RankingAuditStore;
    sourceHealthMetrics?: SourceHealthMetricStore;
    now?: () => Date;
  }) {
    this.#registry =
      options?.registry
      ?? createSourceRegistry([createRetailerAAdapter(), createRetailerBAdapter()]);
    this.#searchLogs = options?.searchLogs ?? createSearchLogService();
    this.#rankingAudit = options?.rankingAudit ?? createRankingAuditStore();
    this.#sourceHealthMetrics =
      options?.sourceHealthMetrics ?? createSourceHealthMetricStore();
    this.#now = options?.now ?? (() => new Date());
  }

  async bootstrap(): Promise<void> {
    if (this.#groups.length === 0) {
      await this.refreshCatalog();
    }
  }

  async refreshCatalog(): Promise<void> {
    const scheduledAt = this.#now();
    const normalizedListings = [];

    for (const adapter of this.#registry.list()) {
      const fetched = await adapter.fetch({
        adapterKey: adapter.key,
        scheduledAt,
        runType: 'scheduled',
      });
      const parsed = await adapter.parse(fetched);

      for (const parsedListing of parsed) {
        const normalized = await adapter.normalize(parsedListing);
        const validation = await adapter.validate(normalized, {
          adapterKey: adapter.key,
          scheduledAt,
          runType: 'scheduled',
        });

        if (validation.accepted) {
          normalizedListings.push(normalized);
        }
      }
    }

    const matched = matchCatalogListings(normalizedListings);
    const groups = new Map<string, typeof matched>();

    for (const item of matched) {
      const current = groups.get(item.canonicalProductId) ?? [];
      current.push(item);
      groups.set(item.canonicalProductId, current);
    }

    this.#groups = [...groups.values()].map((group) => {
      const representative = group[0]!;
      const ranking = rankOffers(
        group.map((item) => ({
          offerId: stableIdFromParts([
            item.listing.adapterKey,
            item.listing.externalId,
            item.canonicalProductId,
          ]),
          storeId: item.listing.storeId,
          storeName: item.listing.storeName,
          priceEgp: item.listing.priceEgp ?? 0,
          shippingEgp: item.listing.shippingEgp ?? null,
          availabilityStatus: item.listing.availabilityStatus,
          matchConfidence: item.matchConfidence,
          trustScore: item.listing.trustScore,
          lastSuccessfulUpdateAt: item.listing.fetchedAt,
          buyUrl: item.listing.canonicalSourceUrl,
        })),
        {
          now: this.#now(),
        },
      );

      for (const offer of ranking.offers) {
        this.#rankingAudit.append({
          productId: representative.canonicalProductId,
          offerId: offer.offerId,
          rankingScore: offer.rankingScore,
          reasonCodes: offer.reasonCodes,
          recordedAt: this.#now().toISOString(),
        });
      }

      const groupedOffers = group.filter((item) => {
        const rankedOffer = ranking.offers.find((offer) => (
          offer.storeId === item.listing.storeId
          && offer.buyUrl === item.listing.canonicalSourceUrl
        ));

        return rankedOffer?.shopperVisible ?? false;
      });

      const staleOffers = ranking.offers.filter((offer) => !offer.shopperVisible);
      const freshestUpdate = ranking.offers
        .map((offer) => offer.lastSuccessfulUpdateAt)
        .sort()
        .at(-1) ?? representative.listing.fetchedAt;

      const adapters = new Set(group.map((item) => item.listing.adapterKey));

      for (const adapterKey of adapters) {
        const adapterOffers = ranking.offers.filter((offer) => (
          group.some((item) => item.listing.adapterKey === adapterKey && item.listing.storeId === offer.storeId)
        ));
        const latestTimestamp = adapterOffers
          .map((offer) => new Date(offer.lastSuccessfulUpdateAt).getTime())
          .sort((left, right) => right - left)[0] ?? this.#now().getTime();

        this.#sourceHealthMetrics.set({
          adapterKey,
          freshnessHours: Number(((this.#now().getTime() - latestTimestamp) / (60 * 60 * 1000)).toFixed(2)),
          visibleOfferCount: adapterOffers.filter((offer) => offer.shopperVisible).length,
          staleOfferCount: adapterOffers.filter((offer) => !offer.shopperVisible).length,
          recordedAt: this.#now().toISOString(),
        });
      }

      const bestOverall = ranking.bestOverallOffer;
      const cheapest = ranking.cheapestOffer;
      const badges: Array<'best_overall' | 'cheapest'> = ['best_overall'];

      if (cheapest && cheapest.offerId !== bestOverall.offerId) {
        badges.push('cheapest');
      }

      return {
        productId: representative.canonicalProductId,
        canonicalName: representative.canonicalName,
        canonicalNameArabic: representative.canonicalNameArabic,
        category: representative.category,
        brand: representative.brand,
        imageUrl: representative.imageUrl,
        badges,
        bestOverallOffer: {
          offerId: bestOverall.offerId,
          store: bestOverall.storeName,
          priceEgp: bestOverall.priceEgp,
          shippingEgp: bestOverall.shippingEgp,
          landedPriceEgp: bestOverall.landedPriceEgp,
          availability: bestOverall.availabilityStatus,
          lastUpdatedAt: bestOverall.lastSuccessfulUpdateAt,
        },
        cheapestOffer: cheapest
          ? {
              offerId: cheapest.offerId,
              store: cheapest.storeName,
              priceEgp: cheapest.priceEgp,
              shippingEgp: cheapest.shippingEgp,
              landedPriceEgp: cheapest.landedPriceEgp,
              availability: cheapest.availabilityStatus,
              lastUpdatedAt: cheapest.lastSuccessfulUpdateAt,
            }
          : null,
        exactOfferCount: groupedOffers.filter((item) => item.matchLevel === 'exact').length,
        similarProductCount: staleOffers.length,
        lastUpdatedAt: freshestUpdate,
        normalizedText: normalizeQuery(
          `${representative.canonicalName} ${representative.canonicalNameArabic ?? ''} ${representative.brand}`,
        ).normalized,
        visibleStores: groupedOffers.map((item) => item.listing.storeName.toLowerCase()),
      };
    });
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    await this.bootstrap();

    const startedAt = Date.now();
    const normalizedQuery = normalizeQuery(request.query);
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? 20;

    let groups = this.#groups.filter((group) => {
      if (!normalizedQuery.normalized) {
        return true;
      }

      return normalizedQuery.tokens.every((token) => group.normalizedText.includes(token));
    });

    if (request.category) {
      groups = groups.filter((group) => (
        group.category.toLowerCase() === request.category?.toLowerCase()
        || group.category.toLowerCase().startsWith(request.category?.toLowerCase() ?? '')
      ));
    }

    if (request.brand) {
      groups = groups.filter((group) => group.brand.toLowerCase() === request.brand?.toLowerCase());
    }

    if (request.store) {
      groups = groups.filter((group) => group.visibleStores.includes(request.store!.toLowerCase().replace('-', ' ')));
    }

    if (typeof request.minPrice === 'number') {
      groups = groups.filter((group) => group.bestOverallOffer.priceEgp >= request.minPrice!);
    }

    if (typeof request.maxPrice === 'number') {
      groups = groups.filter((group) => group.bestOverallOffer.priceEgp <= request.maxPrice!);
    }

    const pagedGroups = groups.slice((page - 1) * pageSize, page * pageSize);

    this.#searchLogs.record({
      queryText: request.query,
      normalizedQuery: normalizedQuery.normalized,
      detectedLanguage: normalizedQuery.detectedLanguage,
      filters: {
        category: request.category,
        brand: request.brand,
        store: request.store,
        minPrice: request.minPrice,
        maxPrice: request.maxPrice,
      },
      resultCount: groups.length,
      latencyMs: Date.now() - startedAt,
      createdAt: this.#now().toISOString(),
    });

    return {
      query: request.query,
      detectedLanguage: normalizedQuery.detectedLanguage,
      page,
      pageSize,
      totalResults: groups.length,
      groups: pagedGroups,
    };
  }

  getRankingAudit(): RankingAuditStore {
    return this.#rankingAudit;
  }

  getSourceHealthMetrics(): SourceHealthMetricStore {
    return this.#sourceHealthMetrics;
  }

  getSearchLogs(): SearchLogService {
    return this.#searchLogs;
  }
}

export function createSearchService(options?: ConstructorParameters<typeof SearchService>[0]): SearchService {
  return new SearchService(options);
}