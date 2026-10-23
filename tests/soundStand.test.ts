import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { SONGS } from '@/audio/music/songs';
import { SoundStand, STAND_SOUNDS } from '@/debug/SoundStand';

describe('SoundStand', () => {
  const stands: SoundStand[] = [];
  const setup = (address = '/?debug') => {
    history.replaceState(null, '', address);
    const audio = new AudioEngine(
      () => false,
      () => false,
    );
    const audition = vi.spyOn(audio.music, 'audition');
    const setLayerMuted = vi.spyOn(audio.music, 'setLayerMuted');
    const stand = new SoundStand(audio);
    stands.push(stand);
    stand.setVisible(true);
    const get = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
    return { audio, audition, setLayerMuted, stand, get };
  };
  const params = () => new URLSearchParams(window.location.search);

  afterEach(() => {
    stands.splice(0).forEach((stand) => stand.dispose());
    history.replaceState(null, '', '/');
    vi.useRealTimers();
  });

  it('auditions the song and part picked, and keeps them in the address', () => {
    const { audition, get } = setup();
    const song = get<HTMLSelectElement>('select[data-stand="song"]');
    const part = get<HTMLSelectElement>('select[data-stand="part"]');

    expect([...song.options].slice(1).map((o) => o.value)).toEqual(SONGS.map((s) => s.id));
    song.value = 'night-drive';
    song.dispatchEvent(new Event('change'));
    expect(audition).toHaveBeenLastCalledWith('night-drive', null);
    expect([...part.options].map((o) => o.value)).toEqual([
      '',
      'whole-form',
      ...SONGS[0].sections.map((s) => s.name),
    ]);

    part.value = 'chorus';
    part.dispatchEvent(new Event('change'));
    expect(audition).toHaveBeenLastCalledWith('night-drive', 'chorus');
    expect(params().get('song')).toBe('night-drive');
    expect(params().get('part')).toBe('chorus');
    expect(window.location.search).toMatch(/[?&]debug(&|$)/);

    song.value = '';
    song.dispatchEvent(new Event('change'));
    expect(audition).toHaveBeenLastCalledWith(null, null);
    expect(params().has('song')).toBe(false);
  });

  it('opens on the place a link points at, silenced layers included', () => {
    const { audition, setLayerMuted, get } = setup('/?song=night-drive&part=chorus&mute=drums,arp');

    expect(audition).toHaveBeenCalledWith('night-drive', 'chorus');
    expect(setLayerMuted).toHaveBeenCalledWith('drums', true);
    expect(setLayerMuted).toHaveBeenCalledWith('bass', false);
    expect(get<HTMLInputElement>('input[data-layer="arp"]').checked).toBe(false);
  });

  it('silences a layer and keeps it in the address', () => {
    const { setLayerMuted, get } = setup();
    const bass = get<HTMLInputElement>('input[data-layer="bass"]');

    bass.click();
    expect(setLayerMuted).toHaveBeenLastCalledWith('bass', true);
    expect(params().get('mute')).toBe('bass');
    bass.click();
    expect(params().has('mute')).toBe(false);
  });

  it('pins intensity while its box is ticked, and lets the game move it again', () => {
    const { audio, get } = setup();
    const pin = vi.spyOn(audio.music, 'pinIntensity');
    const range = get<HTMLInputElement>('input[data-level="intensity"]');

    range.value = '0.8';
    range.dispatchEvent(new Event('input'));
    expect(pin).toHaveBeenLastCalledWith(0.8);
    get<HTMLInputElement>('input[data-pin="intensity"]').click();
    expect(pin).toHaveBeenLastCalledWith(null);
  });

  it('plays every action sound behind the menus, and a series in time', () => {
    vi.useFakeTimers();
    const { audio, get } = setup();
    const heard: boolean[] = [];
    const hit = vi.spyOn(audio.sfx, 'playPaddleHit').mockImplementation(() => {
      heard.push(audio.isAuditioning);
    });

    get<HTMLButtonElement>('button[data-sound="rally ×8"]').click();
    expect(hit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(8 * 320);
    expect(hit.mock.calls.map(([rally, , paddle]) => [rally, paddle])).toEqual(
      Array.from({ length: 8 }, (_, i) => [i + 1, i % 2]),
    );
    expect(heard.every(Boolean)).toBe(true);
    expect(audio.isAuditioning).toBe(false);

    for (const sound of STAND_SOUNDS) {
      expect(() =>
        get<HTMLButtonElement>(`button[data-sound="${sound.name}"]`).click(),
      ).not.toThrow();
    }
  });

  it('puts the lead on another voice, or back on the song’s own', () => {
    const { audio, get } = setup();
    const voice = vi.spyOn(audio.music, 'setLeadVoice');
    const select = get<HTMLSelectElement>('select[data-stand="leadVoice"]');

    select.value = 'pwm';
    select.dispatchEvent(new Event('change'));
    expect(voice).toHaveBeenLastCalledWith('pwm');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(voice).toHaveBeenLastCalledWith(null);
  });

  it('switches the glide off and on', () => {
    const { audio, get } = setup();
    const glide = vi.spyOn(audio.music, 'setGlide');

    get<HTMLInputElement>('input[data-glide]').click();
    expect(glide).toHaveBeenLastCalledWith(false);
  });

  it('stops a series it was playing when disposed', () => {
    vi.useFakeTimers();
    const { audio, stand, get } = setup();
    const pop = vi.spyOn(audio.sfx, 'playFireworkPop');

    get<HTMLButtonElement>('button[data-sound="fireworks ×6"]').click();
    stand.dispose();
    vi.advanceTimersByTime(5000);
    expect(pop).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-stand]')).toBeNull();
  });
});
