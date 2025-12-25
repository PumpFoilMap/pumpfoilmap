import { test, expect } from '@playwright/test';

// Verifies that clicking "Choisir sur la carte" opens the map, and picking returns to the form with lat/lon set

test.describe('Choisir sur la carte flow', () => {
  test('opens map and returns with selected coordinates', async ({ page }) => {
    await page.goto('/');

    // Open the spot submission form
    await page.getByTestId('btn-add-ponton').click();

    // Click the "Choisir sur la carte" button to switch to map view
    await page.getByTestId('btn-choose-on-map').click();

    // Map should be visible (container present)
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible();

    // Wait for test helpers and simulate a pick
    await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10_000 });
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt(2.35, 48.85);
    });

    // After picking, we should return to the form and see the lat/lon text
    await expect(page.locator('text=Lat: 48.85000  Lon: 2.35000')).toBeVisible();

  // Map should no longer be the main view — form submit button visible
  await expect(page.getByTestId('btn-submit-spot')).toBeVisible();
  });
});
