import { describe, expect, it } from 'vitest';
import { LeadVoice } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { PITCHED_SAMPLES, PitchedSampleId } from '@/audio/samples/pitched';
import { isSceneId } from '@/shared/scenes';

// The lead voices played from rendered instruments, and how far a note may sit from a root
const SAMPLED: Partial<Record<LeadVoice, PitchedSampleId>> = {
  saw: 'supersaw',
  square: 'squareLead',
  pluck: 'pluck',
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
          const sample = SAMPLED[voice];
          if (!sample || !line) continue;
          const { roots } = PITCHED_SAMPLES[sample];
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

  it('gives each backdrop one song of its own at most', () => {
    const scenes = SONGS.flatMap((song) => (song.scene ? [song.scene] : []));
    expect(new Set(scenes).size).toBe(scenes.length);
    expect(scenes.every(isSceneId)).toBe(true);
  });

  it('gives every song with a form a calm part for the menus and a peak to earn', () => {
    for (const song of SONGS) {
      const tiers = new Set(song.form.map((i) => song.sections[i].tier));
      expect(tiers.has('calm'), song.title).toBe(true);
      expect(tiers.has('high'), song.title).toBe(true);
    }
  });
});
