'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { productClient } from '@/lib/api/product-client';
import type { ProductDetail, OffersList, SimilarProductsList } from '@/lib/types/product';
import { ProductSummary } from './product-summary';
import { ProductOffers } from './product-offers';
import { SimilarProducts } from './similar-products';
import { ErrorBoundary } from '@/components/error-boundary';

interface ProductPageContentProps {
  productId: string;
  lang: 'ar' | 'en';
  searchParams?: Record<string, string>;
}

export function ProductPageContent({
  productId,
  lang,
  searchParams = {},
}: ProductPageContentProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [offers, setOffers] = useState<OffersList | null>(null);
  const [similarProducts, setSimilarProducts] = useState<SimilarProductsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exact' | 'similar'>('exact');
  const [showStaleOffers, setShowStaleOffers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch product details, offers, and similar products in parallel
        const [productData, offersData, similarData] = await Promise.all([
          productClient.getProductDetail(productId, { lang, includeStale: showStaleOffers }),
          productClient.getOffers(productId, { includeStale: showStaleOffers }),
          productClient.getSimilarProducts(productId, { includeStale: showStaleOffers }),
        ]);

        setProduct(productData);
        setOffers(offersData);
        setSimilarProducts(similarData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId, lang, showStaleOffers]);

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorBoundary>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900">
              {lang === 'ar' ? 'حدث خطأ' : 'Error'}
            </h2>
            <p className="text-red-700">
              {error || (lang === 'ar' ? 'لم يتم العثور على المنتج' : 'Product not found')}
            </p>
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        {/* Product Summary Section */}
        <ProductSummary product={product} lang={lang} />

        {/* Stale Offers Toggle */}
        <div className="mt-8 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStaleOffers}
              onChange={(e) => setShowStaleOffers(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">
              {lang === 'ar' ? 'عرض العروض القديمة' : 'Show stale offers'}
            </span>
          </label>
        </div>

        {/* Tabs for Exact vs Similar */}
        <div className="mt-8 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('exact')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'exact'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              data-testid="tab-exact"
              aria-selected={activeTab === 'exact'}
            >
              {lang === 'ar' ? 'العروض المطابقة' : 'Exact Offers'} ({product.exactOffers.length})
            </button>
            <button
              onClick={() => setActiveTab('similar')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'similar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              data-testid="tab-similar"
              aria-selected={activeTab === 'similar'}
            >
              {lang === 'ar' ? 'منتجات مشابهة' : 'Similar Products'} ({product.similarProducts.length})
            </button>
          </div>
        </div>

        {/* Content Sections */}
        {activeTab === 'exact' && offers && (
          <Suspense fallback={<OffersSkeleton />}>
            <ProductOffers
              offers={offers.offers}
              productId={productId}
              lang={lang}
              data-testid="exact-offers"
            />
          </Suspense>
        )}

        {activeTab === 'similar' && similarProducts && (
          <Suspense fallback={<SimilarProductsSkeleton />}>
            <SimilarProducts
              similarProducts={similarProducts.products}
              lang={lang}
              data-testid="similar-products"
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Image skeleton */}
        <div className="bg-gray-200 rounded-lg aspect-square animate-pulse" />

        {/* Info skeleton */}
        <div className="col-span-2 space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Offers skeleton */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 space-y-3 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OffersSkeleton() {
  return (
    <div className="mt-8 space-y-4" data-testid="offers-skeleton">
      {[1, 2].map((i) => (
        <div key={i} className="bg-gray-100 rounded-lg p-4 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function SimilarProductsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-100 rounded-lg p-4 space-y-3 animate-pulse">
          <div className="h-40 bg-gray-200 rounded w-full" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
