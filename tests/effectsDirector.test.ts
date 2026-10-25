import { describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/audio/AudioEngine';
import { EffectsDirector, EffectsDirectorDeps } from '@/fx/EffectsDirector';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Ball } from '@/match/Ball';
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
  switchChannel: vi.fn(() => 'fuji'),
  hideFinalScore: vi.fn(),
  showFinalScore: vi.fn(),
  showsEffects: true,
});

const makeAudio = () => ({
  sfx: {
    playWallBounce: vi.fn(),
    playPaddleHit: vi.fn(),
    playPointWon: vi.fn(),
    playPointLost: vi.fn(),
    playServeTick: vi.fn(),
    playServeGo: vi.fn(),
    playDeciderSting: vi.fn(),
    playPostBounce: vi.fn(),
    playBrickBreak: vi.fn(),
    playWindTurn: vi.fn(),
    playPostRise: vi.fn(),
    playShrink: vi.fn(),
    playSkatePush: vi.fn(),
    playSkateStop: vi.fn(),
    setSkateGlide: vi.fn(),
    playIceTink: vi.fn(),
    setBallAir: vi.fn(),
    playClockTick: vi.fn(),
    playSpin: vi.fn(),
    playScan: vi.fn(),
    playTimeWarp: vi.fn(),
    playVictory: vi.fn(),
    playDefeat: vi.fn(),
    playHeartbeat: vi.fn(),
    playFireworkPop: vi.fn(),
    playPowerShot: vi.fn(),
    playOverdriveReady: vi.fn(),
    playChannelSurf: vi.fn(),
  },
  isMusicHeard: true,
  music: {
    setDramaLevel: vi.fn(),
    triggerDrop: vi.fn(),
    setClimaxLevel: vi.fn(),
    playFinale: vi.fn(),
    cutFinale: vi.fn(),
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
    serveTime: 0,
    isDecidingPoint: false,
    timeLeft: null,
    activeModifiers: [],
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
    expect(audio.music.enterScene).toHaveBeenCalledExactlyOnceWith('fuji');
    expect(audio.sfx.playChannelSurf).toHaveBeenCalledOnce();
    // Again, straight after a finale: its sting gives way
    expect(audio.music.cutFinale).toHaveBeenCalledOnce();
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
    // Heard where it was hit, the right paddle on the right
    expect(audio.sfx.playPaddleHit).toHaveBeenCalledWith(
      4,
      false,
      1,
      expect.objectContaining({ pan: expect.closeTo(0.9, 5) }),
    );
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

    expect(audio.sfx.playPowerShot).toHaveBeenCalledWith(9, expect.any(Number));
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
    expect(audio.sfx.playPaddleHit).toHaveBeenCalledWith(6, true, 0, expect.any(Object));
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

  it('rises on a point won, falls on one lost, from the goal it went in; not in the demo', () => {
    const { effects, audio } = makeDirector();

    handle(effects, { type: 'score', scoringPlayerIndex: 0, y: 250, isDemo: true });
    expect(audio.sfx.playPointWon).not.toHaveBeenCalled();

    handle(effects, { type: 'score', scoringPlayerIndex: 0, y: 250, isDemo: false });
    expect(audio.sfx.playPointWon).toHaveBeenCalledWith(1);
    handle(effects, { type: 'score', scoringPlayerIndex: 1, y: 250, isDemo: false });
    expect(audio.sfx.playPointLost).toHaveBeenCalledWith(-1);
  });

  it('hears every point of a match of two as its scorer’s win', () => {
    const { effects, audio } = makeDirector(undefined, () => true);

    handle(effects, { type: 'score', scoringPlayerIndex: 1, y: 250, isDemo: false });
    expect(audio.sfx.playPointWon).toHaveBeenCalledWith(-1);
    expect(audio.sfx.playPointLost).not.toHaveBeenCalled();
  });

  it('counts the serve down in two ticks and a pip as the ball leaves', () => {
    const { effects, audio } = makeDirector();
    const serve = (serveTime: number, phase = 'serving') =>
      effects.afterSimulation(0.1, fakeFlow({ phase, serveTime } as Partial<MatchFlow>));

    serve(1.2);
    for (const time of [1.0, 0.85, 0.75, 0.5, 0.35, 0.1]) serve(time);
    expect(audio.sfx.playServeTick).toHaveBeenCalledTimes(2);
    expect(audio.sfx.playServeGo).not.toHaveBeenCalled();
    serve(0, 'rally');
    expect(audio.sfx.playServeGo).toHaveBeenCalledOnce();
    serve(0, 'rally');
    expect(audio.sfx.playServeGo).toHaveBeenCalledOnce();
    expect(audio.sfx.playDeciderSting).not.toHaveBeenCalled();
  });

  it('announces the deciding point with a sting in place of the ticks', () => {
    const { effects, audio } = makeDirector();
    const serve = (serveTime: number, phase = 'serving') =>
      effects.afterSimulation(
        0.1,
        fakeFlow({ phase, serveTime, isDecidingPoint: true } as Partial<MatchFlow>),
      );

    serve(1.2);
    expect(audio.sfx.playDeciderSting).toHaveBeenCalledOnce();
    for (const time of [0.7, 0.3]) serve(time);
    serve(0, 'rally');
    expect(audio.sfx.playServeTick).not.toHaveBeenCalled();
    expect(audio.sfx.playServeGo).toHaveBeenCalledOnce();
  });

  it('keeps the attract-mode demo’s serves silent', () => {
    const { effects, audio } = makeDirector();

    for (const time of [0.5, 0.3, 0]) {
      effects.afterSimulation(0.1, fakeFlow({ phase: 'attract', serveTime: time }));
    }
    expect(audio.sfx.playServeTick).not.toHaveBeenCalled();
    expect(audio.sfx.playServeGo).not.toHaveBeenCalled();
  });

  it('hears a modifier’s moments: the wind turning, a post rising and bouncing, a paddle shrinking', () => {
    const { effects, audio } = makeDirector();

    handle(effects, { type: 'modifier', moment: 'windTurn', direction: -1 });
    expect(audio.sfx.playWindTurn).toHaveBeenCalledWith(-1);
    handle(effects, { type: 'modifier', moment: 'postRise' });
    expect(audio.sfx.playPostRise).toHaveBeenCalledOnce();
    handle(effects, { type: 'modifier', moment: 'paddleShrink', paddleIndex: 0, share: 0.8 });
    expect(audio.sfx.playShrink).toHaveBeenCalledWith(0.8, expect.any(Number));
    handle(effects, { type: 'wallBounce', x: 400, y: 100, isPost: true });
    expect(audio.sfx.playPostBounce).toHaveBeenCalledOnce();
    expect(audio.sfx.playWallBounce).not.toHaveBeenCalled();
  });

  it('ticks the clock’s last seconds from ten, four a second in the last three', () => {
    const { effects, audio } = makeDirector();
    const at = (timeLeft: number) =>
      effects.afterSimulation(0.05, fakeFlow({ phase: 'rally', timeLeft } as Partial<MatchFlow>));

    for (let t = 20; t > 10.5; t -= 0.05) at(t);
    expect(audio.sfx.playClockTick).not.toHaveBeenCalled();
    for (let t = 10.5; t > 3; t -= 0.05) at(t);
    expect(audio.sfx.playClockTick).toHaveBeenCalledTimes(7);
    for (let t = 3; t > 0; t -= 0.05) at(t);
    expect(audio.sfx.playClockTick).toHaveBeenCalledTimes(7 + 12);
  });

  it('lets the ball be heard in the dark as its air, swelling as it closes on the player’s goal', () => {
    const air = (vx: number, x: number, phase = 'rally') => {
      const { effects, audio } = makeDirector();
      const ball = Object.assign(new Ball(), { x, drawX: x, drawY: 250, vx, speed: 400 });
      const flow = fakeFlow({
        phase,
        isBallLive: true,
        leadBall: ball,
        balls: [ball],
        activeModifiers: ['darkness'],
      } as Partial<MatchFlow>);
      effects.afterSimulation(0.02, flow);
      return vi.mocked(audio.sfx.setBallAir).mock.calls.at(-1)![0];
    };

    expect(air(-300, 100)!.nearness).toBeGreaterThan(air(-300, 700)!.nearness);
    // Flying at the CPU it is heard only far off
    expect(air(300, 700)!.nearness).toBe(0);
    expect(air(-300, 100)!.x).toBeLessThan(0);
    // Not while the ball waits for its serve
    expect(air(-300, 100, 'serving')).toBeNull();
  });

  it('skates a player’s paddle on ice: pushes off, glides, stops; and tinks its hits', () => {
    const { effects, audio, paddles } = makeDirector();
    const flow = fakeFlow({
      phase: 'rally',
      activeModifiers: ['ice'],
      isPlayerPaddle: (index: number) => index === 0,
    } as Partial<MatchFlow>);
    const step = (velocity: number, targetY = paddles[0].y + Math.sign(velocity) * 100) => {
      paddles[0].velocity = velocity;
      paddles[0].targetY = targetY;
      effects.afterSimulation(0.02, flow);
    };

    step(0);
    step(300); // off from standing
    expect(audio.sfx.playSkatePush).toHaveBeenCalledOnce();
    step(400);
    expect(vi.mocked(audio.sfx.setSkateGlide).mock.calls.at(-1)![0]).toBeCloseTo(400 / 700);

    step(380, paddles[0].y - 100); // steered back against the slide
    step(300, paddles[0].y - 100);
    expect(audio.sfx.playSkateStop).toHaveBeenCalledOnce();
    step(0);
    expect(vi.mocked(audio.sfx.setSkateGlide).mock.calls.at(-1)![0]).toBeNull();
    // The CPU's paddle makes no sound
    expect(vi.mocked(audio.sfx.playSkatePush).mock.calls.every((call) => call[1]! < 0)).toBe(true);

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
    expect(audio.sfx.playIceTink).toHaveBeenCalledOnce();
  });

  it('weighs a hit by its paddle’s size', () => {
    const { effects, audio, paddles } = makeDirector();

    paddles[1].useSpec({ ...paddles[1].spec, height: paddles[1].spec.height * 1.5 });
    handle(effects, {
      type: 'paddleHit',
      paddleIndex: 1,
      isPerfect: false,
      x: 750,
      y: 250,
      speed: 400,
      angle: 0,
      rally: 1,
      isPowerShot: false,
      chargedOverdrive: false,
    });
    expect(audio.sfx.playPaddleHit).toHaveBeenCalledWith(
      1,
      false,
      1,
      expect.objectContaining({ size: 1.5 }),
    );
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
    // The song's own hook is the jingle
    expect(audio.music.playFinale).toHaveBeenCalledWith('win');
    expect(audio.sfx.playVictory).not.toHaveBeenCalled();
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '10 : 7',
      label: 'YOU WIN',
      color: COLORS.CYAN,
      isWin: true,
    });
  });

  it('glitches the screen and plays the hook into a tape stop when the player loses', () => {
    const { effects, renderer, audio } = makeDirector();

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 1,
      ballY: 250,
      scores: [7, 10],
      reason: 'points',
    });

    expect(renderer.triggerCrtGlitch).toHaveBeenCalledOnce();
    expect(audio.music.playFinale).toHaveBeenCalledWith('loss');
    expect(audio.sfx.playDefeat).not.toHaveBeenCalled();
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
    expect(audio.music.playFinale).toHaveBeenCalledWith('win');
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
    expect(audio.music.playFinale).toHaveBeenCalledWith('loss');
    expect(renderer.showFinalScore).toHaveBeenCalledWith({
      text: '3 / 5',
      label: 'NOT ENOUGH OVERDRIVE',
      color: COLORS.PINK,
      isWin: false,
    });
  });

  it('plays the big sting for the pass that completes every challenge', () => {
    const { effects, audio } = makeDirector(undefined, undefined, {
      challengeFinale: () => ({
        label: 'PASSED',
        text: '5 / 5',
        isPassed: true,
        completesAll: true,
      }),
    });

    handle(effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [7, 4],
      reason: 'points',
    });

    expect(audio.music.playFinale).toHaveBeenCalledWith('allPassed');
  });

  it('plays the stand-alone jingles where the music is not heard', () => {
    const win = makeDirector();
    win.audio.isMusicHeard = false;
    handle(win.effects, {
      type: 'finaleStart',
      winnerIndex: 0,
      ballY: 250,
      scores: [10, 7],
      reason: 'points',
    });
    expect(win.audio.sfx.playVictory).toHaveBeenCalledOnce();

    const loss = makeDirector();
    loss.audio.isMusicHeard = false;
    handle(loss.effects, {
      type: 'finaleStart',
      winnerIndex: 1,
      ballY: 250,
      scores: [7, 10],
      reason: 'points',
    });
    expect(loss.audio.sfx.playDefeat).toHaveBeenCalledOnce();
    expect(loss.audio.music.playFinale).not.toHaveBeenCalled();
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
