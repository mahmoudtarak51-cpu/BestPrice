'use client';

import { useEffect, useState } from 'react';

interface CrawlJob {
  jobId: string;
  adapterId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  itemsMatched: number;
  triggeredByAdmin: string | null;
}

interface CrawlJobsResponse {
  crawlJobs: CrawlJob[];
  total: number;
  page: number;
  limit: number;
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusBadgeClass(status: string): string {
  if (status === 'completed' || status === 'succeeded') {
    return 'bg-green-100 text-green-800';
  }

  if (status === 'failed') {
    return 'bg-red-100 text-red-800';
  }

  if (status === 'running') {
    return 'bg-blue-100 text-blue-800';
  }

  return 'bg-yellow-100 text-yellow-800';
}

export function CrawlHistoryTable() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) {
          throw new Error('No session token');
        }

        const response = await fetch('/api/v1/admin/crawl-jobs?limit=20', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch crawl jobs');
        }

        const data: CrawlJobsResponse = await response.json();
        setJobs(data.crawlJobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load crawl jobs');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchJobs();
  }, []);

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded bg-gray-200" />;
  }

  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Crawl History</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-900">Job ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-900">Adapter</th>
              <th className="px-4 py-3 text-left font-medium text-gray-900">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-900">Started</th>
              <th className="px-4 py-3 text-right font-medium text-gray-900">Processed</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.jobId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{job.jobId}</td>
                <td className="px-4 py-3 text-gray-900">{job.adapterId}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(job.status)}`}
                  >
                    {formatStatus(job.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(job.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{job.itemsProcessed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jobs.length === 0 ? (
        <p className="py-8 text-center text-gray-600">No crawl jobs recorded yet.</p>
      ) : null}
    </div>
  );
}
