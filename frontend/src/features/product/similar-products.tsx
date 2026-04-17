'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { SimilarProductWithOffers } from '@/lib/types/product';
import { MatchConfidenceBadge } from './match-confidence-badge';

interface SimilarProductsProps {
  similarProducts: SimilarProductWithOffers[];
  lang: 'ar' | 'en';
}

export function SimilarProducts({ similarProducts, lang }: SimilarProductsProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  if (similarProducts.length === 0) {
    return (
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <p className="text-blue-800">
          {lang === 'ar' ? 'لا توجد منتجات مشابهة' : 'No similar products found'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8" data-testid="similar-products">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {lang === 'ar' ? 'منتجات مشابهة' : 'Similar Products'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {similarProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            data-testid="similar-product-card"
          >
            {/* Product Header with Match Info */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 border-b border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{product.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{product.brand}</p>
                </div>
              </div>

              {/* Match Confidence Badge */}
              <MatchConfidenceBadge
                confidence={product.matchConfidence}
                lang={lang}
              />

              {/* Match Reason */}
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-xs text-gray-600 mb-1">
                  {lang === 'ar' ? 'سبب التطابق' : 'Match Reason'}
                </div>
                <p className="text-sm text-gray-900">{product.matchReason}</p>
              </div>
            </div>

            {/* Product Details */}
            <div className="p-4 space-y-3">
              {/* Model if available */}
              {product.model && (
                <div>
                  <div className="text-xs text-gray-600">
                    {lang === 'ar' ? 'الموديل' : 'Model'}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{product.model}</div>
                </div>
              )}

              {/* Category */}
              <div>
                <div className="text-xs text-gray-600">
                  {lang === 'ar' ? 'الفئة' : 'Category'}
                </div>
                <div className="text-sm font-medium text-gray-900">{product.category}</div>
              </div>

              {/* Availability Status */}
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  {lang === 'ar' ? 'الحالة' : 'Status'}
                </div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  product.hasOffers
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {product.hasOffers
                    ? lang === 'ar'
                      ? '✓ متوفرة عروض'
                      : '✓ Offers Available'
                    : lang === 'ar'
                      ? 'لا توجد عروض'
                      : 'No Offers'}
                </div>
              </div>
            </div>

            {/* Offers List */}
            {product.offers.length > 0 && (
              <div
                className="border-t border-gray-200"
              >
                <button
                  onClick={() =>
                    setExpandedProductId(
                      expandedProductId === product.id ? null : product.id
                    )
                  }
                  className="w-full px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800 text-left flex justify-between items-center hover:bg-blue-50 transition-colors"
                >
                  <span>
                    {lang === 'ar' ? 'العروض' : 'Offers'} ({product.offers.length})
                  </span>
                  <span>{expandedProductId === product.id ? '▼' : '▶'}</span>
                </button>

                {/* Expanded Offers List */}
                {expandedProductId === product.id && (
                  <div className="bg-gray-50 px-4 py-3 space-y-2 border-t border-gray-200">
                    {product.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="bg-white p-2 rounded border border-gray-200 text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">
                              {offer.storeName}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {offer.availability === 'in_stock'
                                ? lang === 'ar'
                                  ? 'متوفر'
                                  : 'In Stock'
                                : offer.availability === 'limited'
                                  ? lang === 'ar'
                                    ? 'محدود'
                                    : 'Limited'
                                  : lang === 'ar'
                                    ? 'غير متوفر'
                                    : 'Out of Stock'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">
                              {offer.price.toLocaleString('ar-EG')} EGP
                            </div>
                            {offer.rankingReason && (
                              <div className="text-xs text-blue-600 mt-1">
                                {offer.rankingReason === 'best_overall'
                                  ? lang === 'ar'
                                    ? 'الأفضل'
                                    : 'Best'
                                  : offer.rankingReason === 'cheapest'
                                    ? lang === 'ar'
                                      ? 'الأرخص'
                                      : 'Cheapest'
                                    : lang === 'ar'
                                      ? 'جيدة'
                                      : 'Good'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
              <Link
                href={`/${lang}/products/${product.id}`}
                className="block w-full py-2 px-4 text-center bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
              </Link>

              {/* Buy Links from Available Offers */}
              {product.offers.length > 0 && (
                <div className="text-xs text-center text-gray-600 pt-2">
                  {lang === 'ar'
                    ? `متوفر من ${product.offers.length} متجر`
                    : `Available from ${product.offers.length} store${product.offers.length > 1 ? 's' : ''}`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-2">
            {lang === 'ar' ? 'ماذا تعني المنتجات المشابهة؟' : 'What are Similar Products?'}
          </p>
          <p className="text-blue-800">
            {lang === 'ar'
              ? 'المنتجات المشابهة هي متغيرات أو نماذج مختلفة من نفس الفئة والعلامة التجارية. قد تهتم بها إذا كان المنتج الأصلي غير متوفر.'
              : 'Similar products are different variants or models in the same category and brand. You might be interested in them if the original product is unavailable.'}
          </p>
        </div>
      </div>
    </div>
  );
}
