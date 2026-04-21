import type { AppLocale } from '../../i18n/config';
import { LOCALE_METADATA, UI_COPY } from '../../i18n/config';
import type { SearchResponse } from '../../lib/types/search';
import { SearchFilters } from './search-filters';
import { SearchResults } from './search-results';

export function SearchPage(props: {
  locale: AppLocale;
  response: SearchResponse;
}) {
  const copy = UI_COPY[props.locale];
  const metadata = LOCALE_METADATA[props.locale];

  return (
    <main className="searchShell" dir={metadata.direction}>
      <section className="heroPanel">
        <p className="heroEyebrow">Egypt-first comparison</p>
        <h1>{props.locale === 'ar' ? 'ابحث عن العروض' : 'Search offers'}</h1>
        <p className="heroCopy">
          {props.locale === 'ar'
            ? 'قارن بين أفضل العروض وأرخصها مع تحديثات حديثة ومعلومات واضحة عن المتجر والشحن.'
            : 'Compare best-overall and cheapest offers with fresh timestamps, store provenance, and filterable results.'}
        </p>
        <div className="heroStats">
          <div>
            <span>Currency</span>
            <strong>{copy.currency}</strong>
          </div>
          <div>
            <span>Results</span>
            <strong>{props.response.totalResults}</strong>
          </div>
          <div>
            <span>Language</span>
            <strong>{props.response.detectedLanguage}</strong>
          </div>
        </div>
      </section>
      <SearchFilters locale={props.locale} />
      <SearchResults locale={props.locale} response={props.response} />
    </main>
  );
}
