import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Helper to execute code in browser context with small delay for map style readiness
async function openSpot(page: Page, lon: number, lat: number) {
  await page.waitForSelector('[data-testid="map-container"]');
  // Poll for injected helper (map load)
  await page.waitForFunction(() => (window as any).PFM_TEST?.openSpot, null, { timeout: 10_000 });
  await page.evaluate(([lo, la]) => {
    // @ts-ignore
    window.PFM_TEST.openSpot(lo, la);
  }, [lon, lat]);
  await expect(page.getByTestId('spot-popup')).toBeVisible();
}

test.describe('Sélection de spots', () => {
  test('1/ sélection d\'un ponton', async ({ page }) => {
    await page.goto('/');
    await openSpot(page, 2.3522, 48.8566); // Paris ponton
  await expect(page.getByTestId('spot-popup').getByText('Ponton Seine', { exact: false })).toBeVisible();
  await expect(page.getByTestId('spot-popup').getByText('Accès', { exact: false })).toBeVisible();
  });

  test('2/ sélection d\'une association', async ({ page }) => {
    await page.goto('/');
    await openSpot(page, -1.5536, 47.2184); // Nantes association
  await expect(page.getByTestId('spot-popup').getByText('Foil Nantes Club', { exact: false })).toBeVisible();
  await expect(page.getByTestId('spot-popup').getByText('Visiter le site', { exact: false })).toBeVisible();
  });

  test('3/ association avec image — l\'image est visible', async ({ page }) => {
    await page.goto('/');
    // Marseille association with imageUrl in sample data
    await openSpot(page, 5.3698, 43.2965);
    const popup = page.getByTestId('spot-popup');
    await expect(popup).toBeVisible();
    // Robust assertions: verify popup metadata indicates association with image
    await expect(popup).toHaveAttribute('data-type', 'association');
    await expect(popup).toHaveAttribute('data-has-img', '1');
    // And an <img> element is present with a src
    const img = popup.locator('img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', /.+/);
  });
});
