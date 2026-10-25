import { describe, expect, it } from 'vitest';
import { compileSong, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { finaleSting, hookOf } from '@/audio/music/sting';

// A verse, then a chorus whose hook holds a note across its second bar line
const song = compileSong({
  title: 'Hooked',
  bpm: 120,
  swing: 0,
  voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
  sections: [
    {
      name: 'verse',
      tier: 'groove',
      chords: 'Am',
      lead: 'A4 . . . . . . .',
      bass: 'long',
      drums: 'four',
      pad: 'hold',
    },
    {
      name: 'chorus',
      tier: 'high',
      chords: 'F | G | Am | Em',
      lead: 'C5 D5 E5 . . . G5 - | - - - . . . . . | A5 . . . . . . . | E5 . . . . . . .',
      bass: 'drive',
      drums: 'four',
      pad: 'hold',
      enter: { lead: 2 },
      silence: 4,
    },
  ],
});

describe('finale stings', () => {
  it("are made of the song's chorus, the first peak with a melody", () => {
    expect(hookOf(song).name).toBe('chorus');
    for (const each of SONGS.filter((s) => !s.sketch)) {
      expect(hookOf(each).lead, each.title).not.toBeNull();
    }
  });

  it("play a win's hook head in full, then the chord it opens on, its first note held over it", () => {
    const [head, coda] = finaleSting(song, 'win');
    expect(head.bars).toBe(2);
    expect(head.lead).toHaveLength(2 * STEPS_PER_BAR);
    // Every part from the first bar, through to the end: nothing waits, nothing falls silent
    expect(head.enter).toBeUndefined();
    expect(head.silence).toBeUndefined();
    expect(head.drop).toBe(true);

    expect(coda.chords.map((c) => c.symbol)).toEqual(['F', 'F']);
    expect(coda.lead?.[0]).toEqual({ note: 72, steps: STEPS_PER_BAR });
    expect(coda.bassLine?.[0]?.steps).toBe(STEPS_PER_BAR);
    expect(coda.stabs).toBeUndefined();
  });

  it('cut a held note where the hook stops', () => {
    const [loss] = finaleSting(song, 'loss');
    expect(loss.bars).toBe(1);
    // G5 from the bar's seventh eighth, held over the bar line: one bar leaves it four steps
    expect(loss.lead?.[12]).toEqual({ note: 79, steps: 4 });
  });

  it("end a defeat on the hook's first bar, with no coda and no drop", () => {
    const sting = finaleSting(song, 'loss');
    expect(sting).toHaveLength(1);
    expect(sting[0].drop).toBe(false);
  });

  it('give the last challenge passed the whole hook and a fanfare on its last chord', () => {
    const [head, coda] = finaleSting(song, 'allPassed');
    expect(head.bars).toBe(4);
    expect(coda.stabs).toBe('fanfare');
  });
});
