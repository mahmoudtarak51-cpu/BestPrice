import type { SearchFilters, SearchResponse } from '../types/search';

const fallbackResponse: SearchResponse = {
  query: 'iphone',
  detectedLanguage: 'en',
  page: 1,
  pageSize: 20,
  totalResults: 2,
  groups: [
    {
      productId: '00000000-0000-4000-8000-000000a1b2c3',
      canonicalName: 'Apple iPhone 15 128GB',
      canonicalNameArabic: 'ابل ايفون 15 سعة 128 جيجابايت',
      category: 'Phones',
      brand: 'Apple',
      imageUrl: null,
      badges: ['best_overall', 'cheapest'],
      bestOverallOffer: {
        offerId: '00000000-0000-4000-8000-000000b1c2d3',
        store: 'Retailer B',
        priceEgp: 30499,
        shippingEgp: 0,
        landedPriceEgp: 30499,
        availability: 'in_stock',
        lastUpdatedAt: '2026-04-17T09:55:00.000Z',
      },
      cheapestOffer: {
        offerId: '00000000-0000-4000-8000-000000c1d2e3',
        store: 'Retailer A',
        priceEgp: 29999,
        shippingEgp: 500,
        landedPriceEgp: 30499,
        availability: 'in_stock',
        lastUpdatedAt: '2026-04-17T09:40:00.000Z',
      },
      exactOfferCount: 2,
      similarProductCount: 0,
      lastUpdatedAt: '2026-04-17T09:55:00.000Z',
    },
    {
      productId: '00000000-0000-4000-8000-000000d1e2f3',
      canonicalName: 'Samsung Galaxy S24 256GB',
      canonicalNameArabic: 'سامسونج جالكسي S24 256 جيجابايت',
      category: 'Phones',
      brand: 'Samsung',
      imageUrl: null,
      badges: ['best_overall', 'cheapest'],
      bestOverallOffer: {
        offerId: '00000000-0000-4000-8000-000000e1f2a3',
        store: 'Retailer B',
        priceEgp: 33999,
        shippingEgp: 250,
        landedPriceEgp: 34249,
        availability: 'in_stock',
        lastUpdatedAt: '2026-04-17T09:55:00.000Z',
      },
      cheapestOffer: {
        offerId: '00000000-0000-4000-8000-000000f1a2b3',
        store: 'Retailer B',
        priceEgp: 33999,
        shippingEgp: 250,
        landedPriceEgp: 34249,
        availability: 'in_stock',
        lastUpdatedAt: '2026-04-17T09:55:00.000Z',
      },
      exactOfferCount: 2,
      similarProductCount: 0,
      lastUpdatedAt: '2026-04-17T09:55:00.000Z',
    },
  ],
};

function buildQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

export async function fetchSearchResults(
  filters: SearchFilters,
): Promise<SearchResponse> {
  const params = buildQuery(filters);
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL
    ?? process.env.API_BASE_URL
    ?? 'http://localhost:3001/api/v1';

  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}.`);
    }

    return (await response.json()) as SearchResponse;
  } catch {
    return {
      ...fallbackResponse,
      query: filters.q || fallbackResponse.query,
      detectedLanguage:
        filters.lang === 'ar' ? 'ar' : filters.lang === 'en' ? 'en' : fallbackResponse.detectedLanguage,
      groups: fallbackResponse.groups.filter((group) => {
        if (filters.brand && group.brand.toLowerCase() !== filters.brand.toLowerCase()) {
          return false;
        }

        if (filters.category && group.category.toLowerCase() !== filters.category.toLowerCase()) {
          return false;
        }

        return true;
      }),
      totalResults: fallbackResponse.groups.filter((group) => {
        if (filters.brand && group.brand.toLowerCase() !== filters.brand.toLowerCase()) {
          return false;
        }

        if (filters.category && group.category.toLowerCase() !== filters.category.toLowerCase()) {
          return false;
        }

        return true;
      }).length,
    };
  }
}
