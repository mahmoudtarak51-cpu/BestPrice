import { eq } from 'drizzle-orm';

import { createDatabaseClient } from '../client.js';
import { brands, categories, launchCategorySlugs } from '../schema.js';
import { loadConfig } from '../../support/config.js';
import { isMainModule } from '../../support/runtime.js';

const categorySeed = [
  { slug: 'phones', nameEn: 'Phones', nameAr: 'هواتف' },
  { slug: 'laptops', nameEn: 'Laptops', nameAr: 'لابتوبات' },
  { slug: 'headphones', nameEn: 'Headphones', nameAr: 'سماعات' },
  { slug: 'tvs', nameEn: 'TVs', nameAr: 'تلفزيونات' },
] as const satisfies ReadonlyArray<{
  slug: (typeof launchCategorySlugs)[number];
  nameEn: string;
  nameAr: string;
}>;

const brandSeed = [
  {
    slug: 'apple',
    canonicalName: 'Apple',
    aliasesJson: {
      ar: ['ابل', 'أبل'],
      en: ['apple'],
      transliterations: ['ابل'],
    },
  },
  {
    slug: 'samsung',
    canonicalName: 'Samsung',
    aliasesJson: {
      ar: ['سامسونج'],
      en: ['samsung'],
      transliterations: ['samsong'],
    },
  },
  {
    slug: 'sony',
    canonicalName: 'Sony',
    aliasesJson: {
      ar: ['سوني'],
      en: ['sony'],
      transliterations: ['soony'],
    },
  },
  {
    slug: 'lenovo',
    canonicalName: 'Lenovo',
    aliasesJson: {
      ar: ['لينوفو'],
      en: ['lenovo'],
      transliterations: ['lenovo'],
    },
  },
  {
    slug: 'hp',
    canonicalName: 'HP',
    aliasesJson: {
      ar: ['اتش بي', 'إتش بي'],
      en: ['hp', 'hewlett packard'],
      transliterations: ['hp'],
    },
  },
] as const;

export async function seedCatalog(databaseUrl = loadConfig().databaseUrl) {
  const database = createDatabaseClient(databaseUrl);

  try {
    for (const category of categorySeed) {
      const existing = await database.db.query.categories.findFirst({
        where: eq(categories.slug, category.slug),
      });

      if (!existing) {
        await database.db.insert(categories).values(category);
      }
    }

    for (const brand of brandSeed) {
      const existing = await database.db.query.brands.findFirst({
        where: eq(brands.slug, brand.slug),
      });

      if (!existing) {
        await database.db.insert(brands).values(brand);
      }
    }
  } finally {
    await database.close();
  }
}

if (isMainModule(import.meta.url)) {
  void seedCatalog()
    .then(() => {
      console.log('Catalog seed completed successfully.');
    })
    .catch((error: unknown) => {
      console.error('Catalog seed failed.', error);
      process.exitCode = 1;
    });
}
