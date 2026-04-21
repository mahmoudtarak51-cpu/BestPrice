import { resolveLocale } from '../../../i18n/config';
import { fetchSearchResults } from '../../../lib/api/search-client';
import type { SearchFilters } from '../../../lib/types/search';
import { SearchPage } from '../../../features/search/search-page';

export default async function LocalizedSearchPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const locale = resolveLocale(params.lang);
  const searchParams = (await props.searchParams) ?? {};
  const filters: SearchFilters = {
    q: getSingleValue(searchParams.q) ?? (locale === 'ar' ? 'سامسونج' : 'iphone'),
    lang: locale,
    category: getSingleValue(searchParams.category) ?? undefined,
    brand: getSingleValue(searchParams.brand) ?? undefined,
    store: getSingleValue(searchParams.store) ?? undefined,
    minPrice: getSingleValue(searchParams.minPrice) ?? undefined,
    maxPrice: getSingleValue(searchParams.maxPrice) ?? undefined,
    page: getSingleValue(searchParams.page) ?? undefined,
    pageSize: getSingleValue(searchParams.pageSize) ?? undefined,
  };

  const response = await fetchSearchResults(filters);

  return <SearchPage locale={locale} response={response} />;
}

function getSingleValue(
  input: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(input)) {
    return input[0];
  }

  return input;
}