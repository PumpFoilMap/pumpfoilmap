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
});
