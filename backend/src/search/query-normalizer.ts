const arabicDiacritics = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g;
const arabicTatweel = /\u0640/g;
const latinPunctuation = /[^\p{L}\p{N}\s]/gu;
const repeatedWhitespace = /\s+/g;
const arabicLetterPattern = /[\u0600-\u06FF]/;
const latinLetterPattern = /[A-Za-z]/;

const arabicCharacterMap: Record<string, string> = {
  '\u0622': '\u0627',
  '\u0623': '\u0627',
  '\u0625': '\u0627',
  '\u0649': '\u064A',
  '\u0629': '\u0647',
  '\u0624': '\u0648',
  '\u0626': '\u064A',
};

const arabicIndicDigitsMap: Record<string, string> = {
  '\u0660': '0',
  '\u0661': '1',
  '\u0662': '2',
  '\u0663': '3',
  '\u0664': '4',
  '\u0665': '5',
  '\u0666': '6',
  '\u0667': '7',
  '\u0668': '8',
  '\u0669': '9',
  '\u06F0': '0',
  '\u06F1': '1',
  '\u06F2': '2',
  '\u06F3': '3',
  '\u06F4': '4',
  '\u06F5': '5',
  '\u06F6': '6',
  '\u06F7': '7',
  '\u06F8': '8',
  '\u06F9': '9',
};

export type QueryLanguage = 'ar' | 'en' | 'mixed' | 'unknown';

export type NormalizedQuery = {
  raw: string;
  normalized: string;
  detectedLanguage: QueryLanguage;
  tokens: string[];
};

export function detectQueryLanguage(query: string): QueryLanguage {
  const hasArabic = arabicLetterPattern.test(query);
  const hasLatin = latinLetterPattern.test(query);

  if (hasArabic && hasLatin) {
    return 'mixed';
  }

  if (hasArabic) {
    return 'ar';
  }

  if (hasLatin) {
    return 'en';
  }

  return 'unknown';
}

export function normalizeArabicText(input: string): string {
  let result = input.trim();

  result = result.replace(arabicDiacritics, '');
  result = result.replace(arabicTatweel, '');
  result = result
    .split('')
    .map((character) => arabicCharacterMap[character] ?? character)
    .join('');
  result = result
    .split('')
    .map((character) => arabicIndicDigitsMap[character] ?? character)
    .join('');

  return result
    .replace(latinPunctuation, ' ')
    .replace(repeatedWhitespace, ' ')
    .trim();
}

export function normalizeLatinText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(latinPunctuation, ' ')
    .replace(repeatedWhitespace, ' ')
    .trim();
}

export function normalizeQuery(rawQuery: string): NormalizedQuery {
  const detectedLanguage = detectQueryLanguage(rawQuery);
  const normalized =
    detectedLanguage === 'ar'
      ? normalizeArabicText(rawQuery)
      : detectedLanguage === 'mixed'
        ? `${normalizeArabicText(rawQuery)} ${normalizeLatinText(rawQuery)}`
            .replace(repeatedWhitespace, ' ')
            .trim()
        : normalizeLatinText(rawQuery);

  return {
    raw: rawQuery,
    normalized,
    detectedLanguage,
    tokens: normalized.length > 0 ? normalized.split(' ') : [],
  };
}
