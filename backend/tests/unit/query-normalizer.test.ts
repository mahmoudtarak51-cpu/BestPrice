import { describe, expect, it } from 'vitest';

import {
  detectQueryLanguage,
  normalizeArabicText,
  normalizeQuery,
} from '../../src/search/query-normalizer.js';

describe('query normalizer', () => {
  it('normalizes Arabic diacritics, tatweel, and Indic digits', () => {
    const normalized = normalizeArabicText(
      '\u0622\u064A\u0652\u0641\u0648\u0646\u0640 \u0661\u0665',
    );

    expect(normalized).toBe('\u0627\u064A\u0641\u0648\u0646 15');
  });

  it('detects mixed Arabic and Latin input', () => {
    expect(
      detectQueryLanguage('\u0633\u0627\u0645\u0633\u0648\u0646\u062C S24'),
    ).toBe('mixed');
  });

  it('keeps mixed-language model tokens searchable', () => {
    const normalized = normalizeQuery(
      '\u0633\u0627\u0645\u0633\u0648\u0646\u062C S24 Ultra',
    );

    expect(normalized.detectedLanguage).toBe('mixed');
    expect(normalized.tokens).toContain('s24');
    expect(normalized.normalized).toContain('\u0633\u0627\u0645\u0633\u0648\u0646\u062C');
  });
});
