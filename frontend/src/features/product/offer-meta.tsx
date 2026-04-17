'use client';

import React from 'react';
import type { Offer } from '@/lib/types/product';

interface OfferMetaProps {
  offer: Offer;
  lang: 'ar' | 'en';
  showDetails?: boolean;
}

export function OfferMeta({ offer, lang, showDetails = true }: OfferMetaProps) {
  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return '✓';
      case 'limited':
        return '⚠';
      case 'out_of_stock':
        return '✗';
      default:
        return '?';
    }
  };

  const getAvailabilityLabel = (availability: string) => {
    if (lang === 'ar') {
      return availability === 'in_stock'
        ? 'متوفر'
        : availability === 'limited'
          ? 'محدود'
          : 'غير متوفر';
    }
    return availability === 'in_stock'
      ? 'In Stock'
      : availability === 'limited'
        ? 'Limited'
        : 'Out of Stock';
  };

  const getFreshnessIcon = (hoursOld: number) => {
    if (hoursOld < 1) return '🟢';
    if (hoursOld < 6) return '🟡';
    if (hoursOld < 12) return '🟠';
    return '🔴';
  };

  const getFreshnessLabel = (hoursOld: number, isStale: boolean) => {
    if (lang === 'ar') {
      if (isStale) return `قديم جداً (${Math.floor(hoursOld)}+ ساعة)`;
      if (hoursOld < 1) return 'للتو';
      if (hoursOld < 6) return `منذ ${Math.floor(hoursOld)} ساعة`;
      if (hoursOld < 12) return `منذ ${Math.floor(hoursOld)} ساعة`;
      return `منذ ${hoursOld.toFixed(1)} ساعات`;
    }

    if (isStale) return `Very stale (${Math.floor(hoursOld)}+ hours)`;
    if (hoursOld < 1) return 'Just now';
    if (hoursOld < 6) return `${Math.floor(hoursOld)}h ago`;
    if (hoursOld < 12) return `${Math.floor(hoursOld)}h ago`;
    return `${hoursOld.toFixed(1)}h ago`;
  };

  return (
    <div className="space-y-4" data-testid="offer-meta">
      {/* Availability Section */}
      <div className="bg-gray-50 rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">
            {lang === 'ar' ? 'التوفر' : 'Availability'}
          </span>
          <span className="text-lg">{getAvailabilityIcon(offer.availability)}</span>
        </div>
        <div className={`text-sm font-semibold ${
          offer.availability === 'in_stock'
            ? 'text-green-600'
            : offer.availability === 'limited'
              ? 'text-yellow-600'
              : 'text-red-600'
        }`}>
          {getAvailabilityLabel(offer.availability)}
        </div>
      </div>

      {/* Freshness Section */}
      <div
        className={`${
          offer.freshness.isStale ? 'bg-red-50' : 'bg-green-50'
        } rounded p-3 border ${
          offer.freshness.isStale ? 'border-red-200' : 'border-green-200'
        }`}
        data-testid="freshness-indicator"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">
            {lang === 'ar' ? 'تحديث البيانات' : 'Data Freshness'}
          </span>
          <span className="text-lg">{getFreshnessIcon(offer.freshness.hoursOld)}</span>
        </div>
        <div
          className={`text-sm font-semibold ${
            offer.freshness.isStale ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {getFreshnessLabel(offer.freshness.hoursOld, offer.freshness.isStale)}
        </div>
        {showDetails && (
          <div className="text-xs text-gray-600 mt-2">
            {lang === 'ar'
              ? `آخر تحديث: ${new Date(offer.freshness.lastUpdatedAt).toLocaleString('ar-EG')}`
              : `Last updated: ${new Date(offer.freshness.lastUpdatedAt).toLocaleString('en-US')}`}
          </div>
        )}
        {offer.freshness.isStale && (
          <div className="text-xs text-red-700 mt-2 font-medium">
            {lang === 'ar'
              ? '⚠️ هذا العرض قديم ولن يظهر للمتسوقين'
              : '⚠️ This offer is stale and hidden from shoppers'}
          </div>
        )}
      </div>

      {/* Shipping Section */}
      {showDetails && offer.shippingInfo && (
        <div className="bg-blue-50 rounded p-3 border border-blue-200">
          <div className="text-xs font-medium text-gray-600 mb-2">
            {lang === 'ar' ? 'معلومات الشحن' : 'Shipping Info'}
          </div>
          {offer.shippingInfo.available ? (
            <div>
              <div className="text-sm font-semibold text-blue-600 mb-1">
                {lang === 'ar' ? '✓ الشحن متاح' : '✓ Shipping Available'}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                {offer.shippingInfo.cost !== undefined && (
                  <div>
                    {lang === 'ar'
                      ? `التكلفة: ${offer.shippingInfo.cost === 0 ? 'مجاني' : offer.shippingInfo.cost + ' EGP'}`
                      : `Cost: ${offer.shippingInfo.cost === 0 ? 'Free' : offer.shippingInfo.cost + ' EGP'}`}
                  </div>
                )}
                {offer.shippingInfo.estimatedDays && (
                  <div>
                    {lang === 'ar'
                      ? `المدة المتوقعة: ${offer.shippingInfo.estimatedDays} أيام`
                      : `Estimated: ${offer.shippingInfo.estimatedDays} days`}
                  </div>
                )}
                {offer.shippingInfo.message && (
                  <div className="italic">{offer.shippingInfo.message}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              {lang === 'ar'
                ? '✗ معلومات الشحن غير متاحة - تواصل مع المتجر'
                : '✗ Shipping information not available - contact store'}
            </div>
          )}
        </div>
      )}

      {/* Provenance Section */}
      {showDetails && offer.provenance?.sourceUrl && (
        <div className="bg-purple-50 rounded p-3 border border-purple-200">
          <div className="text-xs font-medium text-gray-600 mb-2">
            {lang === 'ar' ? 'مصدر البيانات' : 'Source'}
          </div>
          <a
            href={offer.provenance.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-600 hover:text-purple-800 hover:underline break-all"
            data-testid="provenance-link"
          >
            {lang === 'ar' ? '🔗 عرض في المتجر' : '🔗 View on Store'}
          </a>
          <div className="text-xs text-gray-600 mt-2">
            {lang === 'ar'
              ? `آخر جلب: ${new Date(offer.provenance.lastFetchedAt).toLocaleString('ar-EG')}`
              : `Last fetched: ${new Date(offer.provenance.lastFetchedAt).toLocaleString('en-US')}`}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProductSummaryMetaProps {
  storeName: string;
  category: string;
  brand: string;
  offersCount: number;
  lang: 'ar' | 'en';
}

export function ProductSummaryMeta({
  storeName,
  category,
  brand,
  offersCount,
  lang,
}: ProductSummaryMetaProps) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-gray-600" data-testid="product-summary">
      <div className="flex items-center gap-1">
        <span>🏪</span>
        <span>{storeName}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>📦</span>
        <span>{category}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>🏷️</span>
        <span>{brand}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>💰</span>
        <span>
          {lang === 'ar'
            ? `${offersCount} عروض`
            : `${offersCount} offer${offersCount !== 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  );
}
