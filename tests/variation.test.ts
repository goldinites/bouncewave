import { describe, expect, it, vi } from 'vitest';
import { Arrangement, StepContext } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { compileSong, SectionDef, STEPS_PER_BAR } from '@/audio/music/score';
import { barVariation, feelStep } from '@/audio/music/variation';
import { SampleBank } from '@/audio/samples/SampleBank';
import { DifficultyLevel } from '@/match/difficulty';
import { fakeAudioContext } from './helpers/fakeAudioContext';

describe('barVariation', () => {
  it('plays a part as written the first time', () => {
    const first = barVariation('night-drive', 'verse', 0, 3);
    expect(first.ghostSnares.size + first.bassOctaves.size + first.arpShift).toBe(0);
    expect(first.phraseFill).toBe(false);
  });

  it('varies it on every repeat, more on later ones, the same way for the same bar', () => {
    const bars = (pass: number) =>
      Array.from({ length: 32 }, (_, bar) => barVariation('night-drive', 'verse', pass, bar));
    const count = (pass: number) =>
      bars(pass).reduce((sum, v) => sum + v.ghostSnares.size + v.bassOctaves.size, 0);

    expect(count(1)).toBeGreaterThan(0);
    expect(count(2)).toBeGreaterThan(count(1));
    expect(barVariation('night-drive', 'verse', 1, 5)).toEqual(
      barVariation('night-drive', 'verse', 1, 5),
    );
    expect(barVariation('night-drive', 'verse', 1, 5)).not.toEqual(
      barVariation('night-drive', 'verse', 2, 5),
    );
  });

  it('ghosts only off-beats, fills the end of every phrase and shifts every second bar', () => {
    for (let bar = 0; bar < 8; bar++) {
      const variation = barVariation('song', 'part', 2, bar);
      for (const step of variation.ghostSnares) expect(step % 2).toBe(1);
      expect(variation.phraseFill).toBe(bar % 4 === 3);
      expect(variation.arpShift > 0).toBe(bar % 2 === 1);
    }
  });
});

describe('feelStep', () => {
  const steps = (feel: 'half' | 'double' | undefined, bar: number) =>
    Array.from({ length: STEPS_PER_BAR }, (_, s) => feelStep(feel, s, bar));

  it('reads the pattern as written without a feel', () => {
    expect(steps(undefined, 0)).toEqual(Array.from({ length: 16 }, (_, s) => s));
  });

  it('stretches it over two bars in half-time', () => {
    expect(steps('half', 0)).toEqual([
      0,
      null,
      1,
      null,
      2,
      null,
      3,
      null,
      4,
      null,
      5,
      null,
      6,
      null,
      7,
      null,
    ]);
    expect(steps('half', 1)[0]).toBe(8);
    expect(steps('half', 1)[14]).toBe(15);
  });

  it('squeezes it into half a bar in double-time', () => {
    expect(steps('double', 0).slice(0, 8)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(steps('double', 0).slice(8)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  });
});

describe('the arrangement on a repeat', () => {
  const section = (extra: Partial<SectionDef>): SectionDef => ({
    name: 'verse',
    tier: 'groove',
    chords: 'Am | Am | Am | Am',
    bass: 'long',
    drums: 'four',
    pad: 'none',
    ...extra,
  });
  const songWith = (extra: Partial<SectionDef>) =>
    compileSong({
      title: 'Test',
      bpm: 120,
      swing: 0,
      voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [section(extra)],
    });

  const setup = (extra: Partial<SectionDef> = {}) => {
    const song = songWith(extra);
    const { ctx } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const play = new Instruments(graph, new SampleBank());
    const spies = {
      drum: vi.spyOn(play, 'drum'),
      lead: vi.spyOn(play, 'lead'),
      cutOut: vi.spyOn(graph, 'cutOut'),
      transition: vi.spyOn(play, 'transition').mockReturnValue(true),
    };
    const arrangement = new Arrangement(play, graph);
    const target = song.sections[0];
    /** Plays bar `bar` of the section's `pass`. */
    const bar = (index: number, pass = 0) => {
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const context: StepContext = {
          time: index * 2 + s * 0.125,
          stepDuration: 0.125,
          song,
          section: target,
          bar: index,
          stepInBar: s,
          isLastBar: index === target.bars - 1,
          nextBarChord: target.chords[0],
          intensity: 1,
          climaxLevel: 0,
          pass,
          difficulty: DifficultyLevel.NORMAL,
        };
        arrangement.playStep(context);
      }
    };
    const hitsOf = (role: string) => spies.drum.mock.calls.filter(([, r]) => r === role);
    return { bar, spies, hitsOf };
  };

  it('plays the kick at half the rate in half-time, the hats as written', () => {
    const plain = setup();
    plain.bar(0);
    const half = setup({ feel: 'half' });
    half.bar(0);

    // 'four': a kick on every beat; in half-time two of them fall in this bar
    expect(plain.hitsOf('kick')).toHaveLength(4);
    expect(half.hitsOf('kick')).toHaveLength(2);
    expect(half.hitsOf('hat')).toHaveLength(plain.hitsOf('hat').length);
  });

  it('ends a phrase with a snare fill on a repeat, not the first time', () => {
    const first = setup();
    first.bar(3, 0);
    const again = setup();
    again.bar(3, 1);
    // The fill doesn't play over the section's own last-bar fill: four bars, bar 3 is the last
    expect(again.hitsOf('snare').length).toBeGreaterThanOrEqual(first.hitsOf('snare').length);
  });

  it('answers the lead with the counter voice when the lead rests on a repeat', () => {
    const call = 'A4 - C5 - E5 - . . | . . . . . . . . | A4 . . . . . . . | . . . . . . . .';
    const first = setup({ lead: call });
    first.bar(0, 0);
    first.bar(1, 0);
    const again = setup({ lead: call });
    again.bar(0, 1);
    again.bar(1, 1);

    const voices = (calls: unknown[][]) => calls.map(([voice]) => voice);
    expect(voices(first.spies.lead.mock.calls)).toEqual(['saw', 'saw', 'saw']);
    // The answer: the three notes of bar 0, an octave up, on the counter's bell
    const answer = again.spies.lead.mock.calls.filter(([voice]) => voice === 'bell');
    expect(answer.map(([, note]) => note)).toEqual([69 + 12, 72 + 12, 76 + 12]);
  });

  it('stops dead for a break’s silence, then lets the next section hit', () => {
    const { bar, spies } = setup({ silence: 4 });
    for (let i = 0; i < 4; i++) bar(i);

    // The last four steps of the last bar: the whole music cut, nothing new started
    expect(spies.cutOut).toHaveBeenCalledWith(3 * 2 + 12 * 0.125, 4 * 0.125);
    const lateHits = spies.drum.mock.calls.filter(([, , time]) => (time as number) >= 3 * 2 + 1.5);
    expect(lateHits).toEqual([]);
  });

  it('opens a drop section with the drop', () => {
    const { bar, spies, hitsOf } = setup({ drop: true });
    bar(0);
    expect(spies.transition.mock.calls.map(([id]) => id)).toContain('boom');
    expect(hitsOf('kick')[0][3]).toBe(1);
  });
});

describe('Conductor.pass', () => {
  it('counts how many times a section has played before in the song', () => {
    const def = (name: string): SectionDef => ({
      name,
      tier: 'groove',
      chords: 'Am',
      bass: 'long',
      drums: 'four',
      pad: 'none',
    });
    const song = compileSong({
      title: 'One',
      bpm: 100,
      swing: 0,
      voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [def('a'), def('b')],
    });
    const conductor = new Conductor([song], 0, 'groove');
    const passes = Array.from({ length: 5 }, () => {
      const seen = `${conductor.section.name}${conductor.pass}`;
      conductor.plan('groove');
      conductor.advance();
      return seen;
    });
    expect(passes).toEqual(['a0', 'b0', 'a1', 'b1', 'a2']);
  });
});

describe('sweepAt', () => {
  it('moves a layer’s filter from its start to its end over the section, log-evenly', async () => {
    const { sweepAt } = await import('@/audio/music/Arrangement');
    const song = compileSong({
      title: 'Sweep',
      bpm: 120,
      swing: 0,
      voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [
        {
          name: 'hook',
          tier: 'groove',
          chords: 'Am | Am | Am | Am',
          bass: 'long',
          drums: 'four',
          pad: 'hold',
          sweep: { arp: [0.25, 4] },
        },
      ],
    });
    const section = song.sections[0];
    expect(sweepAt(section, 'arp', 0)).toBe(0.25);
    expect(sweepAt(section, 'arp', 32)).toBeCloseTo(1);
    expect(sweepAt(section, 'pads', 32)).toBe(1);
  });
});
