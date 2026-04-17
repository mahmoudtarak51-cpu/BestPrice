import type { SearchService } from '../search/search-service.js';

export async function runCrawlJob(input: {
  searchService: SearchService;
  scheduledAt?: Date;
}): Promise<void> {
  await input.searchService.refreshCatalog();
}