import { test, expect } from '@playwright/test';

// Tests spécifiques à l'authentification Admin

test.describe('Admin Auth', () => {
  test('refuse mauvais mot de passe', async ({ page }) => {
    // Mock admin check: always false
    await page.route('**/admin/check-md5', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ match: false }) });
        return;
      }
      await route.fallback();
    });
    await page.goto('/');
    await page.getByText('Admin').click();
    await page.getByPlaceholder('Mot de passe admin').fill('wrong');
    await page.getByTestId('admin-password-validate').click();
    await expect(page.getByTestId('admin-auth-error')).toHaveText(/Mot de passe invalide/);
    // Admin UI should not be visible
    await expect(page.getByText('Administration — Spots')).toHaveCount(0);
  });

  test('autorise accès avec bon mot de passe', async ({ page }) => {
    // Mock admin check: true
    await page.route('**/admin/check-md5', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ match: true }) });
        return;
      }
      await route.fallback();
    });
    // Also mock listing to render admin table
    await page.route('**/admin/spots**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
        return;
      }
      await route.fallback();
    });
    await page.goto('/');
    await page.getByText('Admin').click();
    await page.getByPlaceholder('Mot de passe admin').fill('secret');
    await page.getByTestId('admin-password-validate').click();
    await expect(page.getByText('Administration — Spots')).toBeVisible();
  });
});
