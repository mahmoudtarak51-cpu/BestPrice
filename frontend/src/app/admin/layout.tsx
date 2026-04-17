'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin dashboard layout component
 * Provides authentication guard and navigation for admin features
 */

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    // Verify admin session on mount
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('adminSessionToken');
        
        if (!token) {
          router.push('/admin/login');
          return;
        }

        const response = await fetch('/api/v1/admin/auth/status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('adminSessionToken');
          router.push('/admin/login');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setAdminEmail(data.email);
          setIsAuthenticated(true);
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Session verification failed:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, [router]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('adminSessionToken');
      if (token) {
        await fetch('/api/v1/admin/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('adminSessionToken');
      router.push('/admin/login');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">BestPrice Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{adminEmail}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <a
              href="/admin/dashboard"
              className="px-1 py-4 text-sm font-medium text-gray-900 border-b-2 border-blue-500 hover:border-blue-600"
            >
              Dashboard
            </a>
            <a
              href="/admin/sources"
              className="px-1 py-4 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-300"
            >
              Source Health
            </a>
            <a
              href="/admin/crawl-jobs"
              className="px-1 py-4 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-300"
            >
              Crawl History
            </a>
            <a
              href="/admin/unmatched"
              className="px-1 py-4 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900 hover:border-gray-300"
            >
              Unmatched Products
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>&copy; 2026 BestPrice. Admin operations dashboard.</p>
        </div>
      </footer>
    </div>
  );
}
