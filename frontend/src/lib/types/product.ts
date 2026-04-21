import type { Offer, SimilarProduct } from './api';

export type {
  FreshnessStatus,
  Provenance,
  ShippingInfo,
  Offer,
  SimilarProduct,
  ProductDetail,
  OfferWithExplanation,
  OffersList,
  SimilarProductWithOffers,
  SimilarProductsList,
  RankingFactor,
  RankingExplanation,
} from './api';

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
