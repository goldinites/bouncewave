import { describe, expect, it, vi } from 'vitest';
import { Arrangement, MusicLayer, StepContext } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { compileSong, SectionDef, Tier } from '@/audio/music/score';
import { SampleBank } from '@/audio/samples/SampleBank';
import { DifficultyLevel } from '@/match/difficulty';
import { AudioCall, fakeAudioContext } from './helpers/fakeAudioContext';

const buffer = (duration: number) => ({ duration, length: 1, numberOfChannels: 1 }) as AudioBuffer;

describe('Instruments.transition', () => {
  const setup = (rendered = true) => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const bank = new SampleBank();
    vi.spyOn(bank, 'pick').mockImplementation(() => (rendered ? buffer(4) : null));
    const play = new Instruments(graph, bank);
    const starts = () => calls.filter((c) => c.method === 'start').map((c) => c.args);
    return { play, graph, calls, starts };
  };

  it('places a swell so it ends on the downbeat it leads into', () => {
    const { play, starts } = setup();

    play.transition('riser', 10, 0.07, 16);
    expect(starts().at(-1)).toEqual([12]);
  });

  it('starts a swell part-way through when there isn’t time for all of it', () => {
    const { play, starts } = setup();

    play.transition('riser', 10, 0.07, 13);
    // Four seconds long, three to go: it starts one second in
    expect(starts().at(-1)).toEqual([10, 1]);
  });

  it('plays the boom with the drums and the rest straight into the mix', () => {
    const { play, graph, calls } = setup();
    const connectedTo = (node: AudioNode) => calls.some((c) => c.args[0] === node);

    play.transition('downlifter', 1, 0.08);
    expect(connectedTo(graph.bus)).toBe(true);
    expect(connectedTo(graph.drums)).toBe(false);
    play.transition('boom', 1, 0.5);
    expect(connectedTo(graph.drums)).toBe(true);
  });

  it('says so when it isn’t rendered yet', () => {
    expect(setup(false).play.transition('riser', 1, 0.07, 5)).toBe(false);
  });
});

describe('the transitions of a song', () => {
  const section = (name: string, tier: Tier, extra: Partial<SectionDef> = {}): SectionDef => ({
    name,
    tier,
    chords: 'Am | Am',
    bass: 'long',
    drums: 'four',
    pad: 'none',
    ...extra,
  });
  const song = compileSong({
    title: 'Test',
    bpm: 120,
    swing: 0,
    voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
    sections: [
      section('intro', 'calm'),
      section('verse', 'groove'),
      section('build', 'rise', { riser: true }),
      section('chorus', 'high'),
    ],
  });

  const setup = (muted: MusicLayer[] = []) => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const play = new Instruments(graph, new SampleBank());
    const transition = vi.spyOn(play, 'transition').mockReturnValue(true);
    const arrangement = new Arrangement(play, graph, new Set(muted));
    /** The first step of `name`, entered from a section of `from`. */
    const enter = (name: string, from: Tier | null, intensity = 0.3) => {
      const target = song.sections.find((s) => s.name === name)!;
      const context: StepContext = {
        time: 10,
        stepDuration: 0.125,
        song,
        section: target,
        bar: 0,
        stepInBar: 0,
        isLastBar: false,
        nextBarChord: target.chords[0],
        previousTier: from,
        intensity,
        climaxLevel: 0,
        difficulty: DifficultyLevel.NORMAL,
      };
      arrangement.playStep(context);
    };
    const played = () => transition.mock.calls.map(([id]) => id);
    return { arrangement, enter, played, transition, calls: calls as AudioCall[] };
  };

  it('rises out of a build onto the next section’s downbeat', () => {
    const { enter, played, transition } = setup();

    enter('build', 'groove');
    expect(played()).toEqual(['riser', 'reverseCrash']);
    // Two bars at 120 BPM: the riser ends four seconds on
    expect(transition.mock.calls[0][3]).toBe(14);
  });

  it('adds the tonal riser when the match is hot', () => {
    const { enter, played } = setup();

    enter('build', 'groove', 0.9);
    expect(played()).toEqual(['riser', 'riserTone', 'reverseCrash']);
  });

  it('falls away when the music comes down from the heat, and breathes in out of the calm', () => {
    const { enter, played, transition } = setup();

    enter('intro', 'high');
    expect(played()).toEqual(['downlifter']);
    transition.mockClear();
    enter('verse', 'calm');
    expect(played()).toEqual(['noiseWave']);
    transition.mockClear();
    enter('verse', 'groove');
    enter('chorus', 'rise');
    enter('intro', null);
    expect(played()).toEqual([]);
  });

  it('booms under the drop, and stays quiet with the fx layer silenced', () => {
    const { arrangement, played } = setup();
    arrangement.playDrop(10, song.sections[0].chords[0], 0.125);
    expect(played()).toEqual(['boom']);

    const silenced = setup(['fx']);
    silenced.enter('build', 'groove', 0.9);
    silenced.enter('intro', 'high');
    silenced.arrangement.playDrop(10, song.sections[0].chords[0], 0.125);
    expect(silenced.played()).toEqual([]);
  });
});

describe('Conductor.cameFrom', () => {
  it('remembers the tier of the section before this one', () => {
    const def = (name: string, tier: Tier): SectionDef => ({
      name,
      tier,
      chords: 'Am',
      bass: 'long',
      drums: 'four',
      pad: 'none',
    });
    const songs = [
      compileSong({
        title: 'One',
        bpm: 100,
        swing: 0,
        voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
        sections: [def('intro', 'calm'), def('verse', 'groove')],
      }),
    ];
    const conductor = new Conductor(songs, 0);
    expect(conductor.cameFrom).toBeNull();

    conductor.plan('groove');
    conductor.advance();
    expect(conductor.section.name).toBe('verse');
    expect(conductor.cameFrom).toBe('calm');
  });
});
