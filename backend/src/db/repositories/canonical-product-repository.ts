import { Database } from '../db/client';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  canonicalProductsTable,
  offersTable,
  priceHistoryTable,
  matchingReviewsTable,
} from '../db/schema';

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
    const product = await this.db
      .select()
      .from(canonicalProductsTable)
      .where(eq(canonicalProductsTable.id, productId))
      .then((rows) => rows[0] || null);

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
      title: product.title,
      category: product.category,
      brand: product.brand,
      model: product.model || undefined,
      gtin: product.gtin || undefined,
      description: product.description || undefined,
      images: product.images ? JSON.parse(product.images as string) : [],
      specifications: product.specifications
        ? JSON.parse(product.specifications as string)
        : {},
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
    const mainProduct = await this.db
      .select()
      .from(canonicalProductsTable)
      .where(eq(canonicalProductsTable.id, productId))
      .then((rows) => rows[0]);

    if (!mainProduct) {
      return [];
    }

    // Find similar products based on brand and category
    const similarProducts = await this.db
      .select()
      .from(canonicalProductsTable)
      .where(
        and(
          eq(canonicalProductsTable.category, mainProduct.category),
          eq(canonicalProductsTable.brand, mainProduct.brand)
        )
      )
      .then((rows) => rows.filter((r) => r.id !== productId));

    // Enrich with offer information and match confidence
    const offerRepo = new OfferRepository(this.db);
    const result: SimilarProductDetail[] = [];

    for (const similar of similarProducts) {
      const offers = await offerRepo.getOffersForProduct(similar.id, {
        includeStale: options?.includeStale ?? false,
      });

      // Calculate match confidence based on similarity
      const confidence = this.calculateMatchConfidence(mainProduct, similar);

      result.push({
        id: similar.id,
        title: similar.title,
        brand: similar.brand,
        model: similar.model || undefined,
        category: similar.category,
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
    productA: (typeof canonicalProductsTable.$inferSelect),
    productB: (typeof canonicalProductsTable.$inferSelect)
  ): number {
    let score = 0;

    // Same brand = high confidence
    if (productA.brand === productB.brand) {
      score += 40;
    }

    // Same category = baseline
    if (productA.category === productB.category) {
      score += 20;
    }

    // Same GTIN = very high confidence
    if (productA.gtin && productA.gtin === productB.gtin) {
      score += 35;
    }

    // Model number similarity (if available)
    if (productA.model && productB.model) {
      const modelDistance = this.levenshteinDistance(
        productA.model,
        productB.model
      );
      if (modelDistance <= 2) {
        score += 25;
      }
    }

    // Title similarity
    const titleDistance = this.levenshteinDistance(
      productA.title,
      productB.title
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
    productA: (typeof canonicalProductsTable.$inferSelect),
    productB: (typeof canonicalProductsTable.$inferSelect)
  ): string {
    const reasons: string[] = [];

    if (productA.brand === productB.brand) {
      reasons.push(`Same brand: ${productA.brand}`);
    }

    if (productA.gtin && productA.gtin === productB.gtin) {
      reasons.push('Same GTIN');
    }

    if (productA.model && productB.model && productA.model !== productB.model) {
      reasons.push(
        `Similar model: ${productA.model} ≈ ${productB.model}`
      );
    }

    return reasons.length > 0
      ? reasons.join('; ')
      : `Similar ${productA.category} product`;
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
