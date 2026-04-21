export type {
  SearchOfferSummary,
  SearchResultGroup,
  SearchResponse,
} from './api';

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
