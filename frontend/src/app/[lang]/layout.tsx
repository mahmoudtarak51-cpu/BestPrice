import type { ReactNode } from 'react';
import type { AppLocale } from '../../i18n/config';
import { localeDirection, resolveLocale } from '../../i18n/config';

export default async function LocalizedLayout(props: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const params = await props.params;
  const locale = resolveLocale(params.lang) as AppLocale;

  return (
    <section dir={localeDirection(locale)} lang={locale}>
      {props.children}
    </section>
  );
}