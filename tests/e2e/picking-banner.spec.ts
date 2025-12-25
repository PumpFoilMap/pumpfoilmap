import { test, expect } from '@playwright/test';

// Ensures the picking instruction banner appears on the map during selection and disappears after picking

test.describe('Picking banner', () => {
  test('shows banner during picking and hides after selection', async ({ page }) => {
    await page.goto('/');

    // Open the spot submission form (ponton preset)
    await page.getByTestId('btn-add-ponton').click();

    // Start picking: open map
    await page.getByTestId('btn-choose-on-map').click();

    // Map visible and banner present
    await expect(page.getByTestId('map-container')).toBeVisible();
    await expect(page.getByTestId('picking-banner')).toBeVisible();

    // Simulate a pick via helper
    await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10_000 });
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt(2.35, 48.85);
    });

    // After picking, the banner should be gone and the form shows lat/lon
    await expect(page.getByTestId('picking-banner')).toHaveCount(0);
    await expect(page.locator('text=Lat: 48.85000  Lon: 2.35000')).toBeVisible();
  });
});
