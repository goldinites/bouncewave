import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/audio/AudioEngine';
import { EffectsDirector, EffectsDirectorDeps } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import type { Renderer } from '@/render/Renderer';
import { COLORS } from '@/shared/palette';
import { SceneId } from '@/shared/scenes';

const makeRenderer = () => ({
  addShake: vi.fn(),
  addFlash: vi.fn(),
  triggerClimaxSurge: vi.fn(),
  celebrate: vi.fn(),
  triggerVictoryEffect: vi.fn(),
  triggerCrtGlitch: vi.fn(),
  switchChannel: vi.fn(() => 'outrun'),
  hideFinalScore: vi.fn(),
  showFinalScore: vi.fn(),
  showsEffects: true,
});

const makeAudio = () => ({
  sfx: {
    playWallBounce: vi.fn(),
    playPaddleHit: vi.fn(),
    playScore: vi.fn(),
    playVictory: vi.fn(),
    playDefeat: vi.fn(),
    playHeartbeat: vi.fn(),
    playFireworkPop: vi.fn(),
    playPowerShot: vi.fn(),
    playOverdriveReady: vi.fn(),
    playChannelSurf: vi.fn(),
  },
  music: {
    setDramaLevel: vi.fn(),
    triggerDrop: vi.fn(),
    setClimaxLevel: vi.fn(),
    duck: vi.fn(),
    tapeStop: vi.fn(),
    recover: vi.fn(),
    enterScene: vi.fn(),
    resetClimax: vi.fn(),
  },
});

/** Just enough of MatchFlow for afterSimulation's reads; nothing else is touched. */
const fakeFlow = (overrides: Partial<MatchFlow> = {}): MatchFlow =>
  ({
    phase: 'finale',
    rally: 0,
    isBallLive: false,
    overdriveCharges: [null, null],
    implantCores: [false, false],
    ...overrides,
  }) as unknown as MatchFlow;

const makeDirector = (
  matchScene?: () => SceneId | null,
  isTwoPlayer?: () => boolean,
  deps: Partial<EffectsDirectorDeps> = {},
) => {
  const renderer = makeRenderer();
  const audio = makeAudio();
  const particles = new ParticleSystem();
  const paddles: [Paddle, Paddle] = [
    new Paddle(0, 34, COLORS.CYAN),
    new Paddle(1, 750, COLORS.PINK),
  ];
  const translate = (key: 'win' | 'lose' | 'player1Wins' | 'player2Wins') =>
    ({
      win: 'YOU WIN',
      lose: 'YOU LOSE',
      player1Wins: 'PLAYER 1 WINS',
      player2Wins: 'PLAYER 2 WINS',
    })[key];

  const effects = new EffectsDirector({
    renderer: renderer as unknown as Renderer,
    audio: audio as unknown as AudioEngine,
    particles,
    paddles,
    translate,
    matchScene,
    isTwoPlayer,
    ...deps,
  });

  return { effects, renderer, audio, particles, paddles };
};

const handle = (effects: EffectsDirector, event: MatchEvent) => effects.handle(event);

describe('EffectsDirector.handle', () => {
  it('flashes and resets paddle glow on matchStart', () => {
    const { effects, renderer } = makeDirector();

    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: false,
      x: 40,
      y: 250,
      speed: 400,
      angle: 0,
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
    });
    expect(effects.paddleGlow[0]).toBe(1);

    handle(effects, { type: 'matchStart' });

    expect(renderer.addFlash).toHaveBeenCalled();
    expect(effects.paddleGlow).toEqual([0, 0]);
  });

  it('switches the channel to another background and its music when a match starts', () => {
    const { effects, audio, renderer } = makeDirector();

    handle(effects, { type: 'matchStart' });

    expect(renderer.switchChannel).toHaveBeenCalledOnce();
    expect(audio.music.enterScene).toHaveBeenCalledExactlyOnceWith('outrun');
    expect(audio.sfx.playChannelSurf).toHaveBeenCalledOnce();
  });

  it('plays a match that asks for its own backdrop on it (a challenge), else on the player’s', () => {
    let scene: SceneId | null = 'warehouse';
    const { effects, renderer } = makeDirector(() => scene);

    handle(effects, { type: 'matchStart' });
    expect(renderer.switchChannel).toHaveBeenLastCalledWith(true, 'warehouse');
    scene = null;
    handle(effects, { type: 'matchStart' });
    expect(renderer.switchChannel).toHaveBeenLastCalledWith(true, null);
  });

  it('keeps the backdrop and its song when the match on court is restarted', () => {
    const { effects, audio, renderer } = makeDirector(undefined, undefined, {
      isRestart: () => true,
    });

    handle(effects, { type: 'matchStart' });

    expect(renderer.switchChannel).not.toHaveBeenCalled();
    expect(audio.music.enterScene).not.toHaveBeenCalled();
    expect(audio.sfx.playChannelSurf).not.toHaveBeenCalled();
    expect(renderer.addFlash).toHaveBeenCalled();
  });

  it('keeps the background on returnToMenu', () => {
    const { effects, audio, renderer } = makeDirector();

    handle(effects, { type: 'returnToMenu' });

    expect(renderer.switchChannel).not.toHaveBeenCalled();
    expect(audio.music.enterScene).not.toHaveBeenCalled();
  });

  it('shakes and beeps on a wall bounce', () => {
    const { effects, audio, renderer } = makeDirector();

    handle(effects, { type: 'wallBounce', x: 10, y: 20 });

    expect(renderer.addShake).toHaveBeenCalled();
    expect(audio.sfx.playWallBounce).toHaveBeenCalledOnce();
  });

  it('lights up the hit paddle and forwards the hit to sfx', () => {
    const { effects, audio, particles } = makeDirector();

    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 1,
      isPerfect: false,
      x: 760,
      y: 300,
      speed: 500,
      angle: 0,
      rally: 4,
      isPowerShot: false,
      chargedOverdrive: false,
    });

    expect(effects.paddleGlow[1]).toBe(1);
    expect(effects.paddleGlow[0]).toBe(0);
    expect(particles.particles.length).toBeGreaterThan(0);
    expect(particles.rings.length).toBeGreaterThan(0);
    expect(audio.sfx.playPaddleHit).toHaveBeenCalledWith(4, false, 1);
  });

  it('blasts an Overdrive power shot instead of the usual hit sound', () => {
    const { effects, audio, renderer, particles } = makeDirector();

    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: false,
      x: 40,
      y: 300,
      speed: 700,
      angle: 0,
      rally: 9,
      isPowerShot: true,
      chargedOverdrive: false,
    });

    expect(audio.sfx.playPowerShot).toHaveBeenCalledWith(9);
    expect(audio.sfx.playPaddleHit).not.toHaveBeenCalled();
    expect(particles.particles.some((p) => p.color === COLORS.YELLOW)).toBe(true);
    expect(renderer.addFlash).toHaveBeenCalled();
    expect(renderer.addShake).toHaveBeenCalled();
  });

  it('chimes when a hit fills the Overdrive meter', () => {
    const { effects, audio } = makeDirector();

    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: true,
      x: 40,
      y: 300,
      speed: 700,
      angle: 0,
      rally: 6,
      isPowerShot: false,
      chargedOverdrive: true,
    });

    expect(audio.sfx.playOverdriveReady).toHaveBeenCalledOnce();
    expect(audio.sfx.playPaddleHit).toHaveBeenCalledWith(6, true, 0);
  });

  it('adds an extra white burst and a flash on a perfect hit', () => {
    const { effects, renderer, particles } = makeDirector();

    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 0,
      isPerfect: true,
      x: 40,
      y: 300,
      speed: 700,
      angle: 0,
      rally: 8,
      isPowerShot: false,
      chargedOverdrive: false,
    });

    const perfectBurst = particles.particles.filter((p) => p.color === COLORS.WHITE);
    expect(perfectBurst.length).toBeGreaterThan(0);
    expect(renderer.addFlash).toHaveBeenCalled();
  });

  it('plays the score sound for a real point but not for the attract-mode demo', () => {
    const { effects, audio } = makeDirector();

    handle(effects, { type: 'score', scoringPlayerIndex: 0, y: 250, isDemo: true });
    expect(audio.sfx.playScore).not.toHaveBeenCalled();

    handle(effects, { type: 'score', scoringPlayerIndex: 0, y: 250, isDemo: false });
    expect(audio.sfx.playScore).toHaveBeenCalledOnce();
  });

  it('shows the final score, fireworks and a victory sting when the player wins', () => {
    const { effects, renderer, audio } = makeDirector();

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [10, 7],
      reason: 'points',
    });

    expect(renderer.triggerVictoryEffect).toHaveBeenCalledOnce();
    expect(renderer.celebrate).toHaveBeenCalledOnce();
    expect(audio.sfx.playVictory).toHaveBeenCalledOnce();
    expect(audio.music.duck).toHaveBeenCalledOnce();
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '10 : 7',
      label: 'YOU WIN',
      color: COLORS.CYAN,
      isWin: true,
    });
  });

  it('glitches the screen and tape-stops the music when the player loses', () => {
    const { effects, renderer, audio } = makeDirector();

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 1,
      ballY: 250,
      scores: [7, 10],
      reason: 'points',
    });

    expect(renderer.triggerCrtGlitch).toHaveBeenCalledOnce();
    expect(audio.sfx.playDefeat).toHaveBeenCalledOnce();
    expect(audio.music.tapeStop).toHaveBeenCalledOnce();
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '7 : 10',
      label: 'YOU LOSE',
      color: COLORS.PINK,
      isWin: false,
    });
  });

  it('celebrates the right player’s win as a win, in their color, in a match of two', () => {
    const { effects, renderer, audio } = makeDirector(undefined, () => true);

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 1,
      ballY: 250,
      scores: [3, 5],
      reason: 'points',
    });

    expect(renderer.triggerVictoryEffect).toHaveBeenCalledOnce();
    expect(audio.music.tapeStop).not.toHaveBeenCalled();
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '3 : 5',
      label: 'PLAYER 2 WINS',
      color: COLORS.PINK,
      isWin: true,
    });
  });

  it('ends a failed attempt as a defeat with its own sign, though its match was won', () => {
    const { effects, renderer, audio } = makeDirector(undefined, undefined, {
      challengeFinale: () => ({ label: 'NOT ENOUGH OVERDRIVE', text: '3 / 5', isPassed: false }),
    });

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [7, 4],
      reason: 'points',
    });

    expect(renderer.triggerVictoryEffect).not.toHaveBeenCalled();
    expect(audio.sfx.playDefeat).toHaveBeenCalledOnce();
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '3 / 5',
      label: 'NOT ENOUGH OVERDRIVE',
      color: COLORS.PINK,
      isWin: false,
    });
  });

  it('skips the victory fireworks entirely in a look without effects (classic)', () => {
    const { effects, renderer, audio } = makeDirector();
    renderer.showsEffects = false;

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [10, 7],
      reason: 'points',
    });
    effects.afterSimulation(0, fakeFlow());

    // A non-classic win fires its first shot immediately (see VictoryFireworks' own tests);
    // in classic mode there is no fireworks instance at all, so nothing pops.
    expect(audio.sfx.playFireworkPop).not.toHaveBeenCalled();
  });

  it('pops the first firework shot right away outside classic mode', () => {
    const { effects, audio } = makeDirector();

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [10, 7],
      reason: 'points',
    });
    effects.afterSimulation(0, fakeFlow());

    expect(audio.sfx.playFireworkPop).toHaveBeenCalledOnce();
  });

  it('hides the final score and recovers the music on gameOver', () => {
    const { effects, renderer, audio } = makeDirector();

    handle(effects, { type: 'gameOver', winnerIndex: 0, scores: [10, 7] });

    expect(renderer.hideFinalScore).toHaveBeenCalledOnce();
    expect(audio.music.recover).toHaveBeenCalledOnce();
    expect(audio.music.setDramaLevel).toHaveBeenCalledWith(0);
    expect(audio.music.resetClimax).toHaveBeenCalledOnce();
  });
});

describe('EffectsDirector meters', () => {
  const meters = (charges: (number | null)[], cores = [true, false]) =>
    fakeFlow({ phase: 'rally', overdriveCharges: charges, implantCores: cores });

  it('flares a charge an implants’ core loses, one at a time', () => {
    const { effects } = makeDirector();
    effects.afterSimulation(0.016, meters([2, null]));
    expect(effects.meterSpent[0]).toBe(0);

    effects.afterSimulation(0.016, meters([1, null]));
    expect(effects.meterSpent[0]).toBeGreaterThan(0.9);
  });

  it('leaves a meter without a core, and a power shot’s emptying, to their own effects', () => {
    const { effects } = makeDirector();
    effects.afterSimulation(0.016, meters([1, null], [false, false]));
    effects.afterSimulation(0.016, meters([0, null], [false, false]));
    expect(effects.meterSpent[0]).toBe(0);

    effects.afterSimulation(0.016, meters([3, null]));
    effects.afterSimulation(0.016, meters([0, null]));
    expect(effects.meterSpent[0]).toBe(0);
  });
});
