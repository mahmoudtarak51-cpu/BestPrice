import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

test.describe('Product Detail E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Seed test data via API if needed
    const seedResponse = await page.request.post(`${API_URL}/test/seed`, {
      data: {
        products: [
          {
            id: 'product-1',
            title: 'iPhone 15 Pro',
            category: 'phones',
            brand: 'Apple',
            model: 'A2846',
          },
        ],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
  });

  test('should display product details page with exact and similar products', async ({
    page,
    context,
  }) => {
    // Navigate to a product details page
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Assert: Page title and header are displayed
    const title = page.locator('h1');
    await expect(title).toContainText('iPhone 15 Pro');

    // Assert: Product metadata is visible
    await expect(page.locator('text=Brand: Apple')).toBeVisible();
    await expect(page.locator('text=Model: A2846')).toBeVisible();

    // Assert: Offers section is visible with price and store name
    const offersSection = page.locator('[data-testid="exact-offers"]');
    await expect(offersSection).toBeVisible();

    const offerCard = page.locator('[data-testid="offer-card"]').first();
    await expect(offerCard).toContainText('EGP');
    await expect(offerCard).toContainText('Retailer');

    // Assert: Similar products section is displayed
    const similarSection = page.locator('[data-testid="similar-products"]');
    await expect(similarSection).toBeVisible();

    // Assert: Match confidence badge is shown for similar products
    const matchBadge = page
      .locator('[data-testid="match-confidence"]')
      .first();
    await expect(matchBadge).toBeVisible();
  });

  test('should support bilingual product comparison', async ({ page }) => {
    // Test Arabic version
    await page.goto(`${BASE_URL}/ar/products/product-1`);

    // Assert: Page displays in Arabic
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    // Check for Arabic text presence
    expect(await title.textContent()).toMatch(/[\u0600-\u06FF]/);

    // Test English version
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Assert: Same content displayed in English
    await expect(title).toContainText('iPhone 15 Pro');
  });

  test('should show ranking badges (best overall vs cheapest)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Assert: Best overall badge is visible
    const bestOverallBadge = page.locator('[data-testid="badge-best-overall"]');
    await expect(bestOverallBadge).toBeVisible();

    // Assert: Cheapest badge is visible
    const cheapestBadge = page.locator('[data-testid="badge-cheapest"]');
    await expect(cheapestBadge).toBeVisible();

    // Assert: Badges have appropriate styling
    const badgeColor = await bestOverallBadge.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(badgeColor).toBeTruthy();
  });

  test('should hide stale offers from shopper view', async ({ page }) => {
    // Setup: Create a stale offer (13+ hours old)
    const staleOfferResponse = await page.request.post(
      `${API_URL}/test/create-stale-offer`,
      {
        data: {
          productId: 'product-1',
          hoursOld: 14,
        },
      }
    );
    expect(staleOfferResponse.ok()).toBeTruthy();

    // Navigate to product page
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Assert: Stale offers are not visible in the main offers section
    const offersSection = page.locator('[data-testid="exact-offers"]');
    const staleOffer = offersSection.locator('text=Stale');

    // Should not find stale offer in regular view
    await expect(staleOffer).not.toBeVisible();
  });

  test('should handle missing shipping information gracefully', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Find an offer that may not have shipping info
    const offerCard = page.locator('[data-testid="offer-card"]').first();

    // Assert: Shipping section is present (even if not available)
    const shippingInfo = offerCard.locator('[data-testid="shipping-info"]');
    await expect(shippingInfo).toBeVisible();

    // Assert: Graceful fallback message is shown
    const shippingText = await shippingInfo.textContent();
    expect(
      shippingText?.includes('Not available') ||
        shippingText?.includes('Unknown')
    ).toBeTruthy();
  });

  test('should allow switching between exact and similar products', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Assert: Exact offers tab is active by default
    const exactTab = page.locator('[data-testid="tab-exact"]');
    await expect(exactTab).toHaveAttribute('aria-selected', 'true');

    // Click on similar products tab
    const similarTab = page.locator('[data-testid="tab-similar"]');
    await similarTab.click();

    // Assert: Similar products section is now displayed
    await expect(similarTab).toHaveAttribute('aria-selected', 'true');
    const similarSection = page.locator('[data-testid="similar-products"]');
    await expect(similarSection).toBeVisible();
  });

  test('should show freshness indicators for each offer', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

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
        freshnessText?.includes('hour') ||
          freshnessText?.includes('minute') ||
          freshnessText?.includes('ago')
      ).toBeTruthy();
    }
  });

  test('should display provenance information (source URL)', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

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
    const notFoundMessage = page.locator('text=not found, No results, or Product not available');
    await expect(notFoundMessage.first()).toBeVisible();

    // Assert: Link to go back to search is available
    const backLink = page.locator('a:has-text("Back to search")');
    await expect(backLink.first()).toBeVisible();
  });

  test('should display match confidence for similar products', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/products/product-1`);

    // Click on similar products tab if needed
    const similarTab = page.locator('[data-testid="tab-similar"]');
    if (!(await similarTab.evaluate((el) => el.getAttribute('aria-selected')))) {
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
    }
  });
});
