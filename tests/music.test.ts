import { describe, expect, it } from 'vitest';
import { HarmonyTimeline } from '@/audio/music/HarmonyTimeline';
import {
  followClimax,
  getTargetIntensity,
  getWantedTier,
  INITIAL_MUSIC_STATE,
  MUSIC_CLIMAX_RELEASE,
  MusicState,
  stepIntensity,
} from '@/audio/music/intensity';
import { RALLY_HEAT_MAX } from '@/match/heat';

const playing = (overrides: Partial<MusicState> = {}): MusicState => ({
  ...INITIAL_MUSIC_STATE,
  gameState: 'play',
  ballSpeed: 340,
  maxBallSpeed: 840,
  ...overrides,
});

describe('music intensity', () => {
  it('is calm in the menu and while serving', () => {
    const menu = getTargetIntensity(INITIAL_MUSIC_STATE, 0.5);
    const serving = getTargetIntensity(playing({ serveTime: 1 }), 0.5);

    expect(menu).toBeGreaterThan(serving);
    expect(serving).toBeLessThan(0.3);
  });

  it('holds its current value while paused', () => {
    expect(getTargetIntensity(playing({ gameState: 'paused' }), 0.73)).toBe(0.73);
  });

  it('rises with ball speed and rally length', () => {
    const slow = getTargetIntensity(playing(), 0);
    const fast = getTargetIntensity(playing({ ballSpeed: 840 }), 0);
    const hot = getTargetIntensity(playing({ ballSpeed: 840, rally: RALLY_HEAT_MAX }), 0);

    expect(fast).toBeGreaterThan(slow);
    expect(hot).toBeGreaterThan(fast);
    expect(hot).toBeCloseTo(0.9);
  });

  it('gets a lift late in the match', () => {
    const early = getTargetIntensity(playing({ scores: [2, 3] }), 0);
    const late = getTargetIntensity(playing({ scores: [6, 3] }), 0);

    expect(late - early).toBeCloseTo(0.1);
  });

  it('counts late in the match by the points that win it', () => {
    const intensity = (scores: [number, number], winningScore: number) =>
      getTargetIntensity(playing({ scores, winningScore }), 0);

    // A standard match, to 10: from 6 points on
    expect(intensity([5, 3], 10)).toBeCloseTo(intensity([0, 0], 10));
    expect(intensity([6, 3], 10)).toBeGreaterThan(intensity([5, 3], 10));
    // A quick match, to 3: from 2 points on
    expect(intensity([1, 1], 3)).toBeCloseTo(intensity([0, 0], 3));
    expect(intensity([2, 1], 3)).toBeGreaterThan(intensity([1, 1], 3));
  });

  it('drifts toward the target, and a climax pulls it toward full faster', () => {
    const drift = stepIntensity(0.3, 0.5, 0, 'play');
    const climax = stepIntensity(0.3, 0.5, 1, 'play');

    expect(drift).toBeGreaterThan(0.3);
    expect(drift).toBeLessThan(0.31);
    expect(climax).toBeGreaterThan(drift);
  });

  it('ignores the climax outside of play', () => {
    expect(stepIntensity(0.3, 0.5, 1, 'menu')).toBe(stepIntensity(0.3, 0.5, 0, 'menu'));
  });
});

describe('music climax release', () => {
  /** Runs the release for `seconds` of music while the game's level stays put. */
  const release = (from: number, gameLevel: number, seconds: number) => {
    let level = from;
    for (let t = 0; t < seconds; t += 0.125) level = followClimax(level, gameLevel, 0.125);
    return level;
  };

  it('rises with the game at once, so the build-up and the drop stay in sync', () => {
    expect(followClimax(0.2, 0.9, 0.125)).toBe(0.9);
  });

  it('dies away over the release time once the game has dropped its climax', () => {
    expect(release(1, 0, MUSIC_CLIMAX_RELEASE / 2)).toBeCloseTo(0.5, 1);
    expect(release(1, 0, MUSIC_CLIMAX_RELEASE + 0.5)).toBe(0);
  });

  it('never falls below the game, which may still be cooling down', () => {
    expect(release(1, 0.7, MUSIC_CLIMAX_RELEASE)).toBe(0.7);
  });
});

describe('HarmonyTimeline', () => {
  const A_MINOR = { root: 33, chord: [0, 3, 7] };
  const F_MAJOR = { root: 29, chord: [0, 4, 7] };

  it('knows nothing before the first chord', () => {
    expect(new HarmonyTimeline(4).at(10)).toBeNull();
  });

  it('returns the latest chord whose start time has been reached', () => {
    const timeline = new HarmonyTimeline(4);
    timeline.push(1, A_MINOR);
    timeline.push(3, F_MAJOR); // scheduled ahead, not audible yet at t = 2

    expect(timeline.at(2)).toEqual(A_MINOR);
    expect(timeline.at(3)).toEqual(F_MAJOR);
    expect(timeline.at(0)).toEqual(A_MINOR); // before everything: oldest known
  });

  it('keeps only the most recent entries', () => {
    const timeline = new HarmonyTimeline(2);
    timeline.push(1, A_MINOR);
    timeline.push(2, F_MAJOR);
    timeline.push(3, F_MAJOR);

    expect(timeline.at(1.5)).toEqual(F_MAJOR); // the t = 1 entry was dropped
  });
});

describe('wanted tier', () => {
  it('is calm in the menu and grooves during play', () => {
    expect(getWantedTier('menu', 0.9, 0, 'high')).toBe('calm');
    expect(getWantedTier('play', 0.3, 0, 'calm')).toBe('groove');
  });

  it('calls for the chorus on a hot rally or a climax', () => {
    expect(getWantedTier('play', 0.8, 0, 'groove')).toBe('high');
    expect(getWantedTier('play', 0.3, 0.5, 'groove')).toBe('high');
  });

  it('lets go of the chorus only once the rally has clearly cooled', () => {
    expect(getWantedTier('play', 0.6, 0, 'groove')).toBe('groove');
    expect(getWantedTier('play', 0.6, 0, 'high')).toBe('high');
    expect(getWantedTier('play', 0.5, 0, 'high')).toBe('groove');
  });

  it('holds what is playing while paused', () => {
    expect(getWantedTier('paused', 0, 0, 'groove')).toBe('groove');
    expect(getWantedTier('paused', 0, 0, 'rise')).toBe('high');
  });
});
