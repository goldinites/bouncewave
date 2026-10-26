import { readFileSync } from 'node:fs';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '@/app/boot';
import { Game } from '@/app/Game';
import { getDefaultProfile } from '@/profile/Profile';
import { PROFILE_KEY, ProfileStore } from '@/profile/ProfileStore';
import { fakeContext } from './helpers/fakeContext';

const BODY = /<body>([\s\S]*)<\/body>/
  .exec(readFileSync('index.html', 'utf8'))![1]
  .replace(/<script[\s\S]*?<\/script>/g, '');

const canvas = () => document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
/** The developer tools' dock, once it has been built. */
const dock = () => document.querySelector('aside');
const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
/** Lets a dynamic import and what follows it settle. */
const settle = () => vi.dynamicImportSettled();

describe('the game as it starts', () => {
  let game: Game | null = null;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = BODY;
    const { ctx, spies } = fakeContext();
    (spies.createLinearGradient as Mock).mockReturnValue(spies);
    (spies.createRadialGradient as Mock).mockReturnValue(spies);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as RenderingContext,
    );
  });

  afterEach(() => {
    game?.dispose();
    game = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  it('boots with the profile this browser saved, and the game plays with it', async () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        ...getDefaultProfile(),
        settings: { ...getDefaultProfile().settings, language: 'ru' },
      }),
    );
    const { profile } = await boot();
    expect(profile.current.settings.language).toBe('ru');

    game = new Game(canvas(), profile);
    game.init();
    expect(document.documentElement.lang).toBe('ru');
  });

  it('plays with the profile it is given rather than reading its own', () => {
    const storage = new Map<string, string>();
    const profile = new ProfileStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
    } as Storage);
    game = new Game(canvas(), profile);
    game.init();
    expect(profile.current.settings.language).toBe('en');
    // Nothing went to the browser's own storage
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('leaves the developer tools out until a developer asks for them (F3)', async () => {
    game = new Game(canvas());
    game.init();
    await settle();
    expect(dock()).toBeNull();

    press('F3');
    await settle();
    expect(dock()).not.toBeNull();
  });

  it('brings the developer tools with a link to the sound stand', async () => {
    window.history.replaceState(null, '', '/?song=neon-cathedral');
    game = new Game(canvas());
    game.init();
    await settle();
    expect(document.querySelector('[aria-label="Sound stand (debug)"]')).not.toBeNull();
  });
});
