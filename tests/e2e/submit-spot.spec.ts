import { test, expect } from '@playwright/test';

test.describe('Soumission d\'une proposition', () => {
  test('3/ soumission formulaire ponton minimal', async ({ page }) => {
  await page.goto('/');
  // Ouvrir formulaire (ponton présélectionné)
  await page.getByTestId('btn-add-ponton').click();
    // Choisir coords sur la carte (ouvre mode picking)
  await page.locator('[data-testid="btn-choose-on-map"]').click();
  // Attendre l'injection des helpers map et simuler
  await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10_000 });
    // Simuler un click test util
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt(2.35, 48.85);
    });
    // Revenir automatiquement au formulaire (picking=false) -> lat/lon affichés
    await expect(page.locator('text=Lat: 48.85000  Lon: 2.35000')).toBeVisible();
    // Remplir champs
    await page.getByPlaceholder('Nom').fill('Ponton Test Auto');
    await page.getByPlaceholder('Soumis par').fill('playwright');
  await page.getByPlaceholder('Hauteur (cm)').fill('300');
    await page.getByPlaceholder('Longueur (m)').fill('10');
    await page.getByPlaceholder('Adresse').fill('Quai Test 75000');
    await page.getByPlaceholder('Description').fill('Spot inséré via test e2e');
      // Soumettre -> captcha requis désormais
    await page.locator('[data-testid="btn-submit-spot"]').click();
  await expect(page.getByTestId('captcha-section')).toBeVisible();
  await expect(page.getByTestId('captcha-image')).toBeVisible();
      // Disabled appearance prior to validation
      const submitBtn = page.getByTestId('btn-submit-spot');
      await expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
      const cssDisabled = await submitBtn.evaluate((el) => {
        const s = window.getComputedStyle(el as HTMLElement);
        return { opacity: s.opacity, cursor: s.cursor };
      });
      expect(Number(cssDisabled.opacity)).toBeLessThan(1);
      expect(cssDisabled.cursor).toBe('not-allowed');
  // Valider le captcha via override et bouton
  await page.evaluate(() => { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, forceCaptchaAnswer: 'ok123', forceSubmitOk: true }; });
  await page.getByTestId('captcha-input').fill('ok123');
  await page.getByTestId('btn-validate-captcha').click();
      // Enabled appearance after validation
      await expect(submitBtn).not.toHaveAttribute('aria-disabled', 'true');
      const cssEnabled = await submitBtn.evaluate((el) => {
        const s = window.getComputedStyle(el as HTMLElement);
        return { opacity: s.opacity, cursor: s.cursor };
      });
      expect(Number(cssEnabled.opacity)).toBe(1);
      expect(cssEnabled.cursor).toBe('pointer');
  // Captcha UI hidden after validation
  await expect(page.getByTestId('captcha-image')).toHaveCount(0);
  await expect(page.getByTestId('btn-validate-captcha')).toHaveCount(0);
  await expect(page.getByTestId('btn-refresh-captcha')).toHaveCount(0);
  // Soumettre
  await page.locator('[data-testid="btn-submit-spot"]').click();
  // Success modal appears
  await expect(page.getByTestId('submit-success-text')).toBeVisible();
  // Close via OK button -> returns to the map view
  await page.getByTestId('submit-success-ok').click();
  await expect(page.getByTestId('map-container')).toBeVisible();
  });
});
