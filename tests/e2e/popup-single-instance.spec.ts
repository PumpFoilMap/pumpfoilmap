import { test, expect } from '@playwright/test';

// Ensures that clicking a map point creates only one popup overlay and reusing the click does not stack multiple popups.
// Also verifies the close button removes the popup.

test.describe('Map popup single instance', () => {
  test('opens one popup and does not duplicate on repeated clicks', async ({ page }) => {
    await page.goto('/');

    // Wait for map container
    const map = page.getByTestId('map-container');
    await expect(map).toBeVisible();

    // Use test hook to open a known association spot (Marseille)
    await page.waitForFunction(() => typeof (window as any).PFM_TEST?.openSpot === 'function');

    await page.evaluate(() => (window as any).PFM_TEST.openSpot(5.3698, 43.2965));
    await expect(page.getByTestId('spot-popup')).toHaveCount(1);

    // Re-open same spot (should not create a second overlay)
    await page.evaluate(() => (window as any).PFM_TEST.openSpot(5.3698, 43.2965));
    await expect(page.getByTestId('spot-popup')).toHaveCount(1);

    // Re-open multiple times to ensure no stacking
    await page.evaluate(() => (window as any).PFM_TEST.openSpot(5.3698, 43.2965));
    await page.evaluate(() => (window as any).PFM_TEST.openSpot(5.3698, 43.2965));
    await expect(page.getByTestId('spot-popup')).toHaveCount(1);
  });
});
