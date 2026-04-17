import {
  ProductDetail,
  OffersList,
  SimilarProductsList,
  RankingExplanation,
} from './types/product';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

class ProductClient {
  /**
   * Get product detail with all offers and similar products
   */
  async getProductDetail(
    productId: string,
    options?: {
      lang?: 'ar' | 'en';
      includeStale?: boolean;
    }
  ): Promise<ProductDetail> {
    const params = new URLSearchParams();
    if (options?.lang) {
      params.append('lang', options.lang);
    }
    if (options?.includeStale) {
      params.append('includeStale', 'true');
    }

    const url = `${API_BASE_URL}/products/${productId}${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Product not found');
      }
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    return response.json() as Promise<ProductDetail>;
  }

  /**
   * Get all offers for a product with ranking details
   */
  async getOffers(
    productId: string,
    options?: {
      exactMatch?: boolean;
      includeStale?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<OffersList> {
    const params = new URLSearchParams();
    if (options?.exactMatch !== undefined) {
      params.append('exactMatch', String(options.exactMatch));
    }
    if (options?.includeStale) {
      params.append('includeStale', 'true');
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }

    const url = `${API_BASE_URL}/products/${productId}/offers${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Product not found');
      }
      throw new Error(`Failed to fetch offers: ${response.statusText}`);
    }

    return response.json() as Promise<OffersList>;
  }

  /**
   * Get similar products for a given product
   */
  async getSimilarProducts(
    productId: string,
    options?: {
      limit?: number;
      includeStale?: boolean;
    }
  ): Promise<SimilarProductsList> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.includeStale) {
      params.append('includeStale', 'true');
    }

    const url = `${API_BASE_URL}/products/${productId}/similar${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Product not found');
      }
      throw new Error(`Failed to fetch similar products: ${response.statusText}`);
    }

    return response.json() as Promise<SimilarProductsList>;
  }

  /**
   * Get detailed ranking explanation for an offer
   */
  async getOfferExplanation(
    productId: string,
    offerId: string
  ): Promise<RankingExplanation> {
    const url = `${API_BASE_URL}/products/${productId}/offers/${offerId}/explanation`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Offer not found');
      }
      throw new Error(`Failed to fetch offer explanation: ${response.statusText}`);
    }

    return response.json() as Promise<RankingExplanation>;
  }

  /**
   * Batch fetch product details
   */
  async getProductDetailsBatch(
    productIds: string[],
    options?: {
      lang?: 'ar' | 'en';
    }
  ): Promise<Map<string, ProductDetail | null>> {
    const results = new Map<string, ProductDetail | null>();

    const promises = productIds.map((id) =>
      this.getProductDetail(id, options)
        .then((product) => {
          results.set(id, product);
        })
        .catch(() => {
          results.set(id, null);
        })
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get product with preloaded offers comparison
   */
  async getProductWithComparison(
    productId: string,
    options?: {
      lang?: 'ar' | 'en';
    }
  ): Promise<ProductDetail & { offersComparison: OffersList }> {
    const [product, offers] = await Promise.all([
      this.getProductDetail(productId, options),
      this.getOffers(productId),
    ]);

    return {
      ...product,
      offersComparison: offers,
    };
  }
}

// Export singleton instance
export const productClient = new ProductClient();

// Export for testing/dependency injection
export default ProductClient;
