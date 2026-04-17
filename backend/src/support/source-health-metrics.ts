export type SourceHealthSnapshot = {
  adapterKey: string;
  freshnessHours: number;
  visibleOfferCount: number;
  staleOfferCount: number;
  recordedAt: string;
};

export class SourceHealthMetricStore {
  readonly #snapshots = new Map<string, SourceHealthSnapshot>();

  set(snapshot: SourceHealthSnapshot): void {
    this.#snapshots.set(snapshot.adapterKey, snapshot);
  }

  list(): SourceHealthSnapshot[] {
    return [...this.#snapshots.values()];
  }
}

export function createSourceHealthMetricStore(): SourceHealthMetricStore {
  return new SourceHealthMetricStore();
}