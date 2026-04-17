export type SearchOfferSummary = {
  offerId: string;
  store: string;
  priceEgp: number;
  shippingEgp: number | null;
  landedPriceEgp: number | null;
  availability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown';
  lastUpdatedAt: string;
};

export type SearchResultGroup = {
  productId: string;
  canonicalName: string;
  canonicalNameArabic: string | null;
  category: string;
  brand: string;
  imageUrl: string | null;
  badges: Array<'best_overall' | 'cheapest'>;
  bestOverallOffer: SearchOfferSummary;
  cheapestOffer: SearchOfferSummary | null;
  exactOfferCount: number;
  similarProductCount: number;
  lastUpdatedAt: string;
};

export type SearchResponse = {
  query: string;
  detectedLanguage: 'ar' | 'en' | 'mixed' | 'unknown';
  page: number;
  pageSize: number;
  totalResults: number;
  groups: SearchResultGroup[];
};

export type SearchFilters = {
  q: string;
  lang?: 'auto' | 'ar' | 'en';
  category?: string;
  brand?: string;
  store?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  pageSize?: string;
};