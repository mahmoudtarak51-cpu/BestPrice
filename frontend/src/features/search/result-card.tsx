import Link from 'next/link';

import type { AppLocale } from '../../i18n/config';
import type { SearchResultGroup } from '../../lib/types/search';

export function ResultCard(props: {
  group: SearchResultGroup;
  locale: AppLocale;
}) {
  const { group, locale } = props;
  const productHref = `/${locale}/products/${group.productId}`;

  return (
    <article className="resultCard">
      <div className="resultMeta">
        <p className="eyebrow">
          {group.brand} {'\u2022'} {group.category}
        </p>
        <h2>
          <Link href={productHref}>{group.canonicalName}</Link>
        </h2>
        {group.canonicalNameArabic ? <p className="arabicCopy">{group.canonicalNameArabic}</p> : null}
      </div>
      <div className="badgeRow">
        {group.badges.map((badge) => (
          <span className="badge" key={badge}>
            {badge === 'best_overall' ? 'Best overall' : 'Cheapest'}
          </span>
        ))}
      </div>
      <div className="offerGrid">
        <div className="offerPanel primaryOffer">
          <p className="offerLabel">Preferred offer</p>
          <strong>{group.bestOverallOffer.store}</strong>
          <p className="offerPrice">EGP {group.bestOverallOffer.priceEgp.toLocaleString('en-US')}</p>
          <p className="offerMetaText">
            Updated{' '}
            {new Date(group.bestOverallOffer.lastUpdatedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {group.cheapestOffer ? (
          <div className="offerPanel secondaryOffer">
            <p className="offerLabel">Cheapest</p>
            <strong>{group.cheapestOffer.store}</strong>
            <p className="offerPrice">EGP {group.cheapestOffer.priceEgp.toLocaleString('en-US')}</p>
            <p className="offerMetaText">Shipping {group.cheapestOffer.shippingEgp ?? 0} EGP</p>
          </div>
        ) : null}
      </div>
      <div className="resultFooter">
        <span>{group.exactOfferCount} exact offers</span>
        <Link href={productHref}>View comparison</Link>
        <span>Updated {new Date(group.lastUpdatedAt).toLocaleString('en-US')}</span>
      </div>
    </article>
  );
}
