import type { Database } from '../client.js';
import { and, eq } from 'drizzle-orm';
import { canonicalProducts } from '../schema.js';
import { OfferRepository } from './offer-repository.js';

export interface CanonicalProductDetail {
  id: string;
  title: string;
  category: string;
  brand: string;
  model?: string;
  gtin?: string;
  description?: string;
  images?: string[];
  specifications?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithOffers extends CanonicalProductDetail {
  exactOffers: OfferDetail[];
  similarProducts: SimilarProductDetail[];
}

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

export interface SimilarProductDetail {
  id: string;
  title: string;
  brand: string;
  model?: string;
  category: string;
  matchConfidence: number;
  matchReason: string;
  hasOffers: boolean;
}

export class CanonicalProductRepository {
  constructor(private db: Database) {}

  /**
   * Get product detail by ID with all related offers and similar products
   */
  async getProductDetail(
    productId: string,
    options?: {
      includeStale?: boolean;
      lang?: 'ar' | 'en';
    }
  ): Promise<ProductWithOffers | null> {
    const productRows = await this.db
      .select()
      .from(canonicalProducts)
      .where(eq(canonicalProducts.id, productId));
    const product = productRows[0] ?? null;

    if (!product) {
      return null;
    }

    // Get exact offers
    const offerRepo = new OfferRepository(this.db);
    const exactOffers = await offerRepo.getOffersForProduct(productId, {
      includeStale: options?.includeStale ?? false,
      matchType: 'exact',
    });

    // Get similar products with their offers
    const similarProducts = await this.getSimilarProducts(productId, {
      includeStale: options?.includeStale ?? false,
    });

    return {
      id: product.id,
      title: product.canonicalNameEn,
      category: product.categoryId,
      brand: product.brandId,
      model: product.modelNumber || undefined,
      gtin: product.gtin || undefined,
      description: undefined,
      images: product.imageUrl ? [product.imageUrl] : [],
      specifications: (product.specsJson as Record<string, string>) ?? {},
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      exactOffers,
      similarProducts,
    };
  }

  /**
   * Get similar products for a given canonical product
   */
  async getSimilarProducts(
    productId: string,
    options?: {
      includeStale?: boolean;
    }
  ): Promise<SimilarProductDetail[]> {
    const mainProductRows = await this.db
      .select()
      .from(canonicalProducts)
      .where(eq(canonicalProducts.id, productId));
    const mainProduct = mainProductRows[0];

    if (!mainProduct) {
      return [];
    }

    // Find similar products based on brand and category
    const similarProducts = await this.db
      .select()
      .from(canonicalProducts)
      .where(
        and(
          eq(canonicalProducts.categoryId, mainProduct.categoryId),
          eq(canonicalProducts.brandId, mainProduct.brandId)
        )
      );
    const filteredSimilarProducts = similarProducts.filter((row) => row.id !== productId);

    // Enrich with offer information and match confidence
    const offerRepo = new OfferRepository(this.db);
    const result: SimilarProductDetail[] = [];

    for (const similar of filteredSimilarProducts) {
      const offers = await offerRepo.getOffersForProduct(similar.id, {
        includeStale: options?.includeStale ?? false,
      });

      // Calculate match confidence based on similarity
      const confidence = this.calculateMatchConfidence(mainProduct, similar);

      result.push({
        id: similar.id,
        title: similar.canonicalNameEn,
        brand: similar.brandId,
        model: similar.modelNumber || undefined,
        category: similar.categoryId,
        matchConfidence: confidence,
        matchReason: this.getMatchReason(mainProduct, similar),
        hasOffers: offers.length > 0,
      });
    }

    return result.sort((a, b) => b.matchConfidence - a.matchConfidence);
  }

  /**
   * Calculate match confidence between two products
   */
  private calculateMatchConfidence(
    productA: (typeof canonicalProducts.$inferSelect),
    productB: (typeof canonicalProducts.$inferSelect)
  ): number {
    let score = 0;

    // Same brand = high confidence
    if (productA.brandId === productB.brandId) {
      score += 40;
    }

    // Same category = baseline
    if (productA.categoryId === productB.categoryId) {
      score += 20;
    }

    // Same GTIN = very high confidence
    if (productA.gtin && productA.gtin === productB.gtin) {
      score += 35;
    }

    // Model number similarity (if available)
    if (productA.modelNumber && productB.modelNumber) {
      const modelDistance = this.levenshteinDistance(
        productA.modelNumber,
        productB.modelNumber
      );
      if (modelDistance <= 2) {
        score += 25;
      }
    }

    // Title similarity
    const titleDistance = this.levenshteinDistance(
      productA.canonicalNameEn,
      productB.canonicalNameEn
    );
    if (titleDistance <= 5) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Get human-readable match reason
   */
  private getMatchReason(
    productA: (typeof canonicalProducts.$inferSelect),
    productB: (typeof canonicalProducts.$inferSelect)
  ): string {
    const reasons: string[] = [];

    if (productA.brandId === productB.brandId) {
      reasons.push('Same brand');
    }

    if (productA.gtin && productA.gtin === productB.gtin) {
      reasons.push('Same GTIN');
    }

    if (
      productA.modelNumber
      && productB.modelNumber
      && productA.modelNumber !== productB.modelNumber
    ) {
      reasons.push(
        `Similar model: ${productA.modelNumber} ≈ ${productB.modelNumber}`
      );
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : 'Similar product';
  }

  /**
   * Simple Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
