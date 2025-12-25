import { test, expect } from '@playwright/test';

// Verifies header layout behavior:
// - On wide screens, the title and action links share the same row
// - On narrow screens, they wrap to two rows and compact labels are used

test.describe('Header layout', () => {
  test('wide screen: title and actions share one line', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');

    const title = page.getByText('PumpfoilMap — Spots');
    const btnPonton = page.getByTestId('btn-add-ponton');
    const btnAssoc = page.getByTestId('btn-add-association');

    await expect(title).toBeVisible();
    await expect(btnPonton).toBeVisible();
    await expect(btnAssoc).toBeVisible();
    await expect(page.getByText('Admin')).toBeVisible();

    const titleBox = await title.boundingBox();
    const pontonBox = await btnPonton.boundingBox();
    expect(titleBox).toBeTruthy();
    expect(pontonBox).toBeTruthy();
    if (!titleBox || !pontonBox) throw new Error('Bounding boxes not available');

    // Same row: Y positions should be close
    const dy = Math.abs(titleBox.y - pontonBox.y);
    expect(dy).toBeLessThan(12);

    // Wide labels should be present
    await expect(page.getByText('Proposer un nouveau ponton')).toBeVisible();
    await expect(page.getByText('Proposer une nouvelle association')).toBeVisible();
  });

  test('narrow screen: title wraps above actions and compact labels', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    const title = page.getByText('PumpfoilMap — Spots');
    const btnPonton = page.getByTestId('btn-add-ponton');
    const btnAssoc = page.getByTestId('btn-add-association');

    await expect(title).toBeVisible();
    await expect(btnPonton).toBeVisible();
    await expect(btnAssoc).toBeVisible();

    const titleBox = await title.boundingBox();
    const pontonBox = await btnPonton.boundingBox();
    expect(titleBox).toBeTruthy();
    expect(pontonBox).toBeTruthy();
    if (!titleBox || !pontonBox) throw new Error('Bounding boxes not available');

    // Wrapped: actions row should be below the title by a noticeable margin
    const dy = pontonBox.y - titleBox.y;
    expect(dy).toBeGreaterThan(18);

    // Compact labels should be present on narrow screens
    await expect(page.getByText('Proposer ponton')).toBeVisible();
    await expect(page.getByText('Proposer association')).toBeVisible();
  });
});
