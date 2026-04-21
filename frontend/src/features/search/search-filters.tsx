'use client';

import type { AppLocale } from '../../i18n/config';
import { UI_COPY } from '../../i18n/config';
import { useSearchFilters } from './use-search-filters';

export function SearchFilters(props: { locale: AppLocale }) {
  const { searchParams, updateFilter } = useSearchFilters();
  const copy = UI_COPY[props.locale];

  return (
    <section className="searchFilters">
      <div className="filterField filterFieldWide">
        <label htmlFor="search-q">{copy.searchPlaceholder}</label>
        <input
          id="search-q"
          defaultValue={searchParams.get('q') ?? ''}
          onBlur={(event) => updateFilter('q', event.currentTarget.value)}
          placeholder={copy.searchPlaceholder}
          type="search"
        />
      </div>
      <div className="filterField">
        <label htmlFor="search-category">Category</label>
        <select
          defaultValue={searchParams.get('category') ?? ''}
          id="search-category"
          onChange={(event) => updateFilter('category', event.currentTarget.value)}
        >
          <option value="">All</option>
          <option value="phones">Phones</option>
          <option value="laptops">Laptops</option>
          <option value="headphones">Headphones</option>
          <option value="tvs">TVs</option>
        </select>
      </div>
      <div className="filterField">
        <label htmlFor="search-brand">Brand</label>
        <select
          defaultValue={searchParams.get('brand') ?? ''}
          id="search-brand"
          onChange={(event) => updateFilter('brand', event.currentTarget.value)}
        >
          <option value="">All</option>
          <option value="apple">Apple</option>
          <option value="samsung">Samsung</option>
          <option value="lenovo">Lenovo</option>
          <option value="sony">Sony</option>
        </select>
      </div>
      <div className="filterField">
        <label htmlFor="search-store">Store</label>
        <select
          defaultValue={searchParams.get('store') ?? ''}
          id="search-store"
          onChange={(event) => updateFilter('store', event.currentTarget.value)}
        >
          <option value="">All</option>
          <option value="retailer-a">Retailer A</option>
          <option value="retailer-b">Retailer B</option>
        </select>
      </div>
      <div className="filterField">
        <label htmlFor="search-minPrice">Min price</label>
        <input
          defaultValue={searchParams.get('minPrice') ?? ''}
          id="search-minPrice"
          onBlur={(event) => updateFilter('minPrice', event.currentTarget.value)}
          type="number"
        />
      </div>
      <div className="filterField">
        <label htmlFor="search-maxPrice">Max price</label>
        <input
          defaultValue={searchParams.get('maxPrice') ?? ''}
          id="search-maxPrice"
          onBlur={(event) => updateFilter('maxPrice', event.currentTarget.value)}
          type="number"
        />
      </div>
    </section>
  );
}