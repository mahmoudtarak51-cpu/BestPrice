import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="localeLanding">
      <p className="heroEyebrow">BestPrice MVP</p>
      <h1>Bilingual price discovery for Egypt</h1>
      <p>
        Start with the shopper search flow in English or Arabic. The interface
        surfaces grouped products, best-overall recommendations, and price-aware
        filters.
      </p>
      <div className="localeLinks">
        <Link href="/en/search?q=iphone">Open English search</Link>
        <Link href="/ar/search?q=%D8%B3%D8%A7%D9%85%D8%B3%D9%88%D9%86%D8%AC">افتح البحث بالعربية</Link>
      </div>
    </main>
  );
}