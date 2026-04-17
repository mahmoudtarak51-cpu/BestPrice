export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_METADATA: Record<
  AppLocale,
  { label: string; direction: 'ltr' | 'rtl' }
> = {
  en: {
    label: 'English',
    direction: 'ltr',
  },
  ar: {
    label: 'العربية',
    direction: 'rtl',
  },
};

export const UI_COPY = {
  en: {
    currency: 'EGP',
    searchPlaceholder: 'Search phones, laptops, TVs, and headphones',
    adminLabel: 'Internal Admin',
  },
  ar: {
    currency: 'ج.م',
    searchPlaceholder: 'ابحث عن الهواتف واللابتوبات والتلفزيونات والسماعات',
    adminLabel: 'مشرف داخلي',
  },
} as const;

export function resolveLocale(input?: string | null): AppLocale {
  if (input && SUPPORTED_LOCALES.includes(input as AppLocale)) {
    return input as AppLocale;
  }

  return DEFAULT_LOCALE;
}

export function localeDirection(locale: AppLocale): 'ltr' | 'rtl' {
  return LOCALE_METADATA[locale].direction;
}
