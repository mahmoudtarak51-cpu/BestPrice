'use client';

import React from 'react';

interface MatchConfidenceBadgeProps {
  confidence: number;
  lang: 'ar' | 'en';
}

export function MatchConfidenceBadge({ confidence, lang }: MatchConfidenceBadgeProps) {
  const getConfidenceLevel = (
    confidence: number
  ): { label: string; color: string; bgColor: string } => {
    if (confidence >= 90) {
      return {
        label: lang === 'ar' ? 'تطابق عالي جداً' : 'Very High Match',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
      };
    } else if (confidence >= 70) {
      return {
        label: lang === 'ar' ? 'تطابق عالي' : 'High Match',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      };
    } else if (confidence >= 50) {
      return {
        label: lang === 'ar' ? 'تطابق متوسط' : 'Medium Match',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
      };
    } else if (confidence >= 30) {
      return {
        label: lang === 'ar' ? 'تطابق منخفض' : 'Low Match',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      };
    } else {
      return {
        label: lang === 'ar' ? 'تطابق ضعيف' : 'Very Low Match',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      };
    }
  };

  const level = getConfidenceLevel(confidence);

  return (
    <div
      className={`${level.bgColor} px-3 py-2 rounded-full inline-block`}
      data-testid="match-confidence-badge"
    >
      <div className="flex items-center gap-2">
        {/* Confidence Icon */}
        <span className="text-lg">
          {confidence >= 90
            ? '✓✓✓'
            : confidence >= 70
              ? '✓✓'
              : confidence >= 50
                ? '✓'
                : '?'}
        </span>

        {/* Text */}
        <div>
          <div className={`text-xs font-semibold ${level.color}`}>{level.label}</div>
          <div className={`text-xs ${level.color} opacity-75`}>
            {Math.round(confidence)}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 w-24 h-1.5 bg-gray-300 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            confidence >= 90
              ? 'bg-green-600'
              : confidence >= 70
                ? 'bg-green-500'
                : confidence >= 50
                  ? 'bg-yellow-500'
                  : confidence >= 30
                    ? 'bg-orange-500'
                    : 'bg-red-500'
          }`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}
