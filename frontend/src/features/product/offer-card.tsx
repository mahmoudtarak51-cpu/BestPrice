'use client';

import React, { useState } from 'react';
import type { OfferWithExplanation } from '@/lib/types/product';

interface OfferCardProps {
  offer: OfferWithExplanation;
  isBestOverall?: boolean;
  isCheapest?: boolean;
  isSelected?: boolean;
  onExpandExplanation?: (offerId: string) => void;
  lang: 'ar' | 'en';
}

export function OfferCard({
  offer,
  isBestOverall = false,
  isCheapest = false,
  isSelected = false,
  onExpandExplanation,
  lang,
}: OfferCardProps) {
  const [showRankingDetails, setShowRankingDetails] = useState(false);

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return 'text-green-600';
      case 'limited':
        return 'text-yellow-600';
      case 'out_of_stock':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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

  const freshnessColor = offer.freshness.isStale ? 'text-red-600' : 'text-green-600';
  const freshnessLabel = offer.freshness.isStale
    ? lang === 'ar'
      ? 'قديم'
      : 'Stale'
    : lang === 'ar'
      ? 'طازج'
      : 'Fresh';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
      data-testid="offer-card"
    >
      {/* Header with store info */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{offer.storeName}</h3>
          {offer.provenance?.sourceUrl && (
            <a
              href={offer.provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
              data-testid="provenance-link"
            >
              {lang === 'ar' ? 'زيارة المتجر' : 'Visit Store'}
            </a>
          )}
        </div>

        {/* Freshness badge */}
        <div className={`text-center text-xs font-medium ${freshnessColor}`} data-testid="freshness-indicator">
          <div>{freshnessLabel}</div>
          <div className="text-xs">{offer.freshness.hoursOld.toFixed(1)}h</div>
        </div>
      </div>

      {/* Price - prominently displayed */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-gray-600">
          {lang === 'ar' ? 'السعر' : 'Price'}
        </div>
        <div className="text-2xl font-bold text-blue-600">
          {offer.price.toLocaleString('ar-EG')} {offer.currency}
        </div>
      </div>

      {/* Availability */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-600 mb-1">
            {lang === 'ar' ? 'التوفر' : 'Availability'}
          </div>
          <div className={`font-medium ${getAvailabilityColor(offer.availability)}`}>
            {getAvailabilityLabel(offer.availability)}
          </div>
        </div>

        {/* Shipping Info */}
        <div data-testid="shipping-info">
          <div className="text-xs text-gray-600 mb-1">
            {lang === 'ar' ? 'الشحن' : 'Shipping'}
          </div>
          <div className="text-sm font-medium text-gray-900">
            {offer.shippingInfo?.available
              ? `${offer.shippingInfo.cost ? `${offer.shippingInfo.cost} EGP` : lang === 'ar' ? 'مجاني' : 'Free'}`
              : lang === 'ar'
                ? 'غير متاح'
                : 'N/A'}
          </div>
          {offer.shippingInfo?.estimatedDays && (
            <div className="text-xs text-gray-600">
              {lang === 'ar'
                ? `${offer.shippingInfo.estimatedDays} أيام`
                : `${offer.shippingInfo.estimatedDays} days`}
            </div>
          )}
        </div>
      </div>

      {/* Ranking Info */}
      {offer.rankingReason && (
        <div className="mb-4 p-2 bg-gray-50 rounded text-sm">
          <div className="text-xs text-gray-600 mb-1">
            {lang === 'ar' ? 'السبب' : 'Ranking Reason'}
          </div>
          <div className="font-medium text-gray-900">
            {offer.rankingReason === 'best_overall'
              ? lang === 'ar'
                ? 'الخيار الأفضل'
                : 'Best Overall Choice'
              : offer.rankingReason === 'cheapest'
                ? lang === 'ar'
                  ? 'الأرخص'
                  : 'Cheapest Option'
                : offer.rankingReason === 'trusted_seller'
                  ? lang === 'ar'
                    ? 'بائع موثوق'
                    : 'Trusted Seller'
                  : offer.rankingReason === 'fast_shipping'
                    ? lang === 'ar'
                      ? 'شحن سريع'
                      : 'Fast Shipping'
                    : lang === 'ar'
                      ? 'قيمة جيدة'
                      : 'Good Value'}
          </div>
        </div>
      )}

      {/* Expand Ranking Details */}
      {offer.explanation && (
        <button
          onClick={() => {
            setShowRankingDetails(!showRankingDetails);
            onExpandExplanation?.(offer.id);
          }}
          className="w-full text-center py-2 text-sm text-blue-600 hover:text-blue-800 font-medium border-t border-gray-200 mt-4"
        >
          {showRankingDetails || isSelected
            ? lang === 'ar'
              ? '▼ إخفاء التفاصيل'
              : '▼ Hide Details'
            : lang === 'ar'
              ? '▶ عرض التفاصيل'
              : '▶ Show Details'}
        </button>
      )}

      {/* Ranking Details (Collapsible) */}
      {offer.explanation && (showRankingDetails || isSelected) && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">
              {lang === 'ar' ? 'درجة الترتيب' : 'Ranking Score'}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${offer.explanation.rankingScore}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-900">
                {offer.explanation.rankingScore}/100
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {lang === 'ar'
                ? `الثقة: ${offer.explanation.confidence}%`
                : `Confidence: ${offer.explanation.confidence}%`}
            </div>
          </div>

          {/* Ranking Factors */}
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-2">
              {lang === 'ar' ? 'عوامل الترتيب' : 'Ranking Factors'}
            </div>
            <div className="space-y-2">
              {offer.explanation.factors.map((factor, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-medium text-gray-900">{factor.name}</div>
                    <div className="text-xs text-gray-600">{factor.explanation}</div>
                  </div>
                  <div className="text-xs font-bold text-gray-900 ml-2">
                    +{Math.round(factor.contribution)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA Button */}
      <a
        href={offer.provenance?.sourceUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg text-center hover:bg-blue-700 transition-colors"
      >
        {lang === 'ar' ? 'عرض على المتجر' : 'View on Store'}
      </a>
    </div>
  );
}
