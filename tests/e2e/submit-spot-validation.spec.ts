import { test, expect } from '@playwright/test';

test.describe('Validation formulaire soumission', () => {
  test('affiche erreurs requis et les retire après correction', async ({ page }) => {
  await page.goto('/');
  // Ouvrir formulaire (nouveau bouton)
  await page.getByTestId('btn-add-ponton').click();
    // Valider le captcha pour activer la soumission
    await expect(page.getByTestId('captcha-section')).toBeVisible();
    await expect(page.getByTestId('captcha-image')).toBeVisible();
    // Visually disabled submit button before captcha validation
    const submitBtn = page.getByTestId('btn-submit-spot');
    await expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    const cssBefore = await submitBtn.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { opacity: s.opacity, cursor: s.cursor };
    });
    expect(Number(cssBefore.opacity)).toBeLessThan(1);
    expect(cssBefore.cursor).toBe('not-allowed');
    await page.evaluate(() => { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, forceCaptchaAnswer: 'ok123' }; });
    await page.getByTestId('captcha-input').fill('ok123');
    await page.getByTestId('btn-validate-captcha').click();
    // Enabled appearance after validation
    await expect(submitBtn).not.toHaveAttribute('aria-disabled', 'true');
    const cssAfter = await submitBtn.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { opacity: s.opacity, cursor: s.cursor };
    });
    expect(Number(cssAfter.opacity)).toBe(1);
    expect(cssAfter.cursor).toBe('pointer');
    // Type par défaut: ponton

  // 1) Tentative de soumission vide -> erreurs
  await page.locator('[data-testid="btn-submit-spot"]').click({ force: true });
    await expect(page.getByTestId('error-name')).toBeVisible();
    await expect(page.getByTestId('error-submittedBy')).toBeVisible();
    await expect(page.getByTestId('error-latlng')).toBeVisible();
  await expect(page.getByTestId('error-heightCm')).toBeVisible();
    await expect(page.getByTestId('error-lengthM')).toBeVisible();
    await expect(page.getByTestId('error-address')).toBeVisible();

    // 2) Mettre des valeurs invalides pour formats
    await page.locator('[data-testid="input-imageUrl"]').fill('not-a-url');
    await page.locator('[data-testid="input-contactEmail"]').fill('invalid');
    await page.locator('[data-testid="btn-submit-spot"]').click();
    await expect(page.getByTestId('error-imageUrl')).toBeVisible();
    await expect(page.getByTestId('error-contactEmail')).toBeVisible();

    // 3) Corriger tous les champs
    await page.locator('[data-testid="input-name"]').fill('Ponton Validé');
    await page.locator('[data-testid="input-submittedBy"]').fill('playwright');
  await page.locator('[data-testid="input-heightCm"]').fill('200');
    await page.locator('[data-testid="input-lengthM"]').fill('5');
    await page.locator('[data-testid="input-address"]').fill('Quai Test');
    await page.locator('[data-testid="input-imageUrl"]').fill('https://example.com/img.jpg');
    await page.locator('[data-testid="input-contactEmail"]').fill('user@example.com');

    // Coords via helper
  await page.locator('[data-testid="btn-choose-on-map"]').click();
    await page.waitForFunction(() => (window as any).PFM_TEST?.pickAt, null, { timeout: 10000 });
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST.pickAt(2.35, 48.85);
    });

    // Après sélection sur la carte, si le captcha était déjà validé, il ne doit pas redemander une nouvelle validation
    await expect(page.getByTestId('captcha-section')).toBeVisible();
    await expect(page.getByTestId('btn-submit-spot')).not.toHaveAttribute('aria-disabled', 'true');
    // Captcha UI should remain hidden (image and buttons)
    await expect(page.getByTestId('captcha-image')).toHaveCount(0);
    await expect(page.getByTestId('btn-validate-captcha')).toHaveCount(0);
    await expect(page.getByTestId('btn-refresh-captcha')).toHaveCount(0);

    // Erreurs doivent disparaître après nouvelle tentative
    await page.locator('[data-testid="btn-submit-spot"]').click();
    await expect(page.getByTestId('error-name')).toHaveCount(0);
    await expect(page.getByTestId('error-submittedBy')).toHaveCount(0);
    await expect(page.getByTestId('error-latlng')).toHaveCount(0);
  await expect(page.getByTestId('error-heightCm')).toHaveCount(0);
    await expect(page.getByTestId('error-lengthM')).toHaveCount(0);
    await expect(page.getByTestId('error-address')).toHaveCount(0);
    await expect(page.getByTestId('error-imageUrl')).toHaveCount(0);
    await expect(page.getByTestId('error-contactEmail')).toHaveCount(0);

  // Soumettre (court-circuit succès pour le test)
  await page.evaluate(() => { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, forceSubmitOk: true }; });
  await page.locator('[data-testid="btn-submit-spot"]').click({ force: true });
  // Success modal should be visible and then close on OK
  await expect(page.getByTestId('submit-success-text')).toBeVisible();
  await page.getByTestId('submit-success-ok').click();
  await expect(page.getByTestId('map-container')).toBeVisible();
  });
});
