import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '@/i18n/I18nManager';
import { NowPlaying } from '@/ui/NowPlaying';

describe('NowPlaying', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="nowPlaying"><span id="nowPlayingTitle"></span></button>`;
  });

  const chip = () => document.getElementById('nowPlaying')!;
  const title = () => document.getElementById('nowPlayingTitle')!;

  it('names the song playing, and says when the music is off', () => {
    const nowPlaying = new NowPlaying(new I18nManager('en'), () => {});

    nowPlaying.update('Night Drive', false);
    expect(title().textContent).toBe('NIGHT DRIVE');
    expect(chip().getAttribute('aria-pressed')).toBe('true');

    nowPlaying.update('Night Drive', true);
    expect(title().textContent).toBe('MUSIC: OFF');
    expect(chip().getAttribute('aria-pressed')).toBe('false');
  });

  it('slides a new song in, but not the first one shown', () => {
    const nowPlaying = new NowPlaying(new I18nManager('en'), () => {});

    nowPlaying.update('Night Drive', false);
    expect(title().classList.contains('now-playing__title--enter')).toBe(false);

    nowPlaying.update('Chrome Heart', false);
    expect(title().classList.contains('now-playing__title--enter')).toBe(true);
  });

  it('toggles the music on a tap', () => {
    const onToggle = vi.fn();
    new NowPlaying(new I18nManager('en'), onToggle);

    chip().click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
