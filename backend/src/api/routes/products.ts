import type {
  FastifyInstance,
  FastifyReply,
} from 'fastify';

import type {
  Offer,
  RankingExplanation,
  RankingReason,
  SearchResultGroup,
  SimilarProductWithOffers,
} from '../../lib/api-types.js';

type ProductParams = {
  productId: string;
};

type ProductOfferParams = ProductParams & {
  offerId: string;
};

type ProductQuery = {
  includeStale?: string;
  limit?: string;
  lang?: 'ar' | 'en';
};

async function getAllGroups(app: FastifyInstance): Promise<SearchResultGroup[]> {
  const pageSize = 200;
  const groups: SearchResultGroup[] = [];
  let page = 1;
  let totalResults = Number.POSITIVE_INFINITY;

  while (groups.length < totalResults) {
    const response = await app.searchService.search({
      query: '',
      page,
      pageSize,
    });

    totalResults = response.totalResults;
    groups.push(...response.groups);

    if (response.groups.length === 0) {
      break;
    }

    page += 1;
  }

  return groups;
}

function computeFreshness(lastUpdatedAtIso: string): Offer['freshness'] {
  const lastUpdatedAt = new Date(lastUpdatedAtIso);
  const ageMs = Date.now() - lastUpdatedAt.getTime();
  const hoursOld = Math.max(0, ageMs / (1000 * 60 * 60));

  return {
    hoursOld: Number(hoursOld.toFixed(1)),
    isStale: hoursOld >= 12,
    lastUpdatedAt,
  };
}

function mapSummaryOffer(
  offer: SearchResultGroup['bestOverallOffer'],
  rankingReason?: RankingReason,
): Offer {
  return {
    id: offer.offerId,
    storeId: offer.store.toLowerCase().replace(/\s+/g, '-'),
    storeName: offer.store,
    price: offer.priceEgp,
    currency: 'EGP',
    availability: offer.availability,
    shippingInfo: {
      available: typeof offer.shippingEgp === 'number',
      cost: offer.shippingEgp ?? undefined,
    },
    freshness: computeFreshness(offer.lastUpdatedAt),
    rankingReason,
    provenance: {
      lastFetchedAt: new Date(offer.lastUpdatedAt),
    },
    matchType: 'exact',
    matchConfidence: 100,
  };
}

function getProductNotFound(reply: FastifyReply) {
  return reply.status(404).send({
    error: 'Product not found',
    code: 'PRODUCT_NOT_FOUND',
  });
}

function getOfferNotFound(reply: FastifyReply) {
  return reply.status(404).send({
    error: 'Offer not found',
    code: 'OFFER_NOT_FOUND',
  });
}

export async function registerProductRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: ProductParams;
    Querystring: ProductQuery;
  }>(
    `${app.appConfig.apiBasePath}/products/:productId`,
    async (request, reply) => {
      const groups = await getAllGroups(app);
      const product = groups.find((group) => group.productId === request.params.productId);

      if (!product) {
        return getProductNotFound(reply);
      }

      const lang = request.query.lang ?? 'en';
      const title = lang === 'ar' && product.canonicalNameArabic
        ? product.canonicalNameArabic
        : product.canonicalName;

      const exactOffers: Offer[] = [
        mapSummaryOffer(product.bestOverallOffer, 'best_overall'),
      ];

      if (product.cheapestOffer && product.cheapestOffer.offerId !== product.bestOverallOffer.offerId) {
        exactOffers.push(mapSummaryOffer(product.cheapestOffer, 'cheapest'));
      }

      const similarProducts = groups
        .filter((group) => (
          group.productId !== product.productId
          && group.category === product.category
          && group.brand === product.brand
        ))
        .slice(0, 6)
        .map((group) => ({
          id: group.productId,
          title: lang === 'ar' && group.canonicalNameArabic ? group.canonicalNameArabic : group.canonicalName,
          brand: group.brand,
          category: group.category,
          matchConfidence: 80,
          matchReason: `Same ${group.brand} in ${group.category}`,
          hasOffers: true,
        }));

      return {
        id: product.productId,
        title,
        category: product.category,
        brand: product.brand,
        images: product.imageUrl ? [product.imageUrl] : [],
        exactOffers,
        similarProducts,
        updatedAt: new Date(product.lastUpdatedAt),
      };
    },
  );

  app.get<{
    Params: ProductParams;
    Querystring: ProductQuery;
  }>(
    `${app.appConfig.apiBasePath}/products/:productId/offers`,
    async (request, reply) => {
      const groups = await getAllGroups(app);
      const product = groups.find((group) => group.productId === request.params.productId);

      if (!product) {
        return getProductNotFound(reply);
      }

      const offers: Array<Offer & { explanation?: RankingExplanation }> = [
        {
          ...mapSummaryOffer(product.bestOverallOffer, 'best_overall'),
          explanation: {
            offerId: product.bestOverallOffer.offerId,
            storeId: product.bestOverallOffer.store.toLowerCase().replace(/\s+/g, '-'),
            storeName: product.bestOverallOffer.store,
            price: product.bestOverallOffer.priceEgp,
            rankingScore: 92,
            rankingReason: 'best_overall',
            factors: [
              {
                name: 'price',
                weight: 0.6,
                value: product.bestOverallOffer.priceEgp,
                contribution: 0.6,
                explanation: 'Balanced total value including shipping and freshness.',
              },
            ],
            freshnessStatus: {
              ...computeFreshness(product.bestOverallOffer.lastUpdatedAt),
              freshnessPenalty: 0,
              freshnessExplanation: 'Offer data is fresh.',
            },
            confidence: 90,
          },
        },
      ];

      if (product.cheapestOffer && product.cheapestOffer.offerId !== product.bestOverallOffer.offerId) {
        offers.push({
          ...mapSummaryOffer(product.cheapestOffer, 'cheapest'),
          explanation: {
            offerId: product.cheapestOffer.offerId,
            storeId: product.cheapestOffer.store.toLowerCase().replace(/\s+/g, '-'),
            storeName: product.cheapestOffer.store,
            price: product.cheapestOffer.priceEgp,
            rankingScore: 88,
            rankingReason: 'cheapest',
            factors: [
              {
                name: 'price',
                weight: 0.8,
                value: product.cheapestOffer.priceEgp,
                contribution: 0.8,
                explanation: 'Lowest available price among visible offers.',
              },
            ],
            freshnessStatus: {
              ...computeFreshness(product.cheapestOffer.lastUpdatedAt),
              freshnessPenalty: 0,
              freshnessExplanation: 'Offer freshness is within SLA.',
            },
            confidence: 85,
          },
        });
      }

      return {
        productId: product.productId,
        offers,
      };
    },
  );

  app.get<{
    Params: ProductParams;
    Querystring: ProductQuery;
  }>(
    `${app.appConfig.apiBasePath}/products/:productId/similar`,
    async (request, reply) => {
      const groups = await getAllGroups(app);
      const product = groups.find((group) => group.productId === request.params.productId);

      if (!product) {
        return getProductNotFound(reply);
      }

      const limit = Number.parseInt(request.query.limit ?? '6', 10);

      const products: SimilarProductWithOffers[] = groups
        .filter((group) => (
          group.productId !== product.productId
          && group.category === product.category
          && group.brand === product.brand
        ))
        .slice(0, Number.isNaN(limit) ? 6 : limit)
        .map((group) => {
          const offers: SimilarProductWithOffers['offers'] = [
            {
              id: group.bestOverallOffer.offerId,
              storeId: group.bestOverallOffer.store.toLowerCase().replace(/\s+/g, '-'),
              storeName: group.bestOverallOffer.store,
              price: group.bestOverallOffer.priceEgp,
              currency: 'EGP',
              availability: group.bestOverallOffer.availability,
              rankingReason: 'best_overall' as const,
            },
          ];

          if (group.cheapestOffer && group.cheapestOffer.offerId !== group.bestOverallOffer.offerId) {
            offers.push({
              id: group.cheapestOffer.offerId,
              storeId: group.cheapestOffer.store.toLowerCase().replace(/\s+/g, '-'),
              storeName: group.cheapestOffer.store,
              price: group.cheapestOffer.priceEgp,
              currency: 'EGP',
              availability: group.cheapestOffer.availability,
              rankingReason: 'cheapest' as const,
            });
          }

          return {
            id: group.productId,
            title: group.canonicalName,
            brand: group.brand,
            category: group.category,
            matchConfidence: 80,
            matchReason: `Same ${group.brand} in ${group.category}`,
            hasOffers: offers.length > 0,
            offers,
          };
        });

      return {
        productId: product.productId,
        products,
      };
    },
  );

  app.get<{
    Params: ProductOfferParams;
  }>(
    `${app.appConfig.apiBasePath}/products/:productId/offers/:offerId/explanation`,
    async (request, reply) => {
      const groups = await getAllGroups(app);
      const product = groups.find((group) => group.productId === request.params.productId);

      if (!product) {
        return getProductNotFound(reply);
      }

      const offer = [product.bestOverallOffer, product.cheapestOffer]
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .find((item) => item.offerId === request.params.offerId);

      if (!offer) {
        return getOfferNotFound(reply);
      }

      const rankingReason: RankingReason =
        offer.offerId === product.bestOverallOffer.offerId ? 'best_overall' : 'cheapest';

      return {
        offerId: offer.offerId,
        storeId: offer.store.toLowerCase().replace(/\s+/g, '-'),
        storeName: offer.store,
        price: offer.priceEgp,
        rankingScore: rankingReason === 'best_overall' ? 92 : 88,
        rankingReason,
        factors: [
          {
            name: 'price',
            weight: rankingReason === 'best_overall' ? 0.6 : 0.8,
            value: offer.priceEgp,
            contribution: rankingReason === 'best_overall' ? 0.6 : 0.8,
            explanation: rankingReason === 'best_overall'
              ? 'Selected for best balance of quality, freshness, and total cost.'
              : 'Selected because it has the lowest visible listed price.',
          },
        ],
        freshnessStatus: {
          ...computeFreshness(offer.lastUpdatedAt),
          freshnessPenalty: 0,
          freshnessExplanation: 'Freshness is within accepted SLA.',
        },
        shippingIssues: [],
        confidence: rankingReason === 'best_overall' ? 90 : 85,
      };
    },
  );
}