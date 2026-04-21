import type {
  OffersList,
  ProductDetail,
  RankingReason,
  SimilarProductsList,
} from '../lib/api-types.js';
import type { Database } from '../db/client.js';
import {
  CanonicalProductRepository,
  type ProductWithOffers,
} from '../db/repositories/canonical-product-repository.js';
import { OfferRepository } from '../db/repositories/offer-repository.js';

export type ProductDetailProjection = ProductDetail;
export type SimilarProductsProjection = SimilarProductsList;
export type OffersComparisonProjection = OffersList;

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

    const similarProducts: SimilarProductsProjection['products'] = product.similarProducts
      .slice(0, options?.limit ?? 10)
      .map((similar) => ({
        id: similar.id,
        title: similar.title,
        brand: similar.brand,
        model: similar.model,
        category: similar.category,
        matchConfidence: similar.matchConfidence,
        matchReason: similar.matchReason,
        hasOffers: similar.hasOffers,
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
        rankingReason: o.rankingReason as RankingReason | undefined,
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
        rankingReason: o.rankingReason as RankingReason | undefined,
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
