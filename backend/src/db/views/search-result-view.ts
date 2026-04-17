type SqlExecutor = {
  unsafe: (query: string) => Promise<unknown>;
};

export const SEARCH_RESULT_VIEW_NAME = 'search_result_view';

export const SEARCH_RESULT_VIEW_SQL = `
create or replace view ${SEARCH_RESULT_VIEW_NAME} as
with visible_offers as (
  select
    o.id,
    o.canonical_product_id,
    o.store_id,
    o.match_level,
    o.price_amount_egp,
    o.shipping_amount_egp,
    o.landed_price_egp,
    o.availability_status,
    o.last_successful_update_at,
    o.ranking_score
  from offers o
  where o.shopper_visible = true
),
best_overall as (
  select distinct on (canonical_product_id)
    canonical_product_id,
    id as offer_id,
    store_id,
    price_amount_egp,
    shipping_amount_egp,
    landed_price_egp,
    availability_status,
    last_successful_update_at
  from visible_offers
  order by
    canonical_product_id,
    ranking_score desc nulls last,
    landed_price_egp asc nulls last,
    price_amount_egp asc,
    last_successful_update_at desc
),
cheapest as (
  select distinct on (canonical_product_id)
    canonical_product_id,
    id as offer_id,
    store_id,
    price_amount_egp,
    shipping_amount_egp,
    landed_price_egp,
    availability_status,
    last_successful_update_at
  from visible_offers
  order by
    canonical_product_id,
    landed_price_egp asc nulls last,
    price_amount_egp asc,
    last_successful_update_at desc
),
offer_counts as (
  select
    canonical_product_id,
    count(*) filter (where match_level = 'exact')::int as exact_offer_count,
    count(*) filter (where match_level = 'similar')::int as similar_product_count,
    max(last_successful_update_at) as last_updated_at
  from visible_offers
  group by canonical_product_id
)
select
  cp.id as product_id,
  cp.canonical_name_en,
  cp.canonical_name_ar,
  cp.search_document,
  cp.image_url,
  cp.catalog_status,
  c.id as category_id,
  c.slug as category_slug,
  c.name_en as category_name_en,
  c.name_ar as category_name_ar,
  b.id as brand_id,
  b.slug as brand_slug,
  b.canonical_name as brand_name,
  bo.offer_id as best_overall_offer_id,
  bo.store_id as best_overall_store_id,
  bo.price_amount_egp as best_overall_price_egp,
  bo.shipping_amount_egp as best_overall_shipping_egp,
  bo.landed_price_egp as best_overall_landed_price_egp,
  bo.availability_status as best_overall_availability_status,
  ch.offer_id as cheapest_offer_id,
  ch.store_id as cheapest_store_id,
  ch.price_amount_egp as cheapest_price_egp,
  ch.shipping_amount_egp as cheapest_shipping_egp,
  ch.landed_price_egp as cheapest_landed_price_egp,
  ch.availability_status as cheapest_availability_status,
  coalesce(oc.exact_offer_count, 0) as exact_offer_count,
  coalesce(oc.similar_product_count, 0) as similar_product_count,
  oc.last_updated_at
from canonical_products cp
join categories c on c.id = cp.category_id
join brands b on b.id = cp.brand_id
left join best_overall bo on bo.canonical_product_id = cp.id
left join cheapest ch on ch.canonical_product_id = cp.id
left join offer_counts oc on oc.canonical_product_id = cp.id
where cp.catalog_status = 'active';
`;

export async function ensureSearchResultView(sql: SqlExecutor): Promise<void> {
  await sql.unsafe(SEARCH_RESULT_VIEW_SQL);
}
