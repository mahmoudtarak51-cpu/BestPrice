import { describe, expect, it } from 'vitest';

import {
  buildFreshnessSnapshot,
  isOfferFresh,
} from '../../src/ranking/freshness-policy.js';

describe('freshness policy', () => {
  it('marks offers stale after 12 hours', () => {
    const snapshot = buildFreshnessSnapshot({
      lastSuccessfulUpdateAt: '2026-04-16T20:30:00.000Z',
      now: new Date('2026-04-17T09:00:00.000Z'),
    });

    expect(snapshot.staleAfterAt).toBe('2026-04-17T08:30:00.000Z');
    expect(snapshot.shopperVisible).toBe(false);
    expect(isOfferFresh(snapshot)).toBe(false);
  });

  it('keeps recent offers shopper-visible', () => {
    const snapshot = buildFreshnessSnapshot({
      lastSuccessfulUpdateAt: '2026-04-17T05:00:00.000Z',
      now: new Date('2026-04-17T10:00:00.000Z'),
    });

    expect(snapshot.shopperVisible).toBe(true);
    expect(isOfferFresh(snapshot)).toBe(true);
  });
});