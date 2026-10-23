import { describe, expect, it } from 'vitest';
import { kickRate, KITS } from '@/audio/music/kits';
import { parseChord } from '@/audio/music/theory';

describe('drum kits', () => {
  // A timpani tuned to E, struck on every beat, clashed a semitone over B major's D sharp: like a
  // timpanist, it moves to its second drum, the chord's root
  it('keeps a tuned kick at its pitch where it fits the chord, on the root where it clashes', () => {
    const kit = KITS.cathedral;
    for (const symbol of ['Em', 'C', 'G', 'D', 'Am', 'Fmaj7', 'Cmaj7', 'Am7']) {
      expect(kickRate(kit, parseChord(symbol)), symbol).toBe(1);
    }
    // E down to B, a fourth
    expect(kickRate(kit, parseChord('B'))).toBeCloseTo(2 ** (-5 / 12));
  });

  it('never retunes a kick that isn’t tuned', () => {
    expect(kickRate(KITS.dark, parseChord('B'))).toBe(1);
  });
});
