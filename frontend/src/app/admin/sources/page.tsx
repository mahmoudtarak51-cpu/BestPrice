import { CrawlSummaryCards, SourceHealthPanel } from '@/features/admin/source-health-panel';

export default function AdminSourcesPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Source Health</h1>
        <p className="text-gray-600">
          Review freshness, offer coverage, and unmatched counts for each retailer source.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Crawl Status</h2>
        <CrawlSummaryCards />
      </section>

      <SourceHealthPanel />
    </div>
  );
}
