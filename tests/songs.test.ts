import { describe, expect, it } from 'vitest';
import { LeadVoice, SongDef } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { EXTRA_LEAD_FOR, EXTRA_LEADS } from '@/audio/samples/leads';
import { PITCHED_SAMPLES, PitchedSampleId } from '@/audio/samples/pitched';
import { isSceneId } from '@/shared/scenes';

// The lead voices played from rendered instruments, and how far a note may sit from a root
const SAMPLED: Partial<Record<LeadVoice, PitchedSampleId>> = {
  saw: 'supersaw',
  square: 'squareLead',
  pluck: 'pluck',
};
/** The roots a lead voice is rendered at, from the core palette or the extra leads. */
const rootsOf = (voice: LeadVoice): number[] | null => {
  const core = SAMPLED[voice];
  if (core) return PITCHED_SAMPLES[core].roots;
  const extra = EXTRA_LEAD_FOR[voice];
  return extra ? EXTRA_LEADS[extra].roots : null;
};
const STRETCH = 3; // semitones: further, a note played from its root starts to sound stretched

describe('the soundtrack', () => {
  it('keeps every melody note where its rendered instrument sounds natural', () => {
    for (const song of SONGS) {
      for (const section of song.sections) {
        const lines: [LeadVoice, typeof section.lead][] = [
          [section.leadVoice ?? song.voices.lead, section.lead],
          [song.voices.counter, section.counter],
        ];
        for (const [voice, line] of lines) {
          const roots = rootsOf(voice);
          if (!roots || !line) continue;
          for (const note of line) {
            if (!note) continue;
            expect(note.note, `${song.title} ${section.name} ${voice}`).toBeGreaterThanOrEqual(
              roots[0] - STRETCH,
            );
            expect(note.note, `${song.title} ${section.name} ${voice}`).toBeLessThanOrEqual(
              roots[roots.length - 1] + STRETCH,
            );
          }
        }
      }
    }
  });

  it('keeps every written bass and arpeggio note where its rendered instrument sounds natural', () => {
    for (const song of SONGS) {
      for (const section of song.sections) {
        const lines: [string, typeof section.bassLine][] = [
          [song.voices.bass, section.bassLine],
          [song.voices.arp, section.arpLine],
        ];
        for (const [voice, line] of lines) {
          if (!line || !(voice in PITCHED_SAMPLES)) continue;
          const { roots } = PITCHED_SAMPLES[voice as PitchedSampleId];
          for (const note of line) {
            if (!note) continue;
            const where = `${song.title} ${section.name} ${voice}`;
            expect(note.note, where).toBeGreaterThanOrEqual(roots[0] - STRETCH);
            expect(note.note, where).toBeLessThanOrEqual(roots[roots.length - 1] + STRETCH);
          }
        }
      }
    }
  });

  it('gives each backdrop one song of its own at most', () => {
    const scenes = SONGS.flatMap((song) => (song.scene ? [song.scene] : []));
    expect(new Set(scenes).size).toBe(scenes.length);
    expect(scenes.every(isSceneId)).toBe(true);
  });

  it('gives every song a calm part for the menus and a peak to earn (sketches: a hook)', () => {
    for (const song of SONGS.filter((s) => !s.sketch)) {
      const tiers = new Set(song.form.map((i) => song.sections[i].tier));
      expect(tiers.has('calm'), song.title).toBe(true);
      expect(tiers.has('high'), song.title).toBe(true);
    }
  });
});

describe('sketches', () => {
  it('are never played by the game: never picked as the next song', async () => {
    const { Conductor } = await import('@/audio/music/Conductor');
    const { compileSong } = await import('@/audio/music/score');
    const sketch = compileSong({
      ...SONG_DEFS_FOR_TEST,
      title: 'A Sketch',
      sketch: true,
    });
    const songs = [...SONGS.filter((song) => !song.sketch), sketch];
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      const conductor = new Conductor(songs, 0, 'groove', () => roll);
      conductor.enterScene('lasers');
      for (let i = 0; i < 6; i++) {
        conductor.skip('groove');
        conductor.advance();
        expect(conductor.song.sketch, conductor.song.title).toBeFalsy();
      }
    }
  });
});

/** A song of one section, enough for the sketch above. */
const SONG_DEFS_FOR_TEST: Omit<SongDef, 'title'> = {
  bpm: 120,
  swing: 0,
  voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
  sections: [
    { name: 'hook', tier: 'groove', chords: 'Am', bass: 'long', drums: 'four', pad: 'hold' },
  ],
};
