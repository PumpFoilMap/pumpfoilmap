import { test, expect } from '@playwright/test';

// E2E: Admin selection on map then edit and delete
// We mock the backend endpoints to isolate UI

test.describe('Admin selection on map', () => {
  test('select on map, then edit and delete the spot', async ({ page }) => {
    // Mock admin password check
    await page.route('**/admin/check-md5', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ match: true }) });
        return;
      }
      await route.fallback();
    });
    // Mock listing (single item for deterministic selection)
    await page.route('**/admin/spots**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [
            { spotId: 'paris', createdAt: '2025-01-01T10:00:00Z', status: 'pending', name: 'Spot Paris', type: 'ponton', submittedBy: 'alice', lat: 48.85, lng: 2.35 }
          ] })
        });
        return;
      }
      await route.fallback();
    });

    // Mock PATCH and DELETE for the selected spot
    await page.route('**/admin/spots/*', async route => {
      const method = route.request().method();
      if (method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      if (method === 'DELETE') {
        await route.fulfill({ status: 204, contentType: 'application/json', body: '' });
        return;
      }
      await route.fallback();
    });

  await page.goto('/');
  await page.getByText('Admin').click();
  await page.getByPlaceholder('Mot de passe admin').fill('secret');
  await page.getByTestId('admin-password-validate').click();
    await expect(page.getByText('Administration — Spots')).toBeVisible();

    // Enable selection on the map
  const selBtn = page.getByTestId('btn-select-on-map');
    await selBtn.click();
    await expect(page.getByText('Sélection carte: ON')).toBeVisible();

    // Wait for test helper and simulate pick near the only spot (lon, lat order)
    await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10_000 });
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt(2.35, 48.85);
    });

    // Edit description on the only row and save
    const desc = page.getByPlaceholder('Description').first();
    await desc.fill('Maj via e2e');
    await Promise.all([
      page.waitForRequest((req) => req.url().includes('/admin/spots/') && req.method() === 'PATCH'),
      page.getByText('Enregistrer').first().click()
    ]);

    // Confirm deletion (override window.confirm to always accept in test)
    await page.evaluate(() => { (window as any).confirm = () => true; });
    await Promise.all([
      page.waitForRequest((req) => req.url().includes('/admin/spots/') && req.method() === 'DELETE'),
      page.getByText('Supprimer').first().click()
    ]);

    // After deletion, the list is refreshed; ensure we can still re-enable selection and pick again without errors.
    // Re-mock listing to still return one item (simulate it re-appearing for the sake of interaction)
    // Note: Playwright routes are already set; pick again to ensure callback still hooked
    await selBtn.click(); // turn OFF
    await selBtn.click(); // turn back ON
    await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10_000 });
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt(2.35, 48.85);
    });
    // Try to save again (triggers PATCH)
    await Promise.all([
      page.waitForRequest((req) => req.url().includes('/admin/spots/') && req.method() === 'PATCH'),
      page.getByText('Enregistrer').first().click()
    ]);
  });
});
