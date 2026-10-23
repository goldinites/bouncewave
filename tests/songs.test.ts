import { describe, expect, it } from 'vitest';
import { LeadVoice, MelodyNote, SongDef, STEPS_PER_BAR } from '@/audio/music/score';
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
          [section.counterVoice ?? song.voices.counter, section.counter],
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

  // What the ear hears as a melody's rhythm: where its notes start. Over eight bars one bar's
  // rhythm may come back (a, a'), but not in most bars, and a two-bar phrase at most twice: a
  // line that repeats one rhythm is a loop, the "ту ту туру" heard in every part of a song
  it('never loops one rhythm through a melody', () => {
    const onsets = (line: readonly (unknown | null)[], from: number, bars: number) =>
      line
        .slice(from, from + bars * STEPS_PER_BAR)
        .map((note) => (note ? 'x' : '.'))
        .join('');
    const most = (rhythms: string[]) =>
      Math.max(...rhythms.map((r) => rhythms.filter((other) => other === r).length));
    for (const song of SONGS) {
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        for (let from = 0; from + 8 * STEPS_PER_BAR <= lead.length; from += 8 * STEPS_PER_BAR) {
          const bars = [0, 1, 2, 3, 4, 5, 6, 7]
            .map((bar) => onsets(lead, from + bar * STEPS_PER_BAR, 1))
            .filter((rhythm) => rhythm.includes('x'));
          const phrases = [0, 2, 4, 6].map((bar) => onsets(lead, from + bar * STEPS_PER_BAR, 2));
          expect(most(bars), `${song.title} ${name}: one bar's rhythm`).toBeLessThanOrEqual(3);
          expect(most(phrases), `${song.title} ${name}: one phrase's rhythm`).toBeLessThanOrEqual(
            2,
          );
        }
      }
    }
  });

  /** A melody's notes in order, each with its length. */
  const notesOf = (line: readonly (MelodyNote | null)[]) =>
    line.filter((note): note is MelodyNote => note !== null);

  // Every 5.6a melody climbed into a long note by a pickup run, and the tracks sounded like one
  // tune on different sounds: a song may climb that way once in eight bars, no more
  it('climbs into a long note by a pickup run at most once in eight bars', () => {
    for (const song of SONGS) {
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        const notes = notesOf(lead);
        let runs = 0;
        for (let i = 0; i + 3 < notes.length; i++) {
          const [a, b, c, target] = notes.slice(i, i + 4);
          const climbs = [b.note - a.note, c.note - b.note, target.note - c.note].every(
            (step) => step >= 1 && step <= 4,
          );
          const isPickup = [a, b, c].every((note) => note.steps <= 2);
          if (climbs && isPickup && target.steps > c.steps) runs++;
        }
        const eights = Math.max(1, lead.length / (8 * STEPS_PER_BAR));
        expect(runs, `${song.title} ${name}`).toBeLessThanOrEqual(eights);
      }
    }
  });

  // Tracks must not share a melody: a figure of five notes — its four intervals and five
  // lengths — belongs to one song (its versions aside)
  it('gives no two songs the same five-note figure', () => {
    const owner = new Map<string, string>();
    for (const song of SONGS) {
      const track = song.title.replace(/ v\d+$/, '');
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        const notes = notesOf(lead);
        for (let i = 0; i + 4 < notes.length; i++) {
          const five = notes.slice(i, i + 5);
          const figure = five
            .map((note, j) => `${j ? note.note - five[j - 1].note : ''}:${note.steps}`)
            .join(' ');
          const other = owner.get(figure);
          expect(other === undefined || other === track, `${track} ${name} and ${other}`).toBe(
            true,
          );
          owner.set(figure, track);
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
