import { describe, expect, it, vi } from 'vitest';
import { Arrangement } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { MUSIC_LAYERS, MusicLayer, STEPS_PER_BAR, Tier } from '@/audio/music/score';
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
    const song = SONGS.find((s) => s.title === 'No Carrier')!;
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

  it('plays nothing of the layers the listening stand silences', () => {
    const notesWith = (muted: MusicLayer[]) => {
      const { ctx, calls } = fakeAudioContext();
      const graph = new MusicGraph(ctx);
      const arrangement = new Arrangement(new Instruments(graph), graph, new Set(muted));
      const song = SONGS[0];
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
      return calls.filter((c) => /^create(Oscillator|BufferSource)$/.test(c.method)).length;
    };

    const all = notesWith([]);
    expect(notesWith([...MUSIC_LAYERS])).toBe(0);
    for (const layer of MUSIC_LAYERS) {
      const without = notesWith([layer]);
      expect(without, layer).toBeLessThan(all);
    }
  });
});
