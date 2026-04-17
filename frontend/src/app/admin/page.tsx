'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

/**
 * Admin dashboard page
 * Main overview showing source health summary and recent activity
 */

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

    fetchOverview();
    const interval = setInterval(fetchOverview, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!overview) {
    return <div className="text-gray-600">No data available</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Total Sources */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-600">Total Sources</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{overview.totalSources}</p>
        </div>

        {/* Active Sources */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-green-600">Active Sources</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{overview.activeSources}</p>
        </div>

        {/* Stale Sources */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-yellow-600">Stale Sources</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{overview.staleSources}</p>
        </div>

        {/* Unmatched Products */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Unmatched Products</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{overview.unmatchedCount}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Manual Crawl Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Crawl</h2>
          <p className="text-gray-600 mb-4">Trigger an immediate crawl for selected sources</p>
          <Link
            href="/admin/crawl-jobs"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Trigger Crawl
          </Link>
        </div>

        {/* Source Health Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Source Health</h2>
          <p className="text-gray-600 mb-4">View detailed health metrics for each source</p>
          <Link
            href="/admin/sources"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>

      {/* Recent Failures */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Crawl Failures</h2>

        {overview.recentFailures.length === 0 ? (
          <p className="text-gray-600">No recent failures</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Time</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentFailures.map(failure => (
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
      </div>

      {/* Last Updated */}
      <div className="text-xs text-gray-500 mt-4">
        Last updated: {new Date(overview.lastUpdatedAt).toLocaleString()}
      </div>
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
