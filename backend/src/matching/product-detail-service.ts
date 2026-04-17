import { Database } from '../db/client';
import {
  CanonicalProductRepository,
  ProductWithOffers,
} from '../db/repositories/canonical-product-repository';
import { OfferRepository } from '../db/repositories/offer-repository';

export interface ProductDetailProjection {
  id: string;
  title: string;
  category: string;
  brand: string;
  model?: string;
  gtin?: string;
  description?: string;
  images?: string[];
  specifications?: Record<string, string>;
  exactOffers: Array<{
    id: string;
    storeId: string;
    storeName: string;
    price: number;
    currency: string;
    availability: string;
    shippingInfo?: Record<string, any>;
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
  }>;
  similarProducts: Array<{
    id: string;
    title: string;
    brand: string;
    model?: string;
    category: string;
    matchConfidence: number;
    matchReason: string;
    hasOffers: boolean;
  }>;
  updatedAt: Date;
}

export interface SimilarProductsProjection {
  productId: string;
  products: Array<{
    id: string;
    title: string;
    brand: string;
    model?: string;
    category: string;
    matchConfidence: number;
    matchReason: string;
    offers: Array<{
      id: string;
      storeId: string;
      storeName: string;
      price: number;
      currency: string;
      availability: string;
      rankingReason?: string;
    }>;
  }>;
}

export interface OffersComparisonProjection {
  productId: string;
  offers: Array<{
    id: string;
    storeId: string;
    storeName: string;
    price: number;
    currency: string;
    availability: string;
    shippingInfo?: Record<string, any>;
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
  }>;
}

export class ProductDetailService {
  private productRepo: CanonicalProductRepository;
  private offerRepo: OfferRepository;

  constructor(private db: Database) {
    this.productRepo = new CanonicalProductRepository(db);
    this.offerRepo = new OfferRepository(db);
  }

  /**
   * Get complete product detail projection for shopper view
   * Excludes stale offers by default
   */
  async getProductDetail(
    productId: string,
    options?: {
      includeStale?: boolean;
      lang?: 'ar' | 'en';
    }
  ): Promise<ProductDetailProjection | null> {
    const product = await this.productRepo.getProductDetail(productId, {
      includeStale: options?.includeStale ?? false,
      lang: options?.lang ?? 'en',
    });

    if (!product) {
      return null;
    }

    return this.normalizeProductDetail(product);
  }

  /**
   * Get similar products for a given product
   */
  async getSimilarProducts(
    productId: string,
    options?: {
      includeStale?: boolean;
      limit?: number;
    }
  ): Promise<SimilarProductsProjection | null> {
    const product = await this.productRepo.getProductDetail(productId, {
      includeStale: options?.includeStale ?? false,
    });

    if (!product) {
      return null;
    }

    const similarProducts = product.similarProducts
      .slice(0, options?.limit ?? 10)
      .map((similar) => ({
        id: similar.id,
        title: similar.title,
        brand: similar.brand,
        model: similar.model,
        category: similar.category,
        matchConfidence: similar.matchConfidence,
        matchReason: similar.matchReason,
        offers: [], // Will be populated below
      }));

    // Fetch offers for each similar product
    for (const similar of similarProducts) {
      const offers = await this.offerRepo.getOffersForProduct(similar.id, {
        includeStale: options?.includeStale ?? false,
      });

      similar.offers = offers
        .filter((o) => !o.freshness.isStale)
        .map((o) => ({
          id: o.id,
          storeId: o.storeId,
          storeName: o.storeName,
          price: o.price,
          currency: o.currency,
          availability: o.availability,
          rankingReason: o.rankingReason,
        }));
    }

    return {
      productId,
      products: similarProducts,
    };
  }

  /**
   * Get all offers for a product for comparison view
   */
  async getOfferComparison(
    productId: string,
    options?: {
      includeStale?: boolean;
    }
  ): Promise<OffersComparisonProjection | null> {
    // Verify product exists
    const product = await this.productRepo.getProductDetail(productId, {
      includeStale: true,
    });

    if (!product) {
      return null;
    }

    const offers = await this.offerRepo.getOffersForProduct(productId, {
      includeStale: options?.includeStale ?? false,
    });

    return {
      productId,
      offers: offers.map((o) => ({
        id: o.id,
        storeId: o.storeId,
        storeName: o.storeName,
        price: o.price,
        currency: o.currency,
        availability: o.availability,
        shippingInfo: o.shippingInfo,
        freshness: o.freshness,
        rankingReason: o.rankingReason,
        provenance: o.provenance,
      })),
    };
  }

  /**
   * Normalize product detail for API response
   */
  private normalizeProductDetail(
    product: ProductWithOffers
  ): ProductDetailProjection {
    return {
      id: product.id,
      title: product.title,
      category: product.category,
      brand: product.brand,
      model: product.model,
      gtin: product.gtin,
      description: product.description,
      images: product.images,
      specifications: product.specifications,
      exactOffers: product.exactOffers.map((o) => ({
        id: o.id,
        storeId: o.storeId,
        storeName: o.storeName,
        price: o.price,
        currency: o.currency,
        availability: o.availability,
        shippingInfo: o.shippingInfo,
        freshness: o.freshness,
        rankingReason: o.rankingReason,
        provenance: o.provenance,
      })),
      similarProducts: product.similarProducts.map((p) => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        model: p.model,
        category: p.category,
        matchConfidence: p.matchConfidence,
        matchReason: p.matchReason,
        hasOffers: p.hasOffers,
      })),
      updatedAt: product.updatedAt,
    };
  }
}
