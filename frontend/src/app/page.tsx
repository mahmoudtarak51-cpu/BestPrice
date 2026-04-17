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
        <a href="/en/search?q=iphone">Open English search</a>
        <a href="/ar/search?q=سامسونج">افتح البحث بالعربية</a>
      </div>
    </main>
  );
}