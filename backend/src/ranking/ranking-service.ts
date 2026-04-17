import { buildFreshnessSnapshot } from './freshness-policy.js';

export type RankableOffer = {
  offerId: string;
  storeId: string;
  storeName: string;
  priceEgp: number;
  shippingEgp: number | null;
  availabilityStatus: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown';
  matchConfidence: number;
  trustScore: number;
  lastSuccessfulUpdateAt: string;
  buyUrl: string;
};

export type RankedOffer = RankableOffer & {
  landedPriceEgp: number;
  rankingScore: number;
  shopperVisible: boolean;
  staleAfterAt: string;
  reasonCodes: string[];
};

export type RankingResult = {
  offers: RankedOffer[];
  bestOverallOffer: RankedOffer;
  cheapestOffer: RankedOffer | null;
};

function availabilityBoost(status: RankableOffer['availabilityStatus']): number {
  if (status === 'in_stock') {
    return 8;
  }

  if (status === 'limited') {
    return 4;
  }

  if (status === 'unknown') {
    return 1;
  }

  return -20;
}

export function rankOffers(
  offers: RankableOffer[],
  options?: { now?: Date },
): RankingResult {
  const now = options?.now ?? new Date();
  const rankedOffers = offers.map((offer) => {
    const freshness = buildFreshnessSnapshot({
      lastSuccessfulUpdateAt: offer.lastSuccessfulUpdateAt,
      now,
    });
    const landedPriceEgp = offer.priceEgp + Math.max(offer.shippingEgp ?? 0, 0);
    const freshnessHours = Math.max(
      0,
      (now.getTime() - new Date(offer.lastSuccessfulUpdateAt).getTime())
        / (60 * 60 * 1000),
    );
    const rankingScore = Number((
      offer.matchConfidence * 40
      + (offer.trustScore / 100) * 20
      + availabilityBoost(offer.availabilityStatus)
      + (freshness.shopperVisible ? 12 : -50)
      - landedPriceEgp / 2500
      - freshnessHours
    ).toFixed(4));

    const reasonCodes = [
      offer.matchConfidence >= 0.95 ? 'exact_match' : 'confidence_adjusted',
      offer.shippingEgp && offer.shippingEgp > 0 ? 'shipping_cost_considered' : 'free_shipping',
      freshness.shopperVisible ? 'fresh_offer' : 'stale_hidden',
      offer.trustScore >= 90 ? 'high_trust_store' : 'trusted_store',
    ];

    return {
      ...offer,
      landedPriceEgp,
      rankingScore,
      shopperVisible: freshness.shopperVisible,
      staleAfterAt: freshness.staleAfterAt,
      reasonCodes,
    };
  });

  const visibleOffers = rankedOffers.filter((offer) => offer.shopperVisible);
  const orderedForBest = [...visibleOffers].sort((left, right) => (
    right.rankingScore - left.rankingScore
    || left.landedPriceEgp - right.landedPriceEgp
  ));
  const orderedForCheapest = [...visibleOffers].sort((left, right) => (
    left.landedPriceEgp - right.landedPriceEgp
    || right.rankingScore - left.rankingScore
  ));

  return {
    offers: rankedOffers,
    bestOverallOffer: orderedForBest[0] ?? rankedOffers[0]!,
    cheapestOffer: orderedForCheapest[0] ?? null,
  };
}