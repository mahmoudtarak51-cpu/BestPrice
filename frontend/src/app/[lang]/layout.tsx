import type { AppLocale } from '../../i18n/config.js';
import { localeDirection, resolveLocale } from '../../i18n/config.js';

export default function LocalizedLayout(props: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const locale = resolveLocale(props.params.lang) as AppLocale;

  return (
    <section dir={localeDirection(locale)} lang={locale}>
      {props.children}
    </section>
  );
}