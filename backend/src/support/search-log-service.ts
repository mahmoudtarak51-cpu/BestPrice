export type SearchLogEntry = {
  queryText: string;
  normalizedQuery: string;
  detectedLanguage: 'ar' | 'en' | 'mixed' | 'unknown';
  filters: Record<string, unknown>;
  resultCount: number;
  latencyMs: number;
  createdAt: string;
};

export class SearchLogService {
  readonly #entries: SearchLogEntry[] = [];

  record(entry: SearchLogEntry): void {
    this.#entries.unshift(entry);
    this.#entries.splice(100);
  }

  list(): SearchLogEntry[] {
    return [...this.#entries];
  }
}

export function createSearchLogService(): SearchLogService {
  return new SearchLogService();
}