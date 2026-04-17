import { describe, expect, it } from 'vitest';

import { runSearchRefreshJob } from '../../src/jobs/search-index-job.js';
import { runCrawlJob } from '../../src/jobs/crawl-job.js';
import { createSearchService } from '../../src/search/search-service.js';

describe('crawl to search flow', () => {
  it('loads both retailers, groups equivalent offers, and hides stale offers', async () => {
    const now = new Date('2026-04-17T10:00:00.000Z');
    const searchService = createSearchService({
      now: () => now,
    });

    await runCrawlJob({
      searchService,
      scheduledAt: now,
    });
    await runSearchRefreshJob({
      searchService,
      refreshedAt: now,
    });

    const englishResults = await searchService.search({
      query: 'iphone 15',
      lang: 'en',
    });
    const arabicResults = await searchService.search({
      query: 'ايفون 15',
      lang: 'ar',
    });
    const staleResults = await searchService.search({
      query: 'stale tv',
      lang: 'en',
    });

    expect(englishResults.totalResults).toBeGreaterThan(0);
    expect(arabicResults.groups[0]?.productId).toBe(englishResults.groups[0]?.productId);
    expect(englishResults.groups[0]?.exactOfferCount).toBe(2);
    expect(englishResults.groups[0]?.badges).toContain('best_overall');
    expect(englishResults.groups[0]?.cheapestOffer?.store).toBe('Retailer A');
    expect(staleResults.totalResults).toBe(0);
  });
});