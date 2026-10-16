import { describe, expect, it } from 'vitest';
import { Arrangement } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Instruments } from '@/audio/music/Instruments';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { STEPS_PER_BAR, Tier } from '@/audio/music/score';
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
  });
});
