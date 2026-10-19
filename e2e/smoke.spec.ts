import { expect, Locator, Page, test } from '@playwright/test';
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

/** A quick match choice, by its name; its value is its aria-valuetext. */
const choice = (page: Page, name: string) => page.getByRole('spinbutton', { name, exact: true });

/** Fails unless `locator` sits wholly on the court: the menus never need scrolling. */
const expectOnCourt = async (page: Page, locator: Locator) => {
  const [box, court] = await Promise.all([
    locator.boundingBox(),
    page.locator('#gameStage').boundingBox(),
  ]);
  expect(box).not.toBeNull();
  expect(court).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(court!.x);
  expect(box!.y).toBeGreaterThanOrEqual(court!.y);
  expect(box!.x + box!.width).toBeLessThanOrEqual(court!.x + court!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(court!.y + court!.height);
};

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
  await button(page, 'QUICK MATCH').click();
  await button(page, 'START').click();
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

test('lists the modes behind PLAY, the ones still to come switched off', async ({ page }) => {
  await page.goto('');

  await button(page, 'PLAY').click();
  await expect(button(page, 'STORY')).toBeDisabled();
  await expect(button(page, 'CHALLENGE')).toBeEnabled();
  await expect(button(page, 'QUICK MATCH')).toBeEnabled();
  // Down to BACK, on the court in every orientation (on a portrait phone both are turned)
  await expectOnCourt(page, button(page, 'BACK'));

  await button(page, 'BACK').click();
  await expect(button(page, 'PLAY')).toBeVisible();
});

test('sets up a quick match, its background coming up behind the menu', async ({ page }) => {
  await page.goto('');

  await button(page, 'PLAY').click();
  await button(page, 'QUICK MATCH').click();
  // The arrows step a choice either way
  await button(page, 'Next').first().click();
  await expect(choice(page, 'BACKGROUND')).toHaveAttribute('aria-valuetext', 'LASERS');
  await button(page, 'Previous').last().click();
  await expect(choice(page, 'POINTS')).toHaveAttribute('aria-valuetext', '3');
  await expectOnCourt(page, button(page, 'BACK'));
  // The rows, arrows and all, fit across the court too
  await expectOnCourt(page, button(page, 'Previous').first());
  await expectOnCourt(page, button(page, 'Next').first());
  await page.waitForTimeout(SETTLE_MS);

  await button(page, 'START').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);
});

test('lists the challenges on the court and starts the first from its card', async ({ page }) => {
  await page.goto('');

  await button(page, 'PLAY').click();
  await button(page, 'CHALLENGE').click();
  await expect(page.locator('#gameSubtitle')).toHaveText('PASSED: 0 / 9');
  // Every challenge is open from the start
  await expect(button(page, 'WARM-UP')).toBeEnabled();
  await expect(button(page, 'INSANITY')).toBeEnabled();
  // Every challenge and BACK, on the court in every orientation
  await expectOnCourt(page, button(page, 'WARM-UP'));
  await expectOnCourt(page, button(page, 'INSANITY'));
  await expectOnCourt(page, button(page, 'BACK'));

  await button(page, 'WARM-UP').click();
  await expect(page.locator('#gameSubtitle')).toHaveText('Win a match to 3 points');
  await expectOnCourt(page, button(page, 'BACK'));
  await button(page, 'START').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);
});

test('opens the settings, switches the language and comes back', async ({ page }) => {
  await page.goto('');

  await button(page, 'SETTINGS').click();
  await expect(button(page, /^SOUND EFFECTS/)).toBeVisible();
  await expect(button(page, /^DIFFICULTY/)).toHaveCount(0);

  await button(page, 'Next').click(); // the language's arrow
  await expect(choice(page, 'ЯЗЫК')).toHaveAttribute('aria-valuetext', 'РУССКИЙ');
  await button(page, 'НАЗАД').click();
  await expect(button(page, 'ИГРАТЬ')).toBeVisible();
});

// The challenges' own backgrounds too, as they arrive (steps 2.7–2.9)
for (const scene of [...SCENES, 'warehouse', 'dojo']) {
  test(`draws the ${scene} background without an error`, async ({ page }) => {
    await page.goto(`?bg=${scene}`);

    await expect(button(page, 'PLAY')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
  });
}

test('restarts a match from the pause', async ({ page, isMobile }) => {
  const pause = page.locator('#pauseButton');
  await page.goto('');

  await button(page, 'PLAY').click();
  await button(page, 'QUICK MATCH').click();
  await button(page, 'START').click();
  await page.waitForTimeout(SETTLE_MS);

  await (isMobile ? pause.click() : page.keyboard.press('Escape'));
  await button(page, 'RESTART').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);
});

test('brings settings saved before the profile into it', async ({ page }) => {
  // As a player who last played 1.2 left them: Russian, music off, a quick match to 7
  await page.addInitScript(() => {
    if (!localStorage.getItem('bouncewave_profile')) {
      localStorage.setItem('bouncewave_settings', JSON.stringify({ l: 'ru', u: true, p: 7 }));
    }
  });
  await page.goto('');

  await button(page, 'ИГРАТЬ').click();
  await button(page, 'БЫСТРЫЙ МАТЧ').click();
  await expect(choice(page, 'ОЧКИ')).toHaveAttribute('aria-valuetext', '7');
  const profile = await page.evaluate(() => localStorage.getItem('bouncewave_profile'));
  expect(JSON.parse(profile ?? '{}')).toMatchObject({ version: 3 });
});

test('shows the statistics on the court, and comes back', async ({ page }) => {
  await page.goto('');

  await button(page, 'STATISTICS').click();
  await expect(page.locator('#gameScreen .stats__row').first()).toBeVisible();
  // From the title to BACK, on the court in every orientation
  await expectOnCourt(page, page.locator('#gameTitle'));
  await expectOnCourt(page, page.locator('#gameScreen .stats__row').last());
  await expectOnCourt(page, button(page, 'BACK'));

  await button(page, 'BACK').click();
  await expect(button(page, 'PLAY')).toBeVisible();
});
