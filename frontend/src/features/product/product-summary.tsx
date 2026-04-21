'use client';

import React from 'react';
import Image from 'next/image';
import type { ProductDetail } from '@/lib/types/product';

interface ProductSummaryProps {
  product: ProductDetail;
  lang: 'ar' | 'en';
}

export function ProductSummary({ product, lang }: ProductSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Product Images */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={product.title}
              width={800}
              height={800}
              unoptimized
              sizes="(max-width: 768px) 100vw, 33vw"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-400 text-center">
              <div className="text-4xl mb-2">📷</div>
              <div className="text-sm">{lang === 'ar' ? 'لا توجد صور' : 'No Image'}</div>
            </div>
          )}
        </div>

        {/* Image Thumbnails */}
        {product.images && product.images.length > 1 && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {product.images.slice(1, 5).map((image, index) => (
              <button
                key={index}
                className="aspect-square rounded border border-gray-200 overflow-hidden hover:border-blue-400 transition-colors"
                onClick={() => {
                  // Image gallery functionality would go here
                }}
              >
                <Image
                  src={image}
                  alt={`${product.title} ${index + 2}`}
                  width={200}
                  height={200}
                  unoptimized
                  sizes="(max-width: 768px) 25vw, 10vw"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="col-span-2">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600 mb-4">
          <a href={`/${lang}`} className="text-blue-600 hover:underline">
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </a>
          <span className="mx-2">/</span>
          <a href={`/${lang}/search?category=${product.category}`} className="text-blue-600 hover:underline">
            {product.category}
          </a>
          <span className="mx-2">/</span>
          <span className="text-gray-900 font-medium">{product.title}</span>
        </div>

        {/* Title and Meta */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>

        {/* Brand and Model */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">{lang === 'ar' ? 'العلامة التجارية' : 'Brand'}</div>
            <div className="font-semibold text-gray-900">{product.brand}</div>
          </div>

          {product.model && (
            <div>
              <div className="text-sm text-gray-600">{lang === 'ar' ? 'الموديل' : 'Model'}</div>
              <div className="font-semibold text-gray-900">{product.model}</div>
            </div>
          )}

          {product.gtin && (
            <div>
              <div className="text-sm text-gray-600">{lang === 'ar' ? 'GTIN' : 'GTIN'}</div>
              <div className="font-mono text-sm text-gray-900">{product.gtin}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-600">{lang === 'ar' ? 'الفئة' : 'Category'}</div>
            <div className="font-semibold text-gray-900">{product.category}</div>
          </div>
        </div>

        {/* Price Range */}
        {product.exactOffers.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-200">
            <div className="text-sm text-gray-600 mb-2">
              {lang === 'ar' ? 'نطاق السعر' : 'Price Range'}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-blue-600">
                {Math.min(...product.exactOffers.map((o) => o.price)).toLocaleString('ar-EG')}
              </div>
              {Math.min(...product.exactOffers.map((o) => o.price)) !==
                Math.max(...product.exactOffers.map((o) => o.price)) && (
                <>
                  <span className="text-gray-600">-</span>
                  <div className="text-3xl font-bold text-blue-600">
                    {Math.max(...product.exactOffers.map((o) => o.price)).toLocaleString('ar-EG')}
                  </div>
                </>
              )}
              <span className="text-lg font-semibold text-gray-600">EGP</span>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {lang === 'ar'
                ? `من ${product.exactOffers.length} متجر`
                : `From ${product.exactOffers.length} stores`}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {lang === 'ar' ? 'الوصف' : 'Description'}
            </h2>
            <p className="text-gray-700 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {lang === 'ar' ? 'المواصفات' : 'Specifications'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-900">{key}</span>
                  <span className="text-gray-600">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
          {lang === 'ar'
            ? `آخر تحديث: ${new Date(product.updatedAt).toLocaleDateString('ar-EG')}`
            : `Last updated: ${new Date(product.updatedAt).toLocaleDateString('en-US')}`}
        </div>
      </div>
    </div>
  );
}
