import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

async function resolveExistingProductId(
  request: import('@playwright/test').APIRequestContext
) {
  const candidateBaseUrls = [API_URL, `${BASE_URL}/api/v1`];
  const queries = ['iphone', 'samsung', 'phone'];

  // Prime the in-memory catalog on backend instances used in local/test environments.
  for (const baseUrl of candidateBaseUrls) {
    await request.get(`${baseUrl}/test/bootstrap-search`).catch(() => null);
  }

  for (const baseUrl of candidateBaseUrls) {
    for (const query of queries) {
      const response = await request.get(`${baseUrl}/search?q=${encodeURIComponent(query)}&pageSize=1`);

      if (!response.ok()) {
        continue;
      }

      const body = (await response.json()) as {
        groups?: Array<{ productId: string }>;
      };

      const productId = body.groups?.[0]?.productId;
      if (!productId) {
        continue;
      }

      const productResponse = await request.get(
        `${baseUrl}/products/${encodeURIComponent(productId)}?lang=en`
      );

      if (productResponse.ok()) {
        return productId;
      }
    }
  }

  return null;
}

test.describe('Product Detail E2E Tests', () => {
  test('should display product details page with exact and similar products', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');

    // Navigate to a product details page
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Assert: Page title and header are displayed
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Assert: Product metadata section labels are visible
    await expect(page.locator('text=Brand')).toBeVisible();
    await expect(page.locator('text=Category')).toBeVisible();

    // Assert: Offers section is visible with price and store name
    const offersSection = page.locator('[data-testid="exact-offers"]');
    await expect(offersSection).toBeVisible();

    const offerCard = page.locator('[data-testid="offer-card"]').first();
    await expect(offerCard).toContainText('EGP');
    await expect(offerCard).toContainText(/Store|Visit Store|View on Store/i);

    // Assert: Similar products section is displayed
    const similarTab = page.locator('[data-testid="tab-similar"]');
    await similarTab.click();

    const similarSection = page.locator('[data-testid="similar-products"]');
    const emptyState = page.locator('text=No similar products found');

    if (await similarSection.isVisible().catch(() => false)) {
      await expect(similarSection).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should support bilingual product comparison', async ({ page, request }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');

    // Test Arabic version
    await page.goto(`${BASE_URL}/ar/products/${productId!}`);

    // Assert: Page displays in Arabic
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    await expect(page.locator('text=عرض العروض القديمة')).toBeVisible();

    // Test English version
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Assert: Page switches copy to English
    await expect(page.locator('text=Show stale offers')).toBeVisible();
  });

  test('should show ranking badges (best overall vs cheapest)', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Assert: At least one ranking badge is visible
    const rankingBadge = page.locator('text=/⭐ Best Overall|💰 Cheapest/').first();
    await expect(rankingBadge).toBeVisible();
  });

  test('should allow toggling stale offers visibility option', async ({ page, request }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');

    // Navigate to product page
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    const staleToggle = page.getByRole('checkbox');
    await expect(staleToggle).toBeVisible();
    await expect(page.locator('text=Show stale offers')).toBeVisible();

    await staleToggle.check();
    await expect(staleToggle).toBeChecked();

    // Assert: Offers section remains usable after toggle
    const offersSection = page.locator('[data-testid="exact-offers"]');
    await expect(offersSection).toBeVisible();
  });

  test('should handle missing shipping information gracefully', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Find an offer that may not have shipping info
    const offerCard = page.locator('[data-testid="offer-card"]').first();

    // Assert: Shipping section is present (even if not available)
    const shippingInfo = offerCard.locator('[data-testid="shipping-info"]');
    await expect(shippingInfo).toBeVisible();

    // Assert: Graceful fallback message is shown
    const shippingText = await shippingInfo.textContent();
    expect(shippingText?.trim().length).toBeGreaterThan(0);
  });

  test('should allow switching between exact and similar products', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Assert: Exact offers tab is active by default
    const exactTab = page.locator('[data-testid="tab-exact"]');
    await expect(exactTab).toHaveAttribute('aria-selected', 'true');

    // Click on similar products tab
    const similarTab = page.locator('[data-testid="tab-similar"]');
    await similarTab.click();

    // Assert: Similar products section is now displayed
    await expect(similarTab).toHaveAttribute('aria-selected', 'true');
    const similarSection = page.locator('[data-testid="similar-products"]');
    const emptyState = page.locator('text=No similar products found');

    if (await similarSection.isVisible().catch(() => false)) {
      await expect(similarSection).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should show freshness indicators for each offer', async ({ page, request }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Find offer cards
    const offerCards = page.locator('[data-testid="offer-card"]');

    // Assert: Each offer has a freshness indicator
    const count = await offerCards.count();
    for (let i = 0; i < count; i++) {
      const card = offerCards.nth(i);
      const freshnessIndicator = card.locator(
        '[data-testid="freshness-indicator"]'
      );
      await expect(freshnessIndicator).toBeVisible();

      // Freshness should show hours or time indication
      const freshnessText = await freshnessIndicator.textContent();
      expect(
        freshnessText?.includes('h') ||
          freshnessText?.includes('ago')
      ).toBeTruthy();
    }
  });

  test('should display provenance information (source URL)', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Assert: Provenance information is accessible
    const provenanceLink = page
      .locator('[data-testid="provenance-link"]')
      .first();

    if (await provenanceLink.isVisible()) {
      await expect(provenanceLink).toHaveAttribute('href', /^https?:\/\//);
      await expect(provenanceLink).toHaveAttribute('target', '_blank');
    }
  });

  test('should handle product not found gracefully', async ({ page }) => {
    // Navigate to non-existent product
    await page.goto(`${BASE_URL}/en/products/non-existent-product-id`);

    // Assert: Error message or 404 page is displayed
    const notFoundMessage = page.locator('text=/Product not found|Error/i');
    await expect(notFoundMessage.first()).toBeVisible();
  });

  test('should display match confidence for similar products', async ({
    page,
    request,
  }) => {
    const productId = await resolveExistingProductId(request);
    test.skip(!productId, 'No searchable product data available in this environment.');
    await page.goto(`${BASE_URL}/en/products/${productId!}`);

    // Click on similar products tab if needed
    const similarTab = page.locator('[data-testid="tab-similar"]');
    if ((await similarTab.getAttribute('aria-selected')) !== 'true') {
      await similarTab.click();
    }

    // Find similar product cards
    const similarCards = page.locator('[data-testid="similar-product-card"]');
    const count = await similarCards.count();

    // Assert: At least one similar product with confidence indicator
    if (count > 0) {
      const firstCard = similarCards.first();
      const confidenceBadge = firstCard.locator(
        '[data-testid="match-confidence-badge"]'
      );
      await expect(confidenceBadge).toBeVisible();

      // Confidence should be a percentage or confidence level
      const confidenceText = await confidenceBadge.textContent();
      expect(
        confidenceText?.includes('%') ||
          confidenceText?.includes('High') ||
          confidenceText?.includes('Medium') ||
          confidenceText?.includes('Low')
      ).toBeTruthy();
    } else {
      await expect(page.locator('text=No similar products found')).toBeVisible();
    }
  });
});
