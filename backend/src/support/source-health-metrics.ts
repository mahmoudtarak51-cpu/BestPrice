export type SourceHealthSnapshot = {
  adapterKey: string;
  freshnessHours: number;
  visibleOfferCount: number;
  staleOfferCount: number;
  recordedAt: string;
};

export type SourceHealthMetricSummary = {
  sourceCount: number;
  staleSourceCount: number;
  visibleOfferCount: number;
  staleOfferCount: number;
  recordedAt: string | null;
};

export class SourceHealthMetricStore {
  readonly #snapshots = new Map<string, SourceHealthSnapshot>();

  set(snapshot: SourceHealthSnapshot): void {
    this.#snapshots.set(snapshot.adapterKey, snapshot);
  }

  list(): SourceHealthSnapshot[] {
    return [...this.#snapshots.values()];
  }

  get(adapterKey: string): SourceHealthSnapshot | null {
    return this.#snapshots.get(adapterKey) ?? null;
  }

  summarize(options?: { staleAfterHours?: number }): SourceHealthMetricSummary {
    const staleAfterHours = options?.staleAfterHours ?? 12;
    const snapshots = this.list();

    return {
      sourceCount: snapshots.length,
      staleSourceCount: snapshots.filter(
        (snapshot) => snapshot.freshnessHours >= staleAfterHours,
      ).length,
      visibleOfferCount: snapshots.reduce(
        (total, snapshot) => total + snapshot.visibleOfferCount,
        0,
      ),
      staleOfferCount: snapshots.reduce(
        (total, snapshot) => total + snapshot.staleOfferCount,
        0,
      ),
      recordedAt: snapshots
        .map((snapshot) => snapshot.recordedAt)
        .sort()
        .at(-1) ?? null,
    };
  }
}

export function createSourceHealthMetricStore(): SourceHealthMetricStore {
  return new SourceHealthMetricStore();
}
