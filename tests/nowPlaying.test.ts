import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
import { NowPlaying } from '@/ui/NowPlaying';

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
});
