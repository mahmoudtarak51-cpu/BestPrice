export interface FreshnessStatus {
  hoursOld: number;
  isStale: boolean;
  lastUpdatedAt: Date;
}

export interface Provenance {
  lastFetchedAt: Date;
  sourceUrl?: string;
}

export interface ShippingInfo {
  available: boolean;
  cost?: number;
  message?: string;
  estimatedDays?: number;
}

export interface Offer {
  id: string;
  storeId: string;
  storeName: string;
  price: number;
  currency: 'EGP';
  availability: 'in_stock' | 'limited' | 'out_of_stock';
  shippingInfo?: ShippingInfo;
  freshness: FreshnessStatus;
  rankingReason?:
    | 'best_overall'
    | 'cheapest'
    | 'trusted_seller'
    | 'fast_shipping'
    | 'good_value';
  provenance: Provenance;
}

export interface SimilarProduct {
  id: string;
  title: string;
  brand: string;
  model?: string;
  category: string;
  matchConfidence: number;
  matchReason: string;
  hasOffers: boolean;
}

export interface ProductDetail {
  id: string;
  title: string;
  category: string;
  brand: string;
  model?: string;
  gtin?: string;
  description?: string;
  images?: string[];
  specifications?: Record<string, string>;
  exactOffers: Offer[];
  similarProducts: SimilarProduct[];
  updatedAt: Date;
}

export interface OfferWithExplanation extends Offer {
  explanation?: {
    rankingReason: string;
    rankingScore: number;
    confidence: number;
    factors: RankingFactor[];
  };
}

export interface OffersList {
  productId: string;
  offers: OfferWithExplanation[];
}

export interface SimilarProductWithOffers extends SimilarProduct {
  offers: Array<{
    id: string;
    storeId: string;
    storeName: string;
    price: number;
    currency: 'EGP';
    availability: 'in_stock' | 'limited' | 'out_of_stock';
    rankingReason?: string;
  }>;
}

export interface SimilarProductsList {
  productId: string;
  products: SimilarProductWithOffers[];
}

export interface RankingFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
}

export interface RankingExplanation {
  offerId: string;
  storeId: string;
  storeName: string;
  price: number;
  rankingScore: number;
  rankingReason:
    | 'best_overall'
    | 'cheapest'
    | 'trusted_seller'
    | 'fast_shipping'
    | 'good_value';
  factors: RankingFactor[];
  freshnessStatus: FreshnessStatus & {
    freshnessPenalty: number;
    freshnessExplanation: string;
  };
  shippingIssues?: string[];
  confidence: number;
}

// UI-specific types
export interface ProductComparisonState {
  selectedOffers: Map<string, Offer>;
  selectedSimilar: Map<string, SimilarProduct>;
  expandedOfferIds: Set<string>;
  showStaleOffers: boolean;
}

export interface ProductDetailPageProps {
  params: {
    lang: 'ar' | 'en';
    productId: string;
  };
}

export interface OfferCardProps {
  offer: Offer;
  isBestOverall?: boolean;
  isCheapest?: boolean;
  isSelected?: boolean;
  onSelect?: (offer: Offer) => void;
  onExpandExplanation?: (offerId: string) => void;
}

export interface SimilarProductCardProps {
  product: SimilarProduct;
  onViewDetails?: (productId: string) => void;
}
