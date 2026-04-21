export type RankingAuditEntry = {
  productId: string;
  offerId: string;
  rankingScore: number;
  reasonCodes: string[];
  recordedAt: string;
};

export type RankingAuditSummary = {
  totalEntries: number;
  uniqueProductCount: number;
  lastRecordedAt: string | null;
  reasonCodeCounts: Record<string, number>;
  topProducts: Array<{
    productId: string;
    entryCount: number;
    latestRecordedAt: string;
  }>;
};

export class RankingAuditStore {
  readonly #entries: RankingAuditEntry[] = [];

  append(entry: RankingAuditEntry): void {
    this.#entries.unshift(entry);
    this.#entries.splice(250);
  }

  list(): RankingAuditEntry[] {
    return [...this.#entries];
  }

  listByProduct(productId: string): RankingAuditEntry[] {
    return this.#entries.filter((entry) => entry.productId === productId);
  }

  summarize(limit = 5): RankingAuditSummary {
    const reasonCodeCounts: Record<string, number> = {};
    const productCounts = new Map<
      string,
      { entryCount: number; latestRecordedAt: string }
    >();

    for (const entry of this.#entries) {
      for (const reasonCode of entry.reasonCodes) {
        reasonCodeCounts[reasonCode] = (reasonCodeCounts[reasonCode] ?? 0) + 1;
      }

      const current = productCounts.get(entry.productId);

      if (!current) {
        productCounts.set(entry.productId, {
          entryCount: 1,
          latestRecordedAt: entry.recordedAt,
        });
        continue;
      }

      productCounts.set(entry.productId, {
        entryCount: current.entryCount + 1,
        latestRecordedAt:
          current.latestRecordedAt > entry.recordedAt
            ? current.latestRecordedAt
            : entry.recordedAt,
      });
    }

    return {
      totalEntries: this.#entries.length,
      uniqueProductCount: productCounts.size,
      lastRecordedAt: this.#entries[0]?.recordedAt ?? null,
      reasonCodeCounts,
      topProducts: [...productCounts.entries()]
        .map(([productId, details]) => ({
          productId,
          entryCount: details.entryCount,
          latestRecordedAt: details.latestRecordedAt,
        }))
        .sort((left, right) => right.entryCount - left.entryCount)
        .slice(0, limit),
    };
  }
}

export function createRankingAuditStore(): RankingAuditStore {
  return new RankingAuditStore();
}
