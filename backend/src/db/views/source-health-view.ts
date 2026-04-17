type SqlExecutor = {
  unsafe: (query: string) => Promise<unknown>;
};

export const SOURCE_HEALTH_VIEW_NAME = 'source_health_view';

export const SOURCE_HEALTH_VIEW_SQL = `
create or replace view ${SOURCE_HEALTH_VIEW_NAME} as
with latest_jobs as (
  select distinct on (source_adapter_id)
    source_adapter_id,
    status as latest_job_status,
    started_at,
    finished_at,
    scheduled_for
  from crawl_jobs
  order by
    source_adapter_id,
    coalesce(started_at, scheduled_for) desc,
    scheduled_for desc
),
stale_offer_counts as (
  select
    rp.source_adapter_id,
    count(*)::int as stale_offer_count
  from offers o
  join raw_products rp on rp.id = o.raw_product_id
  where o.shopper_visible = false
    and o.stale_after_at < now()
  group by rp.source_adapter_id
),
unmatched_product_counts as (
  select
    rp.source_adapter_id,
    count(*)::int as unmatched_product_count
  from matching_reviews mr
  join raw_products rp on rp.id = mr.raw_product_id
  where mr.review_status = 'pending'
  group by rp.source_adapter_id
)
select
  sa.id as source_adapter_id,
  sa.key as adapter_key,
  sa.status as adapter_status,
  s.id as store_id,
  s.slug as store_slug,
  s.display_name as store_name,
  sa.last_successful_crawl_at,
  coalesce(soc.stale_offer_count, 0) as stale_offer_count,
  coalesce(upc.unmatched_product_count, 0) as unmatched_product_count,
  lj.latest_job_status,
  lj.started_at as latest_job_started_at,
  lj.finished_at as latest_job_finished_at,
  case
    when lj.latest_job_status = 'failed' then 'failing'
    when sa.last_successful_crawl_at is null then 'warning'
    when sa.last_successful_crawl_at < now() - make_interval(hours => sa.freshness_sla_hours) then 'stale'
    when coalesce(soc.stale_offer_count, 0) > 0 then 'warning'
    else 'healthy'
  end as status
from source_adapters sa
join stores s on s.id = sa.store_id
left join latest_jobs lj on lj.source_adapter_id = sa.id
left join stale_offer_counts soc on soc.source_adapter_id = sa.id
left join unmatched_product_counts upc on upc.source_adapter_id = sa.id;
`;

export async function ensureSourceHealthView(sql: SqlExecutor): Promise<void> {
  await sql.unsafe(SOURCE_HEALTH_VIEW_SQL);
}
