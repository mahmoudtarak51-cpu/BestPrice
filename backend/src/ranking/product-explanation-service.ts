import { Database } from '../db/client';
import { OfferRepository } from '../db/repositories/offer-repository';

export interface RankingExplanation {
  offerId: string;
  storeId: string;
  storeName: string;
  price: number;
  rankingScore: number;
  rankingReason:
    | 'best_overall'
    | 'cheapest'
    | 'trusted_seller'
    | 'fast_shipping'
    | 'good_value';
  factors: RankingFactor[];
  freshnessStatus: FreshnessStatus;
  shippingIssues?: string[];
  confidence: number;
}

export interface RankingFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
}

export interface FreshnessStatus {
  hoursOld: number;
  isStale: boolean;
  lastUpdatedAt: Date;
  freshnessPenalty: number;
  freshnessExplanation: string;
}

export class RankingExplanationService {
  private readonly STALE_THRESHOLD_HOURS = 12;
  private readonly STALE_PENALTY = 50; // Points deducted for stale offers
  private readonly FRESHNESS_BONUS = 10; // Points per hour freshness
  private readonly TRUST_SCORE_WEIGHT = 0.3;
  private readonly PRICE_WEIGHT = 0.4;
  private readonly FRESHNESS_WEIGHT = 0.3;

  constructor(private db: Database, private offerRepo: OfferRepository) {}

  /**
   * Generate detailed ranking explanation for an offer
   */
  async explainOfferRanking(
    offerId: string,
    productId: string
  ): Promise<RankingExplanation | null> {
    const offers = await this.offerRepo.getOffersForProduct(productId, {
      includeStale: true,
    });

    const offer = offers.find((o) => o.id === offerId);
    if (!offer) {
      return null;
    }

    const freshnessStatus = this.calculateFreshnessStatus(offer);
    const factors = this.calculateRankingFactors(
      offer,
      offers,
      freshnessStatus
    );
    const rankingScore = this.calculateRankingScore(factors, freshnessStatus);
    const rankingReason = this.determineRankingReason(
      rankingScore,
      offer,
      offers,
      freshnessStatus
    );
    const shippingIssues = this.identifyShippingIssues(offer);

    return {
      offerId,
      storeId: offer.storeId,
      storeName: offer.storeName,
      price: offer.price,
      rankingScore,
      rankingReason,
      factors,
      freshnessStatus,
      shippingIssues: shippingIssues.length > 0 ? shippingIssues : undefined,
      confidence: this.calculateConfidence(factors),
    };
  }

  /**
   * Calculate freshness status for an offer
   */
  private calculateFreshnessStatus(offer: any): FreshnessStatus {
    const hoursOld = offer.freshness.hoursOld;
    const isStale = hoursOld >= this.STALE_THRESHOLD_HOURS;

    let freshnessExplanation = '';
    let freshnessPenalty = 0;

    if (isStale) {
      freshnessExplanation = `This offer is ${Math.floor(hoursOld)} hours old, exceeding the 12-hour freshness requirement. It will not be shown to shoppers but is retained for admin review.`;
      freshnessPenalty = this.STALE_PENALTY;
    } else {
      const freshRating = this.FRESHNESS_BONUS * (1 - hoursOld / this.STALE_THRESHOLD_HOURS);
      freshnessExplanation = `This offer is ${hoursOld.toFixed(1)} hours old, within the 12-hour freshness window. Fresh data is preferred in ranking.`;
      freshnessPenalty = -Math.round(freshRating);
    }

    return {
      hoursOld,
      isStale,
      lastUpdatedAt: offer.freshness.lastUpdatedAt,
      freshnessPenalty,
      freshnessExplanation,
    };
  }

  /**
   * Calculate individual ranking factors
   */
  private calculateRankingFactors(
    offer: any,
    allOffers: any[],
    freshnessStatus: FreshnessStatus
  ): RankingFactor[] {
    const factors: RankingFactor[] = [];

    // Price factor
    const minPrice = Math.min(...allOffers.map((o) => o.price));
    const maxPrice = Math.max(...allOffers.map((o) => o.price));
    const priceRange = maxPrice - minPrice || 1;
    const priceScore =
      100 * (1 - (offer.price - minPrice) / priceRange);
    const priceContribution = priceScore * this.PRICE_WEIGHT;

    factors.push({
      name: 'Price Competitiveness',
      weight: this.PRICE_WEIGHT,
      value: priceScore,
      contribution: priceContribution,
      explanation: `Price: ${offer.price} EGP (Range: ${minPrice}-${maxPrice} EGP). Lower prices receive higher scores.`,
    });

    // Freshness factor
    const freshnessScore = Math.max(
      0,
      100 - freshnessStatus.freshnessPenalty
    );
    const freshnessContribution = freshnessScore * this.FRESHNESS_WEIGHT;

    factors.push({
      name: 'Data Freshness',
      weight: this.FRESHNESS_WEIGHT,
      value: freshnessScore,
      contribution: freshnessContribution,
      explanation: freshnessStatus.freshnessExplanation,
    });

    // Availability factor
    const availabilityScore =
      offer.availability === 'in_stock' ? 100 : offer.availability === 'limited' ? 50 : 0;
    const availabilityContribution = availabilityScore * 0.2;

    factors.push({
      name: 'Availability',
      weight: 0.2,
      value: availabilityScore,
      contribution: availabilityContribution,
      explanation:
        offer.availability === 'in_stock'
          ? 'Product is in stock'
          : offer.availability === 'limited'
            ? 'Limited stock available'
            : 'Product is out of stock',
    });

    // Shipping factor
    const hasShipping = offer.shippingInfo?.available ?? false;
    const shippingScore = hasShipping ? 100 : 70;
    const shippingContribution = shippingScore * 0.2;

    factors.push({
      name: 'Shipping Information',
      weight: 0.2,
      value: shippingScore,
      contribution: shippingContribution,
      explanation: hasShipping
        ? `Shipping information available (${offer.shippingInfo?.cost || 'Free'} EGP)`
        : 'Shipping information not available, but offer is still considered',
    });

    return factors;
  }

  /**
   * Calculate overall ranking score
   */
  private calculateRankingScore(
    factors: RankingFactor[],
    freshnessStatus: FreshnessStatus
  ): number {
    if (freshnessStatus.isStale) {
      return 0; // Stale offers get zero rank for shoppers
    }

    const score = factors.reduce((sum, factor) => {
      return sum + factor.contribution;
    }, 0);

    return Math.round(score);
  }

  /**
   * Determine the ranking reason (best_overall, cheapest, etc.)
   */
  private determineRankingReason(
    rankingScore: number,
    offer: any,
    allOffers: any[],
    freshnessStatus: FreshnessStatus
  ):
    | 'best_overall'
    | 'cheapest'
    | 'trusted_seller'
    | 'fast_shipping'
    | 'good_value' {
    if (freshnessStatus.isStale) {
      return 'good_value';
    }

    const cheapestOffer = allOffers.reduce((min, o) =>
      o.price < min.price ? o : min
    );
    const bestOffer = allOffers.reduce((best, o) =>
      rankingScore > (best.rankingScore || 0) ? o : best
    );

    if (offer.id === bestOffer.id && rankingScore >= 80) {
      return 'best_overall';
    }

    if (offer.id === cheapestOffer.id) {
      return 'cheapest';
    }

    if ((offer.shippingInfo?.available ?? false) && rankingScore >= 70) {
      return 'fast_shipping';
    }

    return 'good_value';
  }

  /**
   * Identify shipping-related issues
   */
  private identifyShippingIssues(offer: any): string[] {
    const issues: string[] = [];

    if (!offer.shippingInfo || !offer.shippingInfo.available) {
      issues.push(
        'Shipping information not available - contact seller for details'
      );
    } else if (offer.shippingInfo.estimatedDays) {
      if (offer.shippingInfo.estimatedDays > 7) {
        issues.push(
          `Long shipping time: ${offer.shippingInfo.estimatedDays} days`
        );
      }
    }

    if (offer.shippingInfo?.cost && offer.shippingInfo.cost > 50) {
      issues.push(
        `High shipping cost: ${offer.shippingInfo.cost} EGP (check if free shipping is available elsewhere)`
      );
    }

    if (offer.availability !== 'in_stock') {
      issues.push(`Limited availability: ${offer.availability}`);
    }

    return issues;
  }

  /**
   * Calculate confidence score for the ranking
   */
  private calculateConfidence(factors: RankingFactor[]): number {
    // Confidence is based on data completeness and consistency
    let confidence = 100;

    // Deduct points for missing factors
    const minFactors = 4;
    if (factors.length < minFactors) {
      confidence -= (minFactors - factors.length) * 10;
    }

    // Deduct points if any factor score is very low (unreliable data)
    const lowScoreFactors = factors.filter((f) => f.value < 30);
    confidence -= lowScoreFactors.length * 5;

    return Math.max(30, Math.min(100, confidence));
  }

  /**
   * Generate a human-readable ranking summary
   */
  async generateRankingSummary(
    productId: string
  ): Promise<Map<string, RankingExplanation>> {
    const offers = await this.offerRepo.getOffersForProduct(productId, {
      includeStale: false,
    });

    const summaryMap = new Map<string, RankingExplanation>();

    for (const offer of offers) {
      const explanation = await this.explainOfferRanking(offer.id, productId);
      if (explanation) {
        summaryMap.set(offer.id, explanation);
      }
    }

    return summaryMap;
  }
}
