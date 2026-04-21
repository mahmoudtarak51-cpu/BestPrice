import type { AppLocale } from '../../i18n/config';
import type { SearchResponse } from '../../lib/types/search';
import { ResultCard } from './result-card';

export function SearchResults(props: {
  locale: AppLocale;
  response: SearchResponse;
}) {
  if (props.response.totalResults === 0) {
    return (
      <section className="emptyState">
        <h2>No fresh results yet</h2>
        <p>Try a broader query, remove a filter, or search another brand.</p>
      </section>
    );
  }

  return (
    <section className="resultsSection">
      <div className="resultsSummary">
        <p>{props.response.totalResults} grouped products</p>
        <strong>Detected language: {props.response.detectedLanguage}</strong>
      </div>
      <div className="resultsList">
        {props.response.groups.map((group) => (
          <ResultCard group={group} key={group.productId} locale={props.locale} />
        ))}
      </div>
    </section>
  );
}
