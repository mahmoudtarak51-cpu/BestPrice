'use client';

import { useEffect, useState } from 'react';

/**
 * Source health panel widget
 * Displays list of sources with health status and freshness indicators
 */

interface SourceHealth {
  adapterId: string;
  name: string;
  isStale: boolean;
  lastCrawlAt: string | null;
  offerCount: number;
  unmatchedCount: number;
}

interface SourceHealthResponse {
  sources: SourceHealth[];
  total: number;
  page: number;
  limit: number;
}

export function SourceHealthPanel() {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStale, setFilterStale] = useState(false);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) throw new Error('No session token');

        const params = new URLSearchParams({
          limit: '20',
          ...(filterStale && { isStale: 'true' }),
        });

        const response = await fetch(`/api/v1/admin/sources?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch sources');

        const data: SourceHealthResponse = await response.json();
        setSources(data.sources);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading sources');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSources();
  }, [filterStale]);

  const getStaleIndicator = (isStale: boolean, lastCrawl: string | null) => {
    if (!lastCrawl) return <span className="text-red-600 font-semibold">Never</span>;
    
    const lastTime = new Date(lastCrawl);
    const now = new Date();
    const hoursAgo = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
    
    if (isStale) {
      return (
        <span className="text-red-600 font-semibold" data-stale="true">
          {hoursAgo.toFixed(1)}h ago (STALE)
        </span>
      );
    }
    
    if (hoursAgo < 1) {
      return <span className="text-green-600">&lt;1h ago</span>;
    }
    
    return <span className="text-yellow-600">{hoursAgo.toFixed(1)}h ago</span>;
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded"></div>;
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Source Health</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterStale}
            onChange={e => setFilterStale(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600">Show stale only</span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-900">Adapter</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">Last Crawl</th>
              <th className="text-right px-4 py-3 font-medium text-gray-900">Offers</th>
              <th className="text-right px-4 py-3 font-medium text-gray-900">Unmatched</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(source => (
              <tr
                key={source.adapterId}
                className="border-b border-gray-100 hover:bg-gray-50"
                data-adapter={source.adapterId}
                data-stale={source.isStale}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{source.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      source.isStale
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {source.isStale ? 'Stale' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getStaleIndicator(source.isStale, source.lastCrawlAt)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{source.offerCount}</td>
                <td className="px-4 py-3 text-right">
                  {source.unmatchedCount > 0 ? (
                    <span className="text-orange-600 font-semibold">{source.unmatchedCount}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sources.length === 0 && (
        <p className="text-center text-gray-600 py-8">No sources found</p>
      )}
    </div>
  );
}

/**
 * Crawl summary cards widget
 * Displays crawl statistics and recent activity
 */

interface CrawlStats {
  totalCrawls: number;
  successfulCrawls: number;
  failedCrawls: number;
  averageItemsPerCrawl: number;
  lastCrawlTime: string | null;
}

export function CrawlSummaryCards() {
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) throw new Error('No session token');

        // Fetch recent crawl jobs
        const response = await fetch('/api/v1/admin/crawl-jobs?limit=100', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch stats');

        const data = await response.json();
        const jobs = data.crawlJobs || [];

        const successful = jobs.filter((j: any) => j.status === 'completed').length;
        const failed = jobs.filter((j: any) => j.status === 'failed').length;
        const avgItems = jobs.length > 0
          ? jobs.reduce((sum: number, j: any) => sum + (j.itemsProcessed || 0), 0) / jobs.length
          : 0;
        const lastCrawl = jobs.length > 0 ? jobs[0].startedAt : null;

        setStats({
          totalCrawls: jobs.length,
          successfulCrawls: successful,
          failedCrawls: failed,
          averageItemsPerCrawl: Math.round(avgItems),
          lastCrawlTime: lastCrawl,
        });
      } catch (err) {
        console.error('Failed to fetch crawl stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading || !stats) {
    return <div className="animate-pulse h-32 bg-gray-200 rounded"></div>;
  }

  const successRate = stats.totalCrawls > 0
    ? ((stats.successfulCrawls / stats.totalCrawls) * 100).toFixed(1)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Crawls */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <p className="text-sm font-medium text-blue-600">Total Crawls</p>
        <p className="text-2xl font-bold text-blue-900 mt-2">{stats.totalCrawls}</p>
      </div>

      {/* Success Rate */}
      <div className="bg-green-50 rounded-lg border border-green-200 p-4">
        <p className="text-sm font-medium text-green-600">Success Rate</p>
        <p className="text-2xl font-bold text-green-900 mt-2">{successRate}%</p>
      </div>

      {/* Failed Crawls */}
      <div className="bg-red-50 rounded-lg border border-red-200 p-4">
        <p className="text-sm font-medium text-red-600">Failed Crawls</p>
        <p className="text-2xl font-bold text-red-900 mt-2">{stats.failedCrawls}</p>
      </div>

      {/* Avg Items */}
      <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
        <p className="text-sm font-medium text-orange-600">Avg Items/Crawl</p>
        <p className="text-2xl font-bold text-orange-900 mt-2">{stats.averageItemsPerCrawl}</p>
      </div>
    </div>
  );
}
