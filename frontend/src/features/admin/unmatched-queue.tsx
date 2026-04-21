'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

/**
 * Unmatched products queue widget
 * Displays list of products that failed to match to canonical products
 */

interface UnmatchedProduct {
  rawProductId: string;
  adapterId: string;
  title: string;
  price: number;
  url: string;
  crawledAt: string;
  failureReason: string | null;
}

interface UnmatchedQueueResponse {
  products: UnmatchedProduct[];
  total: number;
  page: number;
  limit: number;
}

export function UnmatchedQueue() {
  const [products, setProducts] = useState<UnmatchedProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAdapter, setFilterAdapter] = useState('');
  const [filterReason, setFilterReason] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) throw new Error('No session token');

        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...(filterAdapter && { adapterId: filterAdapter }),
          ...(filterReason && { failureReason: filterReason }),
        });

        const response = await fetch(`/api/v1/admin/unmatched-products?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch products');

        const data: UnmatchedQueueResponse = await response.json();
        setProducts(data.products);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [page, filterAdapter, filterReason]);

  const getReasonColor = (reason: string | null) => {
    switch (reason) {
      case 'PARSE_FAILURE':
        return 'bg-red-100 text-red-800';
      case 'NO_MATCH':
        return 'bg-yellow-100 text-yellow-800';
      case 'AMBIGUOUS':
        return 'bg-orange-100 text-orange-800';
      case 'GTIN_COLLISION':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Unmatched Products Queue</h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Adapter</label>
          <select
            name="adapterId"
            value={filterAdapter}
            onChange={e => {
              setFilterAdapter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All adapters</option>
            <option value="retailer-a">Retailer A</option>
            <option value="retailer-b">Retailer B</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Reason</label>
          <select
            name="failureReason"
            value={filterReason}
            onChange={e => {
              setFilterReason(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All reasons</option>
            <option value="PARSE_FAILURE">Parse Failure</option>
            <option value="NO_MATCH">No Match</option>
            <option value="AMBIGUOUS">Ambiguous</option>
            <option value="GTIN_COLLISION">GTIN Collision</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Source</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-900">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Reason</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr
                    key={product.rawProductId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                    data-adapter={product.adapterId}
                  >
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title={product.title}
                      >
                        {product.title.substring(0, 50)}...
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.adapterId}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">EGP {product.price}</td>
                    <td className="px-4 py-3">
                      {product.failureReason && (
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getReasonColor(product.failureReason)}`}>
                          {product.failureReason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} products
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {page} of {Math.max(1, Math.ceil(total / 20))}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {products.length === 0 && !isLoading && (
        <p className="text-center text-gray-600 py-8">No unmatched products</p>
      )}
    </div>
  );
}

/**
 * Manual crawl form widget
 * Allows admin to trigger manual crawls for selected adapters
 */

export function ManualCrawlForm() {
  const [selectedAdapters, setSelectedAdapters] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const adapters = [
    { id: 'retailer-a', name: 'Retailer A' },
    { id: 'retailer-b', name: 'Retailer B' },
  ];

  const handleAdapterToggle = (adapterId: string) => {
    setSelectedAdapters(prev =>
      prev.includes(adapterId)
        ? prev.filter(id => id !== adapterId)
        : [...prev, adapterId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (selectedAdapters.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one adapter' });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('adminSessionToken');
      if (!token) throw new Error('No session token');

      const response = await fetch('/api/v1/admin/crawl-jobs/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adapterIds: selectedAdapters,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger crawl');
      }

      setMessage({ type: 'success', text: 'Crawl job enqueued' });
      setSelectedAdapters([]);

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to trigger crawl',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Crawl</h2>

      <form onSubmit={handleSubmit}>
        {/* Adapter Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Select Adapters</label>
          <div className="space-y-3">
            {adapters.map(adapter => (
              <label key={adapter.id} className="flex items-center gap-3">
                <input
                  value={adapter.id}
                  type="checkbox"
                  checked={selectedAdapters.includes(adapter.id)}
                  onChange={() => handleAdapterToggle(adapter.id)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700">{adapter.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || selectedAdapters.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {isSubmitting ? 'Triggering...' : 'Trigger Crawl'}
        </button>
      </form>
    </div>
  );
}
