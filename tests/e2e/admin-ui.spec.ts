import { test, expect } from '@playwright/test';

test.describe('Admin UI', () => {
  test('liste les soumissions et affiche les actions', async ({ page }) => {
    // Mock admin password check
    await page.route('**/admin/check-md5', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ match: true }) });
        return;
      }
      await route.fallback();
    });
    // Mock GET list
    await page.route('**/admin/spots**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [
            { spotId: 's1', createdAt: '2025-01-01T10:00:00Z', status: 'pending', name: 'Spot 1', type: 'ponton', submittedBy: 'alice', lat: 1, lng: 2 },
            { spotId: 's2', createdAt: '2025-01-02T12:00:00Z', status: 'pending', name: 'Spot 2', type: 'association', submittedBy: 'bob', lat: 1.2, lng: 2.1 }
          ] })
        });
        return;
      }
      await route.fallback();
    });
    // Mock PATCH save
    await page.route('**/admin/spots/*', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fallback();
    });

    await page.goto('/');
    // Ouvrir l’onglet Admin et s’authentifier
    await page.getByText('Admin').click();
    await page.getByPlaceholder('Mot de passe admin').fill('secret');
    await page.getByTestId('admin-password-validate').click();
  // Attendre le tableau
  await expect(page.getByText('Administration — Spots')).toBeVisible();
  // Attendre que les données soient chargées et vérifier les champs saisis
  await expect(page.getByPlaceholder('Description').first()).toBeVisible();
  // Deux lignes (deux jeux d'actions)
  await expect(page.getByText('Enregistrer')).toHaveCount(2);
  await expect(page.getByText('Valider')).toHaveCount(2);
  await expect(page.getByText('Refuser')).toHaveCount(2);
    // Actions visibles
    await expect(page.getByText('Enregistrer').first()).toBeVisible();
    await expect(page.getByText('Valider').first()).toBeVisible();
    await expect(page.getByText('Refuser').first()).toBeVisible();
    // Editer la note et enregistrer
  const desc = page.getByPlaceholder('Description').first();
  await desc.fill('RAS');
      await Promise.all([
        page.waitForRequest((req) => req.url().includes('/admin/spots/') && req.method() === 'PATCH'),
        page.getByText('Enregistrer').first().click()
      ]);
  });
});
