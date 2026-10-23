import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '@/audio/AudioEngine';
import { SONGS } from '@/audio/music/songs';
import { SoundStand, STAND_SOUNDS } from '@/debug/SoundStand';
import { WHOLE_FORM } from '@/audio/music/Conductor';
import { MusicEngine } from '@/audio/music/MusicEngine';

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
    expect(audition).toHaveBeenLastCalledWith('night-drive', null, 0);
    expect([...part.options].map((o) => o.value)).toEqual([
      '',
      'whole-form',
      ...SONGS[0].sections.map((s) => s.name),
    ]);

    part.value = 'chorus';
    part.dispatchEvent(new Event('change'));
    expect(audition).toHaveBeenLastCalledWith('night-drive', 'chorus', 0);
    expect(params().get('song')).toBe('night-drive');
    expect(params().get('part')).toBe('chorus');
    expect(window.location.search).toMatch(/[?&]debug(&|$)/);

    song.value = '';
    song.dispatchEvent(new Event('change'));
    expect(audition).toHaveBeenLastCalledWith(null, null, 0);
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

  it('shows the playing song’s form, a segment a step, and plays it through from one clicked', () => {
    const { audition, get } = setup();
    const song = get<HTMLSelectElement>('select[data-stand="song"]');
    song.value = 'neon-cathedral';
    song.dispatchEvent(new Event('change'));

    const { form } = SONGS.find((s) => s.id === 'neon-cathedral')!;
    const segments = document.querySelectorAll<HTMLElement>('[data-stand="timeline"] [data-step]');
    expect(segments).toHaveLength(form.length);
    segments[5].click();
    expect(audition).toHaveBeenLastCalledWith('neon-cathedral', WHOLE_FORM, 5);
    expect(get<HTMLSelectElement>('select[data-stand="part"]').value).toBe(WHOLE_FORM);
  });

  it('steps to the next and previous song, played through from the start', () => {
    const { audition, get } = setup();
    get<HTMLButtonElement>('button[data-player="next"]').click();
    expect(audition).toHaveBeenLastCalledWith(SONGS[0].id, WHOLE_FORM, 0);
    get<HTMLButtonElement>('button[data-player="next"]').click();
    expect(audition).toHaveBeenLastCalledWith(SONGS[1].id, WHOLE_FORM, 0);
    get<HTMLButtonElement>('button[data-player="previous"]').click();
    get<HTMLButtonElement>('button[data-player="previous"]').click();
    expect(audition).toHaveBeenLastCalledWith(SONGS[SONGS.length - 1].id, WHOLE_FORM, 0);
  });

  it('pauses and resumes, and plays again whatever is picked', () => {
    const { audio, get } = setup();
    const pause = get<HTMLButtonElement>('button[data-player="pause"]');
    pause.click();
    expect(audio.isPaused).toBe(true);
    pause.click();
    expect(audio.isPaused).toBe(false);

    pause.click();
    get<HTMLButtonElement>('button[data-player="next"]').click();
    expect(audio.isPaused).toBe(false);
  });

  it('puts every melody on the lead a link names, and on the songs’ own without one', () => {
    const setLead = vi.spyOn(MusicEngine.prototype, 'setLeadVoice');
    setup('/?debug&lead=sax');
    expect(setLead).toHaveBeenLastCalledWith('sax');
    setLead.mockClear();
    setup('/?debug');
    expect(setLead).not.toHaveBeenCalled();
    setLead.mockRestore();
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
