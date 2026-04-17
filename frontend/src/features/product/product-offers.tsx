'use client';

import React, { useState } from 'react';
import type { OfferWithExplanation } from '@/lib/types/product';
import { OfferCard } from './offer-card';

interface ProductOffersProps {
  offers: OfferWithExplanation[];
  productId: string;
  lang: 'ar' | 'en';
}

export function ProductOffers({ offers, productId, lang }: ProductOffersProps) {
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);

  if (offers.length === 0) {
    return (
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">
          {lang === 'ar'
            ? 'لا توجد عروض متاحة حالياً'
            : 'No offers available at this time'}
        </p>
      </div>
    );
  }

  // Separate best overall and cheapest offers
  const bestOverallOffer = offers.find((o) => o.rankingReason === 'best_overall');
  const cheapestOffer = offers.find((o) => o.rankingReason === 'cheapest');
  const otherOffers = offers.filter(
    (o) => o.id !== bestOverallOffer?.id && o.id !== cheapestOffer?.id
  );

  return (
    <div className="mt-8 space-y-6" data-testid="exact-offers">
      {/* Best Overall Offer - Featured */}
      {bestOverallOffer && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded-full">
              {lang === 'ar' ? '⭐ الأفضل' : '⭐ Best Overall'}
            </span>
            {bestOverallOffer.explanation && (
              <div className="text-sm text-gray-600">
                {lang === 'ar'
                  ? `ثقة: ${bestOverallOffer.explanation.confidence}%`
                  : `Confidence: ${bestOverallOffer.explanation.confidence}%`}
              </div>
            )}
          </div>
          <OfferCard
            offer={bestOverallOffer}
            isBestOverall
            isSelected={expandedOfferId === bestOverallOffer.id}
            onExpandExplanation={() =>
              setExpandedOfferId(
                expandedOfferId === bestOverallOffer.id ? null : bestOverallOffer.id
              )
            }
            lang={lang}
          />
        </div>
      )}

      {/* Cheapest Offer */}
      {cheapestOffer && cheapestOffer.id !== bestOverallOffer?.id && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block px-3 py-1 bg-orange-500 text-white text-sm font-semibold rounded-full">
              {lang === 'ar' ? '💰 الأرخص' : '💰 Cheapest'}
            </span>
            {cheapestOffer.explanation && (
              <div className="text-sm text-gray-600">
                {lang === 'ar'
                  ? `ثقة: ${cheapestOffer.explanation.confidence}%`
                  : `Confidence: ${cheapestOffer.explanation.confidence}%`}
              </div>
            )}
          </div>
          <OfferCard
            offer={cheapestOffer}
            isCheapest
            isSelected={expandedOfferId === cheapestOffer.id}
            onExpandExplanation={() =>
              setExpandedOfferId(
                expandedOfferId === cheapestOffer.id ? null : cheapestOffer.id
              )
            }
            lang={lang}
          />
        </div>
      )}

      {/* Other Offers */}
      {otherOffers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {lang === 'ar' ? 'عروض أخرى' : 'Other Offers'}
          </h3>
          {otherOffers.map((offer) => (
            <div
              key={offer.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <OfferCard
                offer={offer}
                isSelected={expandedOfferId === offer.id}
                onExpandExplanation={() =>
                  setExpandedOfferId(expandedOfferId === offer.id ? null : offer.id)
                }
                lang={lang}
              />
            </div>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {lang === 'ar' ? 'جدول المقارنة' : 'Comparison Table'}
        </h3>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {lang === 'ar' ? 'المتجر' : 'Store'}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-900">
                  {lang === 'ar' ? 'السعر' : 'Price'}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {lang === 'ar' ? 'التوفر' : 'Availability'}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {lang === 'ar' ? 'الشحن' : 'Shipping'}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {lang === 'ar' ? 'الطزاجة' : 'Freshness'}
                </th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, index) => (
                <tr
                  key={offer.id}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {offer.storeName}
                      {offer.rankingReason === 'best_overall' && (
                        <span className="text-green-600 font-bold">⭐</span>
                      )}
                      {offer.rankingReason === 'cheapest' && (
                        <span className="text-orange-600 font-bold">💰</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {offer.price.toLocaleString('ar-EG')} {offer.currency}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        offer.availability === 'in_stock'
                          ? 'bg-green-100 text-green-800'
                          : offer.availability === 'limited'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {lang === 'ar'
                        ? offer.availability === 'in_stock'
                          ? 'متوفر'
                          : offer.availability === 'limited'
                            ? 'محدود'
                            : 'غير متوفر'
                        : offer.availability === 'in_stock'
                          ? 'In Stock'
                          : offer.availability === 'limited'
                            ? 'Limited'
                            : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {offer.shippingInfo?.available
                      ? `${lang === 'ar' ? 'متاح' : 'Available'} ${
                          offer.shippingInfo.cost ? `- ${offer.shippingInfo.cost} EGP` : ''
                        }`
                      : lang === 'ar'
                        ? 'غير متوفر'
                        : 'Not Available'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={
                        offer.freshness.isStale
                          ? 'text-red-600 font-medium'
                          : 'text-green-600 font-medium'
                      }
                    >
                      {lang === 'ar'
                        ? `${offer.freshness.hoursOld.toFixed(1)} ساعة`
                        : `${offer.freshness.hoursOld.toFixed(1)}h ago`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
