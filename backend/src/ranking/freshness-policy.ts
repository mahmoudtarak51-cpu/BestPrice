export type FreshnessSnapshot = {
  lastSuccessfulUpdateAt: string;
  staleAfterAt: string;
  shopperVisible: boolean;
};

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function buildFreshnessSnapshot(input: {
  lastSuccessfulUpdateAt: string;
  now?: Date;
}): FreshnessSnapshot {
  const lastSuccessfulUpdateAt = new Date(input.lastSuccessfulUpdateAt);
  const staleAfterAt = new Date(lastSuccessfulUpdateAt.getTime() + TWELVE_HOURS_MS);
  const now = input.now ?? new Date();

  return {
    lastSuccessfulUpdateAt: lastSuccessfulUpdateAt.toISOString(),
    staleAfterAt: staleAfterAt.toISOString(),
    shopperVisible: staleAfterAt.getTime() >= now.getTime(),
  };
}

export function isOfferFresh(snapshot: FreshnessSnapshot): boolean {
  return snapshot.shopperVisible;
}