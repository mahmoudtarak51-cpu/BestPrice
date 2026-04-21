import { ManualCrawlForm, UnmatchedQueue } from '@/features/admin/unmatched-queue';

export default function AdminUnmatchedPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Unmatched Products</h1>
        <p className="text-gray-600">
          Investigate listings that failed matching and rerun affected crawls when needed.
        </p>
      </section>

      <ManualCrawlForm />
      <UnmatchedQueue />
    </div>
  );
}
