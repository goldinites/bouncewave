import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
import { NOW_PLAYING_IDLE_MS, NOW_PLAYING_REVEAL_MS, NowPlaying } from '@/ui/NowPlaying';

const setup = () => {
  const actions = { onToggle: vi.fn(), onNext: vi.fn() };
  const nowPlaying = new NowPlaying(new I18nManager('en'), actions);
  return { nowPlaying, actions };
};

const byId = (id: string) => document.getElementById(id)!;

describe('NowPlaying', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="nowPlaying">
        <button id="musicToggle"><span id="nowPlayingTitle"></span></button>
        <button id="nextTrack"></button>
      </div>`;
  });

  it('names the song playing, and says when the music is off', () => {
    const { nowPlaying } = setup();

    nowPlaying.update('Night Drive', false);
    expect(byId('nowPlayingTitle').textContent).toBe('NIGHT DRIVE');
    expect(byId('musicToggle').getAttribute('aria-pressed')).toBe('true');

    nowPlaying.update('Night Drive', true);
    expect(byId('nowPlayingTitle').textContent).toBe('MUSIC: OFF');
    expect(byId('musicToggle').getAttribute('aria-pressed')).toBe('false');
  });

  it('slides a new song in, but not the first one shown or music coming back on', () => {
    const { nowPlaying } = setup();
    const isEntering = () =>
      byId('nowPlayingTitle').classList.contains('now-playing__title--enter');

    nowPlaying.update('Night Drive', false);
    expect(isEntering()).toBe(false);

    nowPlaying.update('Chrome Heart', false);
    expect(isEntering()).toBe(true);
  });

  it('toggles the music and skips on a tap', () => {
    const { actions } = setup();

    byId('musicToggle').click();
    byId('nextTrack').click();
    expect(actions.onToggle).toHaveBeenCalledOnce();
    expect(actions.onNext).toHaveBeenCalledOnce();
  });

  it('hides the skip in classic mode, which has a single loop', () => {
    const { nowPlaying } = setup();

    nowPlaying.update(null, false);
    expect(byId('nowPlaying').classList.contains('now-playing--classic')).toBe(true);
    expect(byId('nowPlayingTitle').textContent).toBe('MUSIC');
  });

  describe('when left alone', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const isIdle = () => byId('nowPlaying').classList.contains('now-playing--idle');

    it('fades back after a while, and wakes on a touch', () => {
      const { nowPlaying } = setup();
      nowPlaying.update('Night Drive', false);

      vi.advanceTimersByTime(NOW_PLAYING_IDLE_MS);
      expect(isIdle()).toBe(true);

      byId('nowPlaying').dispatchEvent(new Event('pointerdown'));
      expect(isIdle()).toBe(false);
    });

    it('wakes up when the song changes', () => {
      const { nowPlaying } = setup();
      nowPlaying.update('Night Drive', false);
      vi.advanceTimersByTime(NOW_PLAYING_IDLE_MS);

      nowPlaying.update('Chrome Heart', false);
      expect(isIdle()).toBe(false);
    });

    it('opens the title out for a while after a skip', () => {
      setup();
      const isRevealed = () => byId('nowPlaying').classList.contains('now-playing--reveal');

      byId('nextTrack').click();
      expect(isRevealed()).toBe(true);

      // Another skip starts the count again
      vi.advanceTimersByTime(NOW_PLAYING_REVEAL_MS - 1);
      byId('nextTrack').click();
      vi.advanceTimersByTime(NOW_PLAYING_REVEAL_MS - 1);
      expect(isRevealed()).toBe(true);

      vi.advanceTimersByTime(1);
      expect(isRevealed()).toBe(false);
    });

    it('stays awake while a pointer rests on it', () => {
      const { nowPlaying } = setup();
      nowPlaying.update('Night Drive', false);

      byId('nowPlaying').dispatchEvent(new Event('pointerenter'));
      vi.advanceTimersByTime(NOW_PLAYING_IDLE_MS * 2);
      expect(isIdle()).toBe(false);

      byId('nowPlaying').dispatchEvent(new Event('pointerleave'));
      vi.advanceTimersByTime(NOW_PLAYING_IDLE_MS);
      expect(isIdle()).toBe(true);
    });
  });
});
