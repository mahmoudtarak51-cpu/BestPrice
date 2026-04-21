'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';

import { CrawlSummaryCards, SourceHealthPanel } from './source-health-panel';
import { UnmatchedQueue } from './unmatched-queue';

interface Overview {
  totalSources: number;
  activeSources: number;
  staleSources: number;
  recentFailures: Array<{
    jobId: string;
    adapterId: string;
    adapterName: string;
    failedAt: string;
    reason: string;
  }>;
  unmatchedCount: number;
  lastUpdatedAt: string;
}

function DashboardContent() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) {
          throw new Error('No session token');
        }

        const response = await fetch('/api/v1/admin/overview', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch overview: ${response.statusText}`);
        }

        const data: Overview = await response.json();
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOverview();
    const interval = window.setInterval(() => {
      void fetchOverview();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!overview) {
    return <div className="text-gray-600">No data available</div>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Dashboard</h1>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-600">Total Sources</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{overview.totalSources}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-green-600">Active Sources</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{overview.activeSources}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-yellow-600">Stale Sources</p>
            <p className="mt-2 text-3xl font-bold text-yellow-600">{overview.staleSources}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-orange-600">Unmatched Products</p>
            <p className="mt-2 text-3xl font-bold text-orange-600">{overview.unmatchedCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Manual Crawl</h2>
            <p className="mb-4 text-gray-600">Trigger an immediate crawl for selected sources.</p>
            <Link
              href="/admin/crawl-jobs"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Trigger Crawl
            </Link>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Source Health</h2>
            <p className="mb-4 text-gray-600">View detailed health metrics for each source.</p>
            <Link
              href="/admin/sources"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              View Details
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Crawl Status</h2>
          <span className="text-xs text-gray-500">
            Last updated: {new Date(overview.lastUpdatedAt).toLocaleString()}
          </span>
        </div>
        <CrawlSummaryCards />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Source Health</h2>
        <SourceHealthPanel />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Unmatched Products</h2>
        <UnmatchedQueue />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Crawl Failures</h2>

        {overview.recentFailures.length === 0 ? (
          <p className="text-gray-600">No recent failures</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900">Time</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentFailures.map((failure) => (
                  <tr key={failure.jobId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{failure.adapterName}</td>
                    <td className="px-4 py-3 text-gray-600">{failure.reason}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(failure.failedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
