import { describe, expect, it, vi } from 'vitest';
import { Arrangement } from '@/audio/music/Arrangement';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { KITS } from '@/audio/music/kits';
import { LAZY_SOUND_IDS, soundsFor, unneeded } from '@/audio/music/palette';
import { PAD_CHOP } from '@/audio/music/patterns';
import { compileSong, SectionDef, SongDef, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { finaleSting } from '@/audio/music/sting';
import { ACTION_PITCHED, ACTION_SAMPLES } from '@/audio/samples/actions';
import { SampleBank } from '@/audio/samples/SampleBank';
import { TRANSITION_SAMPLES } from '@/audio/samples/transitions';
import { DifficultyLevel } from '@/match/difficulty';
import { fakeAudioContext } from './helpers/fakeAudioContext';

const song = (def: Partial<SongDef>, section: Partial<SectionDef> = {}) =>
  compileSong({
    title: 'Palette',
    bpm: 120,
    swing: 0,
    voices: { lead: 'marimba', counter: 'bell', arp: 'square', bass: 'bassSlap', pad: 'reverse' },
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
  it('is every sound it plays, core and wider palette alike, and the brass of its fanfare', () => {
    const { pitched, oneShots } = soundsFor(song({}));
    // The arpeggio and counter play live (square, bell): nothing rendered for them
    expect(Object.keys(pitched).sort()).toEqual(
      ['bassSlap', 'brass', 'leadMarimba', 'padReverse', 'stabRhodes'].sort(),
    );
    expect(Object.keys(oneShots).sort()).toEqual(
      [...new Set<string>([...Object.values(KITS.japan), 'siren'])].sort(),
    );
  });

  it('never takes the action sounds or the transitions, which stay rendered', () => {
    for (const song of SONGS) {
      const { pitched, oneShots } = soundsFor(song);
      for (const id of [...Object.keys(pitched), ...Object.keys(oneShots)]) {
        expect(id in TRANSITION_SAMPLES || id in ACTION_SAMPLES || id in ACTION_PITCHED, id).toBe(
          false,
        );
        expect(LAZY_SOUND_IDS).toContain(id);
      }
    }
  });

  it('takes in the stand’s swaps', () => {
    const plain = song(
      { voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'bassSaw' }, kit: undefined },
      { stabs: undefined, stabsVoice: undefined, hits: undefined },
    );
    const own = soundsFor(plain);
    expect(Object.keys(own.pitched).sort()).toEqual(['bassSaw', 'brass', 'pad', 'supersaw']);
    const swapped = soundsFor(plain, {
      lead: 'harp',
      bass: 'bassGrowl',
      pad: 'reverse',
      kit: 'factory',
    });
    expect(Object.keys(swapped.pitched).sort()).toEqual([
      'bassGrowl',
      'brass',
      'leadHarp',
      'padReverse',
      'supersaw',
    ]);
    expect(Object.keys(swapped.oneShots)).toEqual(
      expect.arrayContaining(['chain', 'steam', 'synthCymbal']),
    );
    expect(Object.keys(swapped.oneShots).sort()).toEqual(
      [...new Set(Object.values(KITS.factory))].sort(),
    );
  });

  it('takes the leads’ low twins only for a song whose melody goes under D4', () => {
    const bars = (a: string, b: string) => `${a}${' -'.repeat(15)} | ${b}${' -'.repeat(15)}`;
    const high = soundsFor(song({}, { lead: bars('E4', 'D4') }));
    expect(high.pitched).not.toHaveProperty('leadMarimbaLow');
    const low = soundsFor(song({}, { lead: bars('E4', 'G3') }));
    expect(low.pitched).toHaveProperty('leadMarimbaLow');
    expect(low.pitched.leadMarimbaLow.roots.every((root) => root < 62)).toBe(true);
    // A core lead's twin, with the lead
    const saw = { lead: 'saw', counter: 'bell', arp: 'square', bass: 'bassSlap' } as const;
    const core = soundsFor(song({ voices: saw }, { lead: bars('E4', 'E3') }));
    expect(core.pitched).toHaveProperty('supersawLow');
    expect(core.pitched).toHaveProperty('supersaw');
  });
});

describe('every song', () => {
  // A sound a song asks for that isn't rendered ahead of it plays on its live synth all along:
  // every part is played here at a calm and a full heat, with its drop and its turns, and the
  // finales' stings too, and every sound asked of the bank must be one the song renders
  it.each(SONGS.map((song) => [song.title, song] as const))(
    '%s asks only for the sounds rendered for it',
    (_title, played) => {
      const asked = new Set<string>();
      const bank = new SampleBank();
      bank.pick = (id: string) => (asked.add(id), null);
      bank.pickNote = (id: string) => (asked.add(id), null);
      const { ctx } = fakeAudioContext();
      const graph = new MusicGraph(ctx);
      const arrangement = new Arrangement(new Instruments(graph, bank), graph);
      const step = 60 / played.bpm / 4;
      const parts = [
        ...played.sections,
        ...finaleSting(played, 'win'),
        ...finaleSting(played, 'loss'),
      ];
      let time = 0;
      for (const [i, section] of parts.entries()) {
        for (const climaxLevel of [0, 1]) {
          if (climaxLevel) arrangement.playDrop(time, section.chords[0], step, played.transitions);
          for (let s = 0; s < section.bars * STEPS_PER_BAR; s++) {
            const bar = Math.floor(s / STEPS_PER_BAR);
            arrangement.playStep({
              time,
              stepDuration: step,
              song: played,
              section,
              bar,
              stepInBar: s % STEPS_PER_BAR,
              isLastBar: bar === section.bars - 1,
              nextBarChord: section.chords[0],
              previousTier: i % 2 ? 'calm' : 'high',
              pass: i % 3,
              intensity: climaxLevel ? 1 : 0.2,
              climaxLevel,
              isOvertime: climaxLevel === 1,
              difficulty: DifficultyLevel.HARD,
            });
            time += step;
          }
        }
      }
      const { pitched, oneShots } = soundsFor(played);
      const rendered = new Set([...Object.keys(pitched), ...Object.keys(oneShots)]);
      const missing = [...asked].filter((id) => LAZY_SOUND_IDS.includes(id) && !rendered.has(id));
      expect(missing).toEqual([]);
      // The rest it asks for are rendered at the start and kept: the transitions
      for (const id of [...asked].filter((id) => !LAZY_SOUND_IDS.includes(id))) {
        expect(id in TRANSITION_SAMPLES || id in ACTION_SAMPLES || id in ACTION_PITCHED, id).toBe(
          true,
        );
      }
    },
  );
});

describe('the songs’ sounds freed', () => {
  it('are those neither the song playing nor the next one plays', () => {
    const rain = SONGS.find((s) => s.title === 'Kabukicho Rain')!;
    const fuji = SONGS.find((s) => s.title === 'Above the Clouds')!;
    const free = unneeded([rain, fuji]);
    for (const kept of ['leadMusicBox', 'leadShamisen', 'rainstick', 'leadShakuhachi', 'odaiko']) {
      expect(free).not.toContain(kept);
    }
    for (const freed of ['leadGamelan', 'chhing', 'conga', 'bassSlap', 'padStrings']) {
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
    expect(pad.mock.calls.every((call) => call[6] === 'reverse')).toBe(true);
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
