import { describe, expect, it } from 'vitest';
import { chordAt, compileSong, SongDef, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { isChordTone, parseChord, parseNote, voiceChord } from '@/audio/music/theory';

const song = (chords: string, lead?: string): SongDef => ({
  title: 'Test',
  bpm: 100,
  swing: 0,
  voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
  sections: [
    { name: 'verse', tier: 'groove', chords, lead, bass: 'long', drums: 'four', pad: 'hold' },
  ],
});

describe('music theory', () => {
  it('reads note names', () => {
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('C#5')).toBe(73);
    expect(parseNote('Bb3')).toBe(58);
    expect(() => parseNote('H2')).toThrow();
  });

  it('reads chord symbols, extensions and all', () => {
    expect(parseChord('Am9')).toMatchObject({
      root: 9,
      intervals: [0, 3, 7, 10, 14],
      triad: [0, 3, 7],
    });
    expect(parseChord('F#sus4')).toMatchObject({ root: 6, triad: [0, 5, 7] });
    expect(() => parseChord('Cdim13')).toThrow();
  });

  it('voices the pad close to the previous chord', () => {
    const first = voiceChord(parseChord('Am7'), null);
    const second = voiceChord(parseChord('Fmaj7'), first);
    const moved = second.reduce((sum, note, i) => sum + Math.abs(note - first[i]), 0);

    expect(moved).toBeLessThanOrEqual(2); // Am7 → Fmaj7 is a single half step
    for (const note of second) expect(isChordTone(parseChord('Fmaj7'), note)).toBe(true);
  });
});

describe('score', () => {
  it('splits bars into chords and holds melody notes over the holds', () => {
    const { sections } = compileSong(song('Am | F G', 'A4 - - . C5 . . . | E5 - - - - - - -'));
    const [section] = sections;

    expect(section.bars).toBe(2);
    expect(chordAt(section, 16).symbol).toBe('F');
    expect(chordAt(section, 24).symbol).toBe('G');
    expect(section.lead?.[0]).toEqual({ note: 69, steps: 6 });
    expect(section.lead?.[8]).toEqual({ note: 72, steps: 2 });
    expect(section.lead?.[16]).toEqual({ note: 76, steps: 16 });
  });

  it('repeats a short melody over a longer section', () => {
    const [section] = compileSong(song('Am | F | C | G', 'A4 . . . . . . .')).sections;
    expect(section.lead?.filter(Boolean)).toHaveLength(4);
  });

  it('rejects bars of the wrong length', () => {
    expect(() => compileSong(song('Am', 'A4 - -'))).toThrow();
    expect(() =>
      compileSong(song('Am | F', 'A4 . . . . . . . | A4 . . . . . . . | C5 . . . . . . .')),
    ).toThrow();
  });
});

describe('the soundtrack', () => {
  it('gives every song a section for each tier', () => {
    for (const { sections } of SONGS) {
      for (const tier of ['calm', 'groove', 'rise', 'high']) {
        expect(sections.some((section) => section.tier === tier)).toBe(true);
      }
    }
  });

  it('keeps melodies in a singable register', () => {
    for (const { sections } of SONGS) {
      for (const section of sections) {
        for (const note of [...(section.lead ?? []), ...(section.counter ?? [])]) {
          if (!note) continue;
          expect(note.note).toBeGreaterThanOrEqual(parseNote('C4'));
          expect(note.note).toBeLessThanOrEqual(parseNote('D6'));
        }
      }
    }
  });

  it('lands the melody on chord tones (or the 9th) on the strong beats', () => {
    for (const { title, sections } of SONGS) {
      for (const section of sections) {
        for (const line of [section.lead, section.counter]) {
          line?.forEach((note, step) => {
            if (!note || step % (STEPS_PER_BAR / 2) !== 0) return;
            const chord = chordAt(section, step);
            const isNinth = (note.note - chord.root - 2) % 12 === 0;
            expect(
              isChordTone(chord, note.note) || isNinth,
              `${title} ${section.name} @${step}`,
            ).toBe(true);
          });
        }
      }
    }
  });
});
