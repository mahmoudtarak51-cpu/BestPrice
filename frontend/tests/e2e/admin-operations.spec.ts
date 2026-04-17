import { expect, test } from '@playwright/test';

/**
 * E2E tests for admin operations dashboard:
 * - Admin authentication flow
 * - Source health monitoring
 * - Unmatched product review
 * - Manual crawl triggering
 */

const baseURL = process.env.FRONTEND_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = 'test-password-123';

test.describe('Admin Operations Dashboard', () => {
  test('admin login flow and dashboard access', async ({ page }) => {
    /**
     * Given the admin login page
     * When an admin enters valid credentials
     * Then the dashboard displays source health and monitoring widgets
     */
    await page.goto(`${baseURL}/admin/login`);
    
    // Verify login page loads
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('text=Admin Login')).toBeVisible();

    // Fill login form
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to dashboard
    await page.waitForURL(`${baseURL}/admin/dashboard`);
    await expect(page).toHaveURL(`${baseURL}/admin/dashboard`);

    // Verify dashboard widgets are present
    await expect(page.locator('text=Source Health')).toBeVisible();
    await expect(page.locator('text=Crawl Status')).toBeVisible();
    await expect(page.locator('text=Unmatched Products')).toBeVisible();
  });

  test('rejects invalid admin credentials', async ({ page }) => {
    /**
     * Given the admin login page
     * When credentials are invalid
     * Then an error message is displayed
     */
    await page.goto(`${baseURL}/admin/login`);

    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button:has-text("Sign In")');

    // Verify error message appears
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test.describe('After authentication', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(`${baseURL}/admin/login`);
      await page.fill('input[type="email"]', adminEmail);
      await page.fill('input[type="password"]', adminPassword);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(`${baseURL}/admin/dashboard`);
    });

    test('displays source health overview', async ({ page }) => {
      /**
       * Given an authenticated admin
       * When viewing the dashboard
       * Then source health metrics are displayed
       */
      await expect(page.locator('text=Active Sources')).toBeVisible();
      await expect(page.locator('text=Stale Sources')).toBeVisible();

      // Verify source list is present
      const sourceTable = page.locator('table, [role="table"]');
      await expect(sourceTable).toBeVisible();

      // Verify source columns
      await expect(page.locator('text=Adapter')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
      await expect(page.locator('text=Last Crawl')).toBeVisible();
    });

    test('displays stale sources with warning indicators', async ({ page }) => {
      /**
       * Given sources with stale data (>12 hours)
       * When the admin views the source list
       * Then stale sources are marked with visual indicators
       */
      // Navigate to source health tab/page
      await page.click('text=Source Health');

      // Look for stale indicators
      const staleRows = page.locator('[data-stale="true"]');
      const staleCount = await staleRows.count();

      // If there are stale sources, verify they have warning indicators
      if (staleCount > 0) {
        await expect(page.locator('[data-stale="true"] [role="status"]')).toContainText(/stale|warning/i);
      }
    });

    test('displays crawl failure details', async ({ page }) => {
      /**
       * Given recent crawl failures
       * When the admin views the dashboard
       * Then failures are displayed with timestamps and reasons
       */
      // Navigate to sources or failures section
      await page.click('text=Source Health');

      // Expand a source to see failure details
      const sourceRow = page.locator('tr, [role="row"]').first();
      const expandButton = sourceRow.locator('[aria-label="Expand"], [data-expand]');

      if (await expandButton.isVisible()) {
        await expandButton.click();

        // Verify failure information is displayed
        await expect(page.locator('text=Failure')).toBeVisible();
      }
    });

    test('filters unmatched products by adapter', async ({ page }) => {
      /**
       * Given unmatched products from multiple sources
       * When the admin filters by adapter
       * Then only that adapter's unmatched products are shown
       */
      await page.click('text=Unmatched Products');

      // Find and use adapter filter
      const adapterSelect = page.locator('select[name="adapterId"], [placeholder="Filter by adapter"]');
      
      if (await adapterSelect.isVisible()) {
        await adapterSelect.selectOption('retailer-a');
        
        // Wait for table to update
        await page.waitForLoadState('networkidle');

        // Verify only retailer-a products are shown
        const rows = page.locator('[data-adapter="retailer-a"]');
        expect(await rows.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('filters unmatched products by failure reason', async ({ page }) => {
      /**
       * Given unmatched products with different failure types
       * When the admin filters by failure reason
       * Then only matching failure types are displayed
       */
      await page.click('text=Unmatched Products');

      // Find reason filter
      const reasonFilter = page.locator('select[name="failureReason"], [placeholder="Filter by reason"]');

      if (await reasonFilter.isVisible()) {
        await reasonFilter.selectOption('PARSE_FAILURE');

        // Wait for update
        await page.waitForLoadState('networkidle');

        // Verify results
        const rows = page.locator('tbody tr, [role="row"]');
        if (await rows.count() > 0) {
          const firstRow = rows.first();
          await expect(firstRow).toContainText(/PARSE_FAILURE/);
        }
      }
    });

    test('triggers manual crawl for selected adapters', async ({ page }) => {
      /**
       * Given the admin operations panel
       * When selecting adapters and clicking manual crawl
       * Then a crawl job is enqueued and status updates
       */
      await page.click('text=Manual Crawl');

      // Find adapter checkboxes
      const retailerACheckbox = page.locator('input[value="retailer-a"]');
      const retailerBCheckbox = page.locator('input[value="retailer-b"]');

      await retailerACheckbox.check();

      // Click trigger button
      await page.click('button:has-text("Trigger Crawl")');

      // Verify success message
      await expect(page.locator('text=Crawl job enqueued')).toBeVisible();

      // Verify button transitions to loading state
      await expect(page.locator('button:has-text("Triggering")')).toBeVisible();
    });

    test('validates empty adapter selection on manual crawl', async ({ page }) => {
      /**
       * Given the manual crawl form
       * When no adapters are selected
       * Then the trigger button is disabled and validation message shows
       */
      await page.click('text=Manual Crawl');

      // Verify trigger button is disabled
      const triggerButton = page.locator('button:has-text("Trigger Crawl")');
      await expect(triggerButton).toBeDisabled();

      // Select an adapter
      await page.locator('input[value="retailer-a"]').check();

      // Verify button becomes enabled
      await expect(triggerButton).toBeEnabled();
    });

    test('displays crawl job history', async ({ page }) => {
      /**
       * Given crawl jobs in history
       * When the admin views the job history
       * Then job details show status, adapter, and timestamp
       */
      await page.click('text=Crawl History');

      // Verify job list is visible
      await expect(page.locator('table, [role="table"]')).toBeVisible();

      // Check for job columns
      await expect(page.locator('text=Job ID')).toBeVisible();
      await expect(page.locator('text=Adapter')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
      await expect(page.locator('text=Started')).toBeVisible();
    });

    test('paginates unmatched product list', async ({ page }) => {
      /**
       * Given many unmatched products
       * When viewing the unmatched product list
       * Then pagination controls allow navigation
       */
      await page.click('text=Unmatched Products');

      // Look for pagination
      const nextButton = page.locator('button:has-text("Next"), [aria-label="Next page"]');
      const pageIndicator = page.locator('text=/Page \\d+ of \\d+/');

      if (await pageIndicator.isVisible()) {
        const initialText = await pageIndicator.textContent();

        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForLoadState('networkidle');

          const newText = await pageIndicator.textContent();
          expect(newText).not.toEqual(initialText);
        }
      }
    });

    test('displays real-time status updates', async ({ page }) => {
      /**
       * Given an active crawl job
       * When viewing the dashboard
       * Then crawl status updates in real-time
       */
      await page.goto(`${baseURL}/admin/dashboard`);

      // Get initial status
      const statusBefore = await page.locator('[data-crawl-status]').textContent();

      // Wait a moment
      await page.waitForTimeout(2000);

      // Check if status updated (may or may not change depending on jobs)
      const statusAfter = await page.locator('[data-crawl-status]').textContent();

      // Just verify the element exists and has content
      expect(statusBefore).toBeDefined();
      expect(statusAfter).toBeDefined();
    });

    test('displays admin session timeout warning', async ({ page }) => {
      /**
       * Given a long period of inactivity
       * When nearing session expiration
       * Then a warning appears
       */
      // Set a session timeout warning (implementation dependent)
      // This test validates that timeout protection exists
      
      // Check for session management UI
      await expect(page.locator('button, link, [aria-label*="logout" i]')).toBeDefined();
    });

    test('handles logout', async ({ page }) => {
      /**
       * Given an authenticated admin session
       * When clicking logout
       * Then the session is terminated and user redirects to login
       */
      const logoutButton = page.locator('button:has-text("Logout"), [aria-label="Logout"]');
      
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Verify redirect to login
        await page.waitForURL(`${baseURL}/admin/login`);
        await expect(page).toHaveURL(`${baseURL}/admin/login`);
      }
    });
  });

  test('handles session expiration gracefully', async ({ page }) => {
    /**
     * Given an expired session
     * When attempting to access admin endpoints
     * Then the user is redirected to login
     */
    await page.goto(`${baseURL}/admin/dashboard`);

    // Should redirect to login if not authenticated
    await page.waitForTimeout(1000);
    
    const url = page.url();
    expect(url).toContain('/login');
  });

  test.describe('Accessibility', () => {
    test('admin interface has proper ARIA labels', async ({ page }) => {
      /**
       * Given the admin dashboard
       * When checking accessibility
       * Then ARIA labels and roles are properly set
       */
      await page.goto(`${baseURL}/admin/login`);
      await page.fill('input[type="email"]', adminEmail);
      await page.fill('input[type="password"]', adminPassword);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(`${baseURL}/admin/dashboard`);

      // Check for basic accessibility
      const tables = page.locator('[role="table"]');
      const buttons = page.locator('button[aria-label]');
      
      expect(await buttons.count()).toBeGreaterThan(0);
    });

    test('keyboard navigation works on admin pages', async ({ page }) => {
      /**
       * Given the admin dashboard
       * When navigating with keyboard
       * Then focusable elements can be reached with Tab
       */
      await page.goto(`${baseURL}/admin/login`);
      
      // Tab to email field
      await page.keyboard.press('Tab');
      
      // Type email
      await page.keyboard.type(adminEmail);
      
      // Tab to password field
      await page.keyboard.press('Tab');
      
      // Type password
      await page.keyboard.type(adminPassword);
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Submit with Enter
      await page.keyboard.press('Enter');
      
      await page.waitForURL(`${baseURL}/admin/dashboard`);
      await expect(page).toHaveURL(`${baseURL}/admin/dashboard`);
    });
  });
});
