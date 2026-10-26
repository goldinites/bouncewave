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

/**
 * PLAY, on to the modes: past the tutorial offered to someone new (NO), as every test here
 * starts from nothing saved.
 */
const openModes = async (page: Page, play = 'PLAY') => {
  await button(page, play).click();
  const skip = button(page, /^(NO|НЕТ)$/);
  const modes = button(page, /^(QUICK MATCH|БЫСТРЫЙ МАТЧ)$/);
  await expect(skip.or(modes)).toBeVisible();
  if (await skip.isVisible()) await skip.click();
};

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

  await openModes(page);
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

test('offers the tutorial to someone new, and plays it on court', async ({ page }) => {
  await page.goto('');
  await button(page, 'PLAY').click();
  await expect(page.locator('#gameTitle')).toHaveText('FIRST TIME?');
  await button(page, 'YES').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  // Its first step, above the court (a phone on its side writes it on the court instead)
  const viewport = page.viewportSize()!;
  if (!(viewport.height <= 520 && viewport.width > viewport.height)) {
    await expect(page.locator('#gameCondition')).toHaveText(/^(MOVE|ДВИГАЙ|ВЕДИ)/);
  }
  await page.waitForTimeout(SETTLE_MS);

  // Left halfway, it is offered again; turned down, never
  await page.keyboard.press('Escape');
  await button(page, 'MAIN MENU').click();
  await button(page, 'PLAY').click();
  await expect(page.locator('#gameTitle')).toHaveText('FIRST TIME?');
  await button(page, 'NO').click();
  await page.keyboard.press('Escape');
  await button(page, 'PLAY').click();
  await expect(page.locator('#gameTitle')).toHaveText('GAME MODE');
});

test('opens a tutorial move on a card that fits the court', async ({ page }) => {
  await page.goto('?tutorial=perfect');
  await button(page, 'PLAY').click();
  await button(page, 'YES').click();
  await expect(page.locator('#gameTitle')).toHaveText('PERFECT HIT');
  await expectOnCourt(page, page.locator('.tutorial-card'));
  await button(page, 'GOT IT').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);
});

test('plays a match of two from 2 PLAYERS, both steering at once', async ({ page }) => {
  await page.goto('');

  await button(page, '2 PLAYERS').click();
  await expect(choice(page, 'POINTS')).toBeVisible();
  await expectOnCourt(page, button(page, 'START'));
  await button(page, 'START').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);

  // W/S and the arrows held together, each for its own paddle
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(SETTLE_MS);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowDown');
});

test('lists the modes behind PLAY, the story left out of this build', async ({ page }) => {
  await page.goto('');

  await openModes(page);
  await expect(button(page, 'STORY')).toHaveCount(0);
  await expect(button(page, 'CHALLENGE')).toBeEnabled();
  await expect(button(page, 'QUICK MATCH')).toBeEnabled();
  // Down to BACK, on the court in every orientation (on a portrait phone both are turned)
  await expectOnCourt(page, button(page, 'BACK'));

  await button(page, 'BACK').click();
  await expect(button(page, 'PLAY')).toBeVisible();
});

test('sets up a quick match, its background coming up behind the menu', async ({ page }) => {
  await page.goto('');

  await openModes(page);
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

  await openModes(page);
  await button(page, 'CHALLENGE').click();
  await expect(page.locator('#gameSubtitle')).toHaveText('PASSED: 0 / 18');
  // A tier at a time, every challenge open from the start: the tiers' tabs, its six and BACK on
  // the court in every orientation
  const tab = (name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
  await expect(button(page, 'FIRST SERVE')).toBeEnabled();
  await expectOnCourt(page, tab('ROOKIE'));
  await expectOnCourt(page, tab('LEGEND'));
  await expectOnCourt(page, button(page, 'FIRST SERVE'));
  await expectOnCourt(page, button(page, 'OVERHEAT'));
  await expectOnCourt(page, button(page, 'BACK'));
  await tab('LEGEND').click();
  await expect(button(page, 'CHAOS')).toBeEnabled();
  await expectOnCourt(page, button(page, 'CHAOS'));
  await expectOnCourt(page, button(page, 'TAG TEAM'));
  await tab('ROOKIE').click();

  await button(page, 'FIRST SERVE').click();
  await expect(page.locator('#gameSubtitle')).toHaveText('Win a match to 3 points');
  await expectOnCourt(page, button(page, 'BACK'));
  await button(page, 'START').click();
  await expect(menu(page)).toHaveClass(/game__ui--hidden/);
  await page.waitForTimeout(SETTLE_MS);
});

test('opens the settings, switches the language and comes back', async ({ page }) => {
  await page.goto('');

  await button(page, 'SETTINGS').click();
  await expect(choice(page, 'SOUND EFFECTS')).toHaveAttribute('aria-valuetext', '100%');
  await expect(button(page, /^DIFFICULTY/)).toHaveCount(0);

  // The volumes' and the language's rows each have one: the language's is the last
  await button(page, 'Previous').first().click();
  await expect(choice(page, 'MUSIC')).toHaveAttribute('aria-valuetext', '90%');
  await button(page, 'Next').last().click();
  await expect(choice(page, 'ЯЗЫК')).toHaveAttribute('aria-valuetext', 'РУССКИЙ');
  await button(page, 'НАЗАД').click();
  await expect(button(page, 'ИГРАТЬ')).toBeVisible();
});

// The challenges' own backgrounds too, as they arrive (steps 2.7–2.9: all three now)
for (const scene of [...SCENES, 'warehouse', 'dojo', 'brokenNet', 'range']) {
  test(`draws the ${scene} background without an error`, async ({ page }) => {
    await page.goto(`?bg=${scene}`);

    await expect(button(page, 'PLAY')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
  });
}

test('restarts a match from the pause', async ({ page, isMobile }) => {
  const pause = page.locator('#pauseButton');
  await page.goto('');

  await openModes(page);
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

  await openModes(page, 'ИГРАТЬ');
  await button(page, 'БЫСТРЫЙ МАТЧ').click();
  await expect(choice(page, 'ОЧКИ')).toHaveAttribute('aria-valuetext', '7');
  const profile = await page.evaluate(() => localStorage.getItem('bouncewave_profile'));
  // The music off is no music volume
  expect(JSON.parse(profile ?? '{}')).toMatchObject({ version: 5, settings: { musicVolume: 0 } });
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
