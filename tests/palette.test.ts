import { describe, expect, it, vi } from 'vitest';
import { Arrangement } from '@/audio/music/Arrangement';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { LAZY_SOUND_IDS, soundsFor, unneeded } from '@/audio/music/palette';
import { PAD_CHOP } from '@/audio/music/patterns';
import { compileSong, SectionDef, SongDef, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { DifficultyLevel } from '@/match/difficulty';
import { fakeAudioContext } from './helpers/fakeAudioContext';

const song = (def: Partial<SongDef>, section: Partial<SectionDef> = {}) =>
  compileSong({
    title: 'Palette',
    bpm: 120,
    swing: 0,
    voices: { lead: 'marimba', counter: 'bell', arp: 'square', bass: 'bassSlap', pad: 'choir' },
    kit: 'japan',
    ...def,
    sections: [
      {
        name: 'verse',
        tier: 'groove',
        chords: 'Am | F',
        bass: 'long',
        drums: 'none',
        pad: 'hold',
        stabs: 'comp',
        stabsVoice: 'rhodes',
        hits: { siren: 'x' + '.'.repeat(31) },
        ...section,
      },
    ],
  });

describe('the palette a song needs rendered', () => {
  it('is the extra sounds it plays, and none of the core ones', () => {
    const { pitched, oneShots } = soundsFor(song({}));
    expect(Object.keys(pitched).sort()).toEqual(
      ['bassSlap', 'leadMarimba', 'padChoir', 'stabRhodes'].sort(),
    );
    expect(Object.keys(oneShots).sort()).toEqual(
      ['gong', 'hyoshigi', 'odaiko', 'siren', 'woodblock'].sort(),
    );
  });

  it('takes in the stand’s swaps', () => {
    const plain = song(
      { voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'bassSaw' }, kit: undefined },
      { stabs: undefined, stabsVoice: undefined, hits: undefined },
    );
    expect(soundsFor(plain)).toEqual({ pitched: {}, oneShots: {} });
    const swapped = soundsFor(plain, {
      lead: 'harp',
      bass: 'bassGrowl',
      pad: 'reverse',
      kit: 'factory',
    });
    expect(Object.keys(swapped.pitched).sort()).toEqual(['bassGrowl', 'leadHarp', 'padReverse']);
    expect(Object.keys(swapped.oneShots).sort()).toEqual(['chain', 'steam', 'synthCymbal']);
  });
});

describe('the wider palette’s sounds freed', () => {
  it('are those neither the song playing nor the next one plays', () => {
    const rain = SONGS.find((s) => s.title === 'Kabukicho Rain')!;
    const temple = SONGS.find((s) => s.title === 'Firefly Temple')!;
    const free = unneeded([rain, temple]);
    for (const kept of [
      'leadMusicBox',
      'leadShamisen',
      'rainstick',
      'leadGamelan',
      'sampho',
      'chhing',
    ]) {
      expect(free).not.toContain(kept);
    }
    for (const freed of ['leadShakuhachi', 'odaiko', 'conga', 'bassSlap', 'padChoir']) {
      expect(free).toContain(freed);
    }
    expect(free.every((id) => LAZY_SOUND_IDS.includes(id))).toBe(true);
  });
});

describe('the arrangement with the wider palette', () => {
  const play = (compiled: ReturnType<typeof song>, bars = 2) => {
    const { ctx } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const instruments = new Instruments(graph);
    const spies = {
      pad: vi.spyOn(instruments, 'pad'),
      stab: vi.spyOn(instruments, 'stab'),
      bass: vi.spyOn(instruments, 'bass'),
      fxHit: vi.spyOn(instruments, 'fxHit'),
    };
    const arrangement = new Arrangement(instruments, graph);
    const section = compiled.sections[0];
    const step = 60 / compiled.bpm / 4;
    for (let s = 0; s < bars * STEPS_PER_BAR; s++) {
      arrangement.playStep({
        time: s * step,
        stepDuration: step,
        song: compiled,
        section,
        bar: Math.floor(s / STEPS_PER_BAR) % section.bars,
        stepInBar: s % STEPS_PER_BAR,
        isLastBar: false,
        nextBarChord: section.chords[0],
        intensity: 1,
        climaxLevel: 0,
        difficulty: DifficultyLevel.NORMAL,
      });
    }
    return spies;
  };

  it('chops the pad into its gate, on the song’s pad voice', () => {
    const { pad } = play(song({}, { pad: 'chop', stabs: undefined }), 1);
    const gates = [...PAD_CHOP].filter((c) => c !== '.').length;
    expect(pad).toHaveBeenCalledTimes(gates);
    expect(pad.mock.calls.every((call) => call[6] === 'choir')).toBe(true);
  });

  it('plays the stabs on the section’s stab voice', () => {
    const { stab } = play(song({}), 1);
    expect(stab).toHaveBeenCalled();
    expect(stab.mock.calls.every((call) => call[4] === 'rhodes')).toBe(true);
  });

  it('slides the bass into a joined note when the song glides it', () => {
    const glided = song(
      { voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'bass808', bassGlide: 0.08 } },
      { bassLine: 'A1 - - - - - - - E2 - - - - - - - | F1 - - - - - - - C2 - - - - - - -' },
    );
    const { bass } = play(glided);
    const glides = bass.mock.calls.map((call) => call[7]);
    expect(glides[0]).toBeUndefined();
    expect(glides.slice(1).every((glide) => glide?.time === 0.08)).toBe(true);
    const plain = play(song({}, { bassLine: 'A1 - - - - - - - E2 - - - - - - -' }));
    expect(plain.bass.mock.calls.every((call) => call[7] === undefined)).toBe(true);
  });

  it('strikes a hit on its pattern, through the section', () => {
    const { fxHit } = play(song({}), 4);
    // Once every two bars over four
    expect(fxHit.mock.calls.map((call) => call[0])).toEqual(['siren', 'siren']);
  });
});
