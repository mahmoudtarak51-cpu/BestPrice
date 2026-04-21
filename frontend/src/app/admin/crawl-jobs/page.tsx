import { CrawlHistoryTable } from '@/features/admin/crawl-history-table';
import { CrawlSummaryCards } from '@/features/admin/source-health-panel';
import { ManualCrawlForm } from '@/features/admin/unmatched-queue';

export default function AdminCrawlJobsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Crawl History</h1>
        <p className="text-gray-600">
          Trigger manual crawls and review the most recent crawl job activity.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Crawl Status</h2>
        <CrawlSummaryCards />
      </section>

      <ManualCrawlForm />
      <CrawlHistoryTable />
    </div>
  );
}
