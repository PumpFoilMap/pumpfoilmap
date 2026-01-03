import { test, expect } from '@playwright/test';

// This test exercises the captcha flow in the submission form.
// It uses a testing override: the app exposes window.PFM_TEST.captchaSecret and accepts window.PFM_TEST.forceCaptchaAnswer
// to avoid depending on a real backend verifier in CI.

test.describe('Soumission avec captcha', () => {
  test('demande un captcha puis vérifie et soumet', async ({ page }) => {
    await page.goto('/');

  // Open form for ponton
  await page.getByTestId('btn-add-ponton').click();

    // Fill required fields
    await page.getByTestId('input-name').fill('Captcha Ponton');
    await page.getByTestId('input-submittedBy').fill('qa');
    await page.getByTestId('input-heightCm').fill('100');
    await page.getByTestId('input-lengthM').fill('10');
    await page.getByTestId('input-address').fill('Adresse test');

    // Choose coordinates on map
    await page.getByTestId('btn-choose-on-map').click();
    // Pick a point using helper
    await page.evaluate(() => {
      // @ts-ignore
      window.PFM_TEST?.pickAt?.(2.4, 48.9);
    });
    // Form should be visible again and display coords
    await expect(page.getByText('Lat:', { exact: false })).toBeVisible();

  // Captcha should be visible immediately
  await expect(page.getByTestId('captcha-section')).toBeVisible();
  await expect(page.getByTestId('captcha-image')).toBeVisible();
    // Submit button must be disabled until captcha validation and appear visually disabled
    const disabledBtn = page.getByTestId('btn-submit-spot');
    await expect(disabledBtn).toHaveAttribute('aria-disabled', 'true');
    const computedBefore = await disabledBtn.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { opacity: s.opacity, cursor: s.cursor, backgroundColor: s.backgroundColor };
    });
    expect(Number(computedBefore.opacity)).toBeLessThan(1);
    expect(computedBefore.cursor).toBe('not-allowed');

  // Proceed with override without relying on a dev-only secret in the page

  // For test purposes, use an arbitrary answer and set overrides to short-circuit submit
  await page.evaluate(() => { (window as any).PFM_TEST = { ...(window as any).PFM_TEST, forceCaptchaAnswer: 'ok123', forceSubmitOk: true }; });
  await page.getByTestId('captcha-input').fill('ok123');
  // Validate captcha
  await page.getByTestId('btn-validate-captcha').click();
    // Submit button should be enabled now and appear enabled
    await expect(disabledBtn).not.toHaveAttribute('aria-disabled', 'true');
    const computedAfter = await disabledBtn.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { opacity: s.opacity, cursor: s.cursor, backgroundColor: s.backgroundColor };
    });
    expect(Number(computedAfter.opacity)).toBe(1);
    expect(computedAfter.cursor).toBe('pointer');
    // Captcha block (image and buttons) should be hidden after validation
    await expect(page.getByTestId('captcha-image')).toHaveCount(0);
    await expect(page.getByTestId('btn-validate-captcha')).toHaveCount(0);
    await expect(page.getByTestId('btn-refresh-captcha')).toHaveCount(0);
  // Submit
  await page.getByTestId('btn-submit-spot').click();

  // Expect success modal (short-circuited in dev)
  await expect(page.getByTestId('submit-success-text')).toBeVisible();
  await page.getByTestId('submit-success-ok').click();
  await expect(page.getByTestId('map-container')).toBeVisible();
  });
});
