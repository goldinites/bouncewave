import { describe, expect, it, vi } from 'vitest';
import { Arrangement } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { compileSong, MUSIC_LAYERS, MusicLayer, STEPS_PER_BAR, Tier } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { DifficultyLevel } from '@/match/difficulty';
import { fakeAudioContext } from './helpers/fakeAudioContext';

// Oscillators one bar may start at most, so phones keep up even at full climax
const OSCILLATORS_PER_BAR = 120;

describe('Arrangement', () => {
  it('plays every section of every song within the voice budget', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const arrangement = new Arrangement(new Instruments(graph), graph);

    SONGS.forEach((song, songIndex) => {
      song.sections.forEach((section) => {
        const conductor = new Conductor(SONGS, songIndex, section.tier as Tier);
        for (let bar = 0; bar < section.bars; bar++) {
          const before = calls.filter((c) => c.method === 'createOscillator').length;
          for (let stepInBar = 0; stepInBar < STEPS_PER_BAR; stepInBar++) {
            if (stepInBar === 8) conductor.plan(conductor.section.tier);
            arrangement.playStep({
              time: bar,
              stepDuration: 60 / song.bpm / 4,
              song: conductor.song,
              section: conductor.section,
              bar: conductor.bar,
              stepInBar,
              isLastBar: conductor.isLastBar,
              nextBarChord: conductor.nextBarChord,
              intensity: 1,
              climaxLevel: 1,
              difficulty: DifficultyLevel.INSANE,
            });
          }
          conductor.advance();
          const started = calls.filter((c) => c.method === 'createOscillator').length - before;
          expect(started, `${song.title} ${section.name}`).toBeLessThanOrEqual(OSCILLATORS_PER_BAR);
        }
      });
    });
  }, 20000); // every section of every song, the versions on the stand included: seconds of work

  it('cuts the music out and rewinds it over the last bar of a section that breaks down', () => {
    const { ctx } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const cutOut = vi.spyOn(graph, 'cutOut');
    const rewind = vi.spyOn(graph, 'rewind');
    const arrangement = new Arrangement(new Instruments(graph), graph);
    // A song that breaks down, as a challenge's may: the line drops out, then the tape rewinds
    const song = compileSong({
      title: 'Broken',
      bpm: 104,
      swing: 0,
      voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [
        {
          name: 'intro',
          tier: 'calm',
          chords: 'Am',
          bass: 'long',
          drums: 'none',
          pad: 'swell',
          glitch: 'dropout',
        },
        {
          name: 'build',
          tier: 'rise',
          chords: 'Am',
          bass: 'long',
          drums: 'four',
          pad: 'hold',
          glitch: 'rewind',
        },
      ],
    });
    const step = 60 / song.bpm / 4;

    const playLastBar = (name: string, isLastBar = true) => {
      const section = song.sections.find((s) => s.name === name)!;
      for (let stepInBar = 0; stepInBar < STEPS_PER_BAR; stepInBar++) {
        arrangement.playStep({
          time: stepInBar * step,
          stepDuration: step,
          song,
          section,
          bar: section.bars - 1,
          stepInBar,
          isLastBar,
          nextBarChord: section.chords[0],
          intensity: 1,
          climaxLevel: 0,
          difficulty: DifficultyLevel.NORMAL,
        });
      }
    };

    // The intro drops out over '..........xx.xxx': two runs, each one cut
    playLastBar('intro');
    expect(cutOut.mock.calls).toEqual([
      [10 * step, 2 * step],
      [13 * step, 3 * step],
    ]);
    // The build rewinds from the bar's middle to its end
    playLastBar('build');
    expect(rewind.mock.calls).toEqual([[8 * step, 8 * step]]);
    // Not the last bar: it plays as written
    cutOut.mockClear();
    playLastBar('intro', false);
    expect(cutOut).not.toHaveBeenCalled();
  });

  it('brings a layer in on the bar the section has it enter on', () => {
    const { ctx, calls } = fakeAudioContext();
    const graph = new MusicGraph(ctx);
    const others = MUSIC_LAYERS.filter((layer) => layer !== 'lead');
    const arrangement = new Arrangement(new Instruments(graph), graph, new Set(others));
    const song = compileSong({
      title: 'Building',
      bpm: 120,
      swing: 0,
      voices: { lead: 'square', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [
        {
          name: 'verse',
          tier: 'groove',
          chords: 'Am | Am | Am | Am',
          lead: 'A4 - - - C5 - - - | A4 - - - C5 - - - | A4 - - - C5 - - - | A4 - - - C5 - - -',
          bass: 'long',
          drums: 'none',
          pad: 'none',
          layers: { lead: 0 },
          enter: { lead: 2 },
        },
      ],
    });
    const section = song.sections[0];
    const step = 60 / song.bpm / 4;
    const notesIn = (bar: number) => {
      const before = calls.length;
      for (let stepInBar = 0; stepInBar < STEPS_PER_BAR; stepInBar++) {
        arrangement.playStep({
          time: (bar * STEPS_PER_BAR + stepInBar) * step,
          stepDuration: step,
          song,
          section,
          bar,
          stepInBar,
          isLastBar: bar === section.bars - 1,
          nextBarChord: section.chords[0],
          intensity: 1,
          climaxLevel: 0,
          difficulty: DifficultyLevel.NORMAL,
        });
      }
      return calls.slice(before).filter((c) => c.method === 'createOscillator').length;
    };

    expect(notesIn(0)).toBe(0);
    expect(notesIn(1)).toBe(0);
    expect(notesIn(2)).toBeGreaterThan(0);
    expect(notesIn(3)).toBeGreaterThan(0);
  });

  it('plays nothing of the layers the listening stand silences', () => {
    const notesWith = (muted: MusicLayer[]) => {
      const { ctx, calls } = fakeAudioContext();
      const graph = new MusicGraph(ctx);
      const arrangement = new Arrangement(new Instruments(graph), graph, new Set(muted));
      // Every song, so every layer is in it somewhere (a band's song has no swells, for one)
      for (const song of SONGS) {
        const step = 60 / song.bpm / 4;
        for (const section of song.sections) {
          for (let s = 0; s < section.bars * STEPS_PER_BAR; s++) {
            arrangement.playStep({
              time: s * step,
              stepDuration: step,
              song,
              section,
              bar: Math.floor(s / STEPS_PER_BAR),
              stepInBar: s % STEPS_PER_BAR,
              isLastBar: true,
              nextBarChord: section.chords[0],
              intensity: 1,
              climaxLevel: 1,
              difficulty: DifficultyLevel.NORMAL,
            });
          }
          arrangement.playDrop(0, section.chords[0], step);
        }
      }
      return calls.filter((c) => /^create(Oscillator|BufferSource)$/.test(c.method)).length;
    };

    const all = notesWith([]);
    expect(notesWith([...MUSIC_LAYERS])).toBe(0);
    for (const layer of MUSIC_LAYERS) {
      const without = notesWith([layer]);
      expect(without, layer).toBeLessThan(all);
    }
  });
  describe('in the match', () => {
    const song = compileSong({
      title: 'Groove',
      bpm: 120,
      swing: 0,
      voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
      sections: [
        {
          name: 'verse',
          tier: 'groove',
          chords: 'Am | F',
          lead: 'A4 - C5 - E5 - C5 -',
          bass: 'eighths',
          arp: 'up',
          drums: 'four',
          pad: 'hold',
        },
      ],
    });
    const section = song.sections[0];
    const step = 60 / song.bpm / 4;

    const setup = () => {
      const { ctx } = fakeAudioContext();
      const graph = new MusicGraph(ctx);
      const instruments = new Instruments(graph);
      const arrangement = new Arrangement(instruments, graph);
      const drums = vi.spyOn(instruments, 'drum');
      const arps = vi.spyOn(instruments, 'arp');
      /** Plays a bar of the verse, its first step at `from` steps into it. */
      const playBar = (extra: { dramaLevel?: number; isOvertime?: boolean }, from = 0) => {
        for (let s = from; s < STEPS_PER_BAR; s++) {
          arrangement.playStep({
            time: s * step,
            stepDuration: step,
            song,
            section,
            bar: 0,
            stepInBar: s,
            isLastBar: false,
            nextBarChord: section.chords[2],
            intensity: 1,
            climaxLevel: 0,
            difficulty: DifficultyLevel.NORMAL,
            ...extra,
          });
        }
      };
      const roles = () => new Set(drums.mock.calls.map((call) => call[1]));
      return { graph, drums, arps, playBar, roles };
    };

    it('thins the drums to the kick on the deciding point', () => {
      const { playBar, roles } = setup();
      playBar({ dramaLevel: 0.6 });
      expect([...roles()]).toEqual(['kick']);
    });

    it('plays the full beat once the deciding point is over', () => {
      const { playBar, roles } = setup();
      playBar({ dramaLevel: 0.1 });
      expect(roles()).toContain('snare');
    });

    it("sounds overtime's alarm on the eighths, straight into the mix, entering on a crash", () => {
      const { graph, drums, arps, playBar } = setup();
      playBar({ isOvertime: false });
      const before = arps.mock.calls.length;
      drums.mockClear();

      playBar({ isOvertime: true }, 5); // overtime starts off the beat
      const alarm = arps.mock.calls.slice(before).filter((call) => call[5] === graph.bus);
      // From the sixth step: the eighths on steps 6, 8, … 14, the octave on the off-beats
      expect(alarm.map((call) => call[2] / step)).toEqual([6, 8, 10, 12, 14]);
      const root = alarm[1][1];
      expect(alarm[0][1]).toBe(root + 12);
      expect(drums.mock.calls[0].slice(1, 3)).toEqual(['crash', 5 * step]);
      expect(drums.mock.calls.filter((call) => call[1] === 'crash')).toHaveLength(1);
    });

    it("keeps overtime's alarm through the deciding point", () => {
      const { graph, arps, playBar } = setup();
      playBar({ isOvertime: true, dramaLevel: 0.6 });
      expect(arps.mock.calls.filter((call) => call[5] === graph.bus)).toHaveLength(8);
    });
  });
});
