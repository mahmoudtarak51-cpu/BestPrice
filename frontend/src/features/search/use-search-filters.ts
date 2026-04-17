'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useSearchFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(name: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim().length === 0) {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return {
    searchParams,
    updateFilter,
  };
}