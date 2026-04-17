import type { SearchService } from '../search/search-service.js';

export async function runSearchRefreshJob(input: {
  searchService: SearchService;
  refreshedAt?: Date;
}): Promise<void> {
  await input.searchService.bootstrap();
}