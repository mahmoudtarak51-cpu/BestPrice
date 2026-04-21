import { expect, test } from '@playwright/test';

test.describe('shopper search results', () => {
  test('supports English search with filters', async ({ page }) => {
    await page.goto('/en/search?q=iphone&brand=apple&category=phones');

    await expect(page.getByRole('heading', { name: /Search offers/i })).toBeVisible();
    await expect(page.locator('label[for="search-store"]')).toHaveText(/Store/i);

    const groupedSummary = page.getByText(/grouped products/i);
    if (await groupedSummary.count()) {
      await expect(groupedSummary).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /No fresh results yet/i })).toBeVisible();
    }
  });

  test('supports Arabic search', async ({ page }) => {
    await page.goto('/ar/search?q=سامسونج&category=phones');

    await expect(page.getByRole('heading', { name: /ابحث عن العروض|Search offers/i })).toBeVisible();
    await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
  });
});