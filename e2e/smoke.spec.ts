import { expect, Page, test } from '@playwright/test';
import { SCENES } from '../src/shared/scenes';

/** Long enough for the game to draw a few dozen frames, including a background's first ones. */
const SETTLE_MS = 600;

/** Every error the page reports, uncaught or logged, so a test can insist there were none. */
const errors: string[] = [];

test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' });

const menu = (page: Page) => page.locator('#gameUI');

test('opens on the main menu with the court drawn behind it', async ({ page }) => {
  await page.goto('');

  await expect(button(page, 'PLAY')).toBeVisible();
  await expect(button(page, 'SETTINGS')).toBeVisible();
  const canvas = await page.locator('#gameCanvas').boundingBox();
  expect(canvas?.width).toBeGreaterThan(0);
  expect(canvas?.height).toBeGreaterThan(0);
  await page.waitForTimeout(SETTLE_MS);
});

test('starts a match, pauses, resumes and goes back to the menu', async ({ page, isMobile }) => {
  // As a player would: the pause button shows on a touch screen only; a keyboard has Esc
  const pause = page.locator('#pauseButton');
  const pauseMatch = () => (isMobile ? pause.click() : page.keyboard.press('Escape'));
  await page.goto('');

  await button(page, 'PLAY').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  if (isMobile) await expect(pause).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);

  await pauseMatch();
  await expect(button(page, 'RESUME')).toBeVisible();
  await button(page, 'RESUME').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);

  await pauseMatch();
  await button(page, 'MAIN MENU').click();
  await expect(button(page, 'PLAY')).toBeVisible();
});

test('opens the settings, switches the language and comes back', async ({ page }) => {
  await page.goto('');

  await button(page, 'SETTINGS').click();
  await expect(button(page, /^DIFFICULTY/)).toBeVisible();

  await button(page, /^LANGUAGE/).click();
  await expect(button(page, /^ЯЗЫК/)).toBeVisible();
  await button(page, 'НАЗАД').click();
  await expect(button(page, 'ИГРАТЬ')).toBeVisible();
});

for (const scene of SCENES) {
  test(`draws the ${scene} background without an error`, async ({ page }) => {
    await page.goto(`?bg=${scene}`);

    await expect(button(page, 'PLAY')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
  });
}
