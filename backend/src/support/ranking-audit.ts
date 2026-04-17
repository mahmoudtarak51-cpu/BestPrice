export type RankingAuditEntry = {
  productId: string;
  offerId: string;
  rankingScore: number;
  reasonCodes: string[];
  recordedAt: string;
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
}

export function createRankingAuditStore(): RankingAuditStore {
  return new RankingAuditStore();
}