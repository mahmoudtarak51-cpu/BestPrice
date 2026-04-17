const arabicDiacritics = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g;
const arabicTatweel = /\u0640/g;
const latinPunctuation = /[^\p{L}\p{N}\s]/gu;
const repeatedWhitespace = /\s+/g;
const arabicLetterPattern = /[\u0600-\u06FF]/;
const latinLetterPattern = /[A-Za-z]/;

const arabicCharacterMap: Record<string, string> = {
  آ: 'ا',
  أ: 'ا',
  إ: 'ا',
  ى: 'ي',
  ة: 'ه',
  ؤ: 'و',
  ئ: 'ي',
};

const arabicIndicDigitsMap: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
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

  return result.replace(latinPunctuation, ' ').replace(repeatedWhitespace, ' ').trim();
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
