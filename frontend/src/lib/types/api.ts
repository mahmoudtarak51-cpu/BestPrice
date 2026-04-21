export type ApiLocale = 'ar' | 'en';
export type DetectedLanguage = ApiLocale | 'mixed' | 'unknown';
export type OfferAvailability =
  | 'in_stock'
  | 'limited'
  | 'out_of_stock'
  | 'unknown';
export type OfferBadge = 'best_overall' | 'cheapest';
export type RankingReason =
  | 'best_overall'
  | 'cheapest'
  | 'trusted_seller'
  | 'fast_shipping'
  | 'good_value';

export type SearchOfferSummary = {
  offerId: string;
  store: string;
  priceEgp: number;
  shippingEgp: number | null;
  landedPriceEgp: number | null;
  availability: OfferAvailability;
  lastUpdatedAt: string;
};

export type SearchResultGroup = {
  productId: string;
  canonicalName: string;
  canonicalNameArabic: string | null;
  category: string;
  brand: string;
  imageUrl: string | null;
  badges: OfferBadge[];
  bestOverallOffer: SearchOfferSummary;
  cheapestOffer: SearchOfferSummary | null;
  exactOfferCount: number;
  similarProductCount: number;
  lastUpdatedAt: string;
};

export type SearchResponse = {
  query: string;
  detectedLanguage: DetectedLanguage;
  page: number;
  pageSize: number;
  totalResults: number;
  groups: SearchResultGroup[];
};

export type FreshnessStatus = {
  hoursOld: number;
  isStale: boolean;
  lastUpdatedAt: Date;
};

export type Provenance = {
  lastFetchedAt: Date;
  sourceUrl?: string;
};

export type ShippingInfo = {
  available: boolean;
  cost?: number;
  message?: string;
  estimatedDays?: number;
};

export type Offer = {
  id: string;
  storeId: string;
  storeName: string;
  price: number;
  currency: 'EGP' | string;
  availability: Exclude<OfferAvailability, 'unknown'> | string;
  shippingInfo?: ShippingInfo;
  freshness: FreshnessStatus;
  rankingReason?: RankingReason;
  provenance: Provenance;
  matchType?: 'exact' | 'similar';
  matchConfidence?: number;
};

export type SimilarProduct = {
  id: string;
  title: string;
  brand: string;
  model?: string;
  category: string;
  matchConfidence: number;
  matchReason: string;
  hasOffers: boolean;
};

export type ProductDetail = {
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
};

export type RankingFactor = {
  name: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
};

export type OfferWithExplanation = Offer & {
  explanation?: {
    rankingReason: string;
    rankingScore: number;
    confidence: number;
    factors: RankingFactor[];
  };
};

export type OffersList = {
  productId: string;
  offers: OfferWithExplanation[];
};

export type SimilarProductWithOffers = SimilarProduct & {
  offers: Array<{
    id: string;
    storeId: string;
    storeName: string;
    price: number;
    currency: 'EGP' | string;
    availability: Exclude<OfferAvailability, 'unknown'> | string;
    rankingReason?: string;
  }>;
};

export type SimilarProductsList = {
  productId: string;
  products: SimilarProductWithOffers[];
};

export type RankingExplanation = {
  offerId: string;
  storeId: string;
  storeName: string;
  price: number;
  rankingScore: number;
  rankingReason: RankingReason;
  factors: RankingFactor[];
  freshnessStatus: FreshnessStatus & {
    freshnessPenalty: number;
    freshnessExplanation: string;
  };
  shippingIssues?: string[];
  confidence: number;
};

export type AdminLoginRequest = {
  email: string;
  password: string;
};

export type AdminLoginResponse = {
  sessionToken: string;
  adminId: string;
  email: string;
  displayName: string;
};

export type AdminStatusResponse = {
  adminId: string;
  email: string;
  displayName: string;
  role: 'admin';
};

export type AdminOverview = {
  totalSources: number;
  activeSources: number;
  staleSources: number;
  recentFailures: Array<{
    jobId: string;
    adapterId: string;
    adapterName: string;
    failedAt: string;
    reason: string;
  }>;
  unmatchedCount: number;
  lastUpdatedAt: string;
};

export type AdminSourceListItem = {
  adapterId: string;
  name: string;
  isStale: boolean;
  lastCrawlAt: string | null;
  offerCount: number;
  unmatchedCount: number;
};

export type AdminSourceListResponse = {
  sources: AdminSourceListItem[];
  total: number;
  page: number;
  limit: number;
};

export type CrawlJob = {
  jobId: string;
  adapterId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  itemsMatched: number;
  triggeredByAdmin: string | null;
};

export type CrawlJobListResponse = {
  crawlJobs: CrawlJob[];
  total: number;
  page: number;
  limit: number;
};

export type ManualCrawlRequest = {
  adapterIds: string[];
};

export type ManualCrawlResponse = {
  jobId: string;
  adapterIds: string[];
  status: string;
  message: string;
};

export type UnmatchedProduct = {
  rawProductId: string;
  adapterId: string;
  title: string;
  price: number;
  url: string;
  crawledAt: string;
  failureReason: string | null;
};

export type UnmatchedProductListResponse = {
  products: UnmatchedProduct[];
  total: number;
  page: number;
  limit: number;
};
