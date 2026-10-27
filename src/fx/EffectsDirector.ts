import { AudioEngine } from '@/audio/AudioEngine';
import { FinaleSting } from '@/audio/music/sting';
import { BallSquash } from '@/fx/BallSquash';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { PaddleEffects } from '@/fx/PaddleEffects';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { RallyClimax } from '@/fx/RallyClimax';
import { VictoryFireworks } from '@/fx/VictoryFireworks';
import { Ball } from '@/match/Ball';
import { COURT, HIT_STOP } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { getSpeedHeat } from '@/match/heat';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { OVERDRIVE } from '@/match/Overdrive';
import { Paddle } from '@/match/Paddle';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';
import { Side } from '@/match/side';
import { COURT_LINES } from '@/render/CourtRenderer';
import { HUD_LAYOUT } from '@/render/HudRenderer';
import { Squash } from '@/render/scene';
import { REFLEX } from '@/match/skills/Reflex';
import { finalScoreText } from '@/render/FinalScoreRenderer';
import { brickColor } from '@/render/ModifierRenderer';
import { Renderer } from '@/render/Renderer';
import { CHANNEL_SURF_TUNED_IN } from '@/shared/channelSurf';
import { EventBus } from '@/shared/EventBus';
import { COLORS } from '@/shared/palette';
import { mixHexColors } from '@/shared/math';
import { SceneId } from '@/shared/scenes';

// Screen shake per event (px): a jitter, where a hit kicks the court one way (IMPACT)
const SHAKE = {
  BUMP: 2, // off a post or a brick
  SCORE: 5,
  FIREWORK: 4,
  FINALE_WIN: 12,
  FINALE_LOSS: 18,
} as const;

// Screen flash per event; a hit flashes where it struck instead (IMPACT)
const FLASH = {
  START: 1.0,
  SCORE: 0.15,
  FIREWORK: 0.25,
  FINALE_WIN: 0.9,
} as const;

/**
 * How a hit feels, by how hard it was struck (ROADMAP 6.2): a plain hit from MIN at the serve's
 * speed to MAX at the level's top, a perfect hit and a power shot above both. The contact is the
 * strongest frame: the court is kicked the way the ball went (px), the paddle knocked back (px),
 * the ball flattened (share), a flare of light where they met (px across). Sparks streak off in a
 * cone the way the ball went; rings are quick, a plain hit's an arc opening onto the court.
 */
const IMPACT = {
  KICK: { MIN: 1.5, MAX: 4, PERFECT: 6, POWER: 8 },
  RECOIL: { MIN: 2, MAX: 4, PERFECT: 6, POWER: 9 },
  SQUASH: { MIN: 0.3, MAX: 0.5, PERFECT: 0.65, POWER: 0.8 },
  FLARE: { MIN: 14, MAX: 22, PERFECT: 46, POWER: 34 },
  FLARE_FOR: 0.06, // s after the hit-stop
  // The light a hit throws onto the backdrop (6.5): px across, gone in LIGHT_FOR s
  LIGHT: { MIN: 160, MAX: 240, PERFECT: 280, POWER: 300 },
  LIGHT_FOR: 0.35, // s
  // A perfect hit is told from a plain one at a glance: a star glint's rays reaching GLINT px
  // across the flare, the ball burning white-hot for WHITE_HOT s,
  // and a second, slower ring in the paddle's colour inside the white one
  GLINT: 90, // px
  WHITE_HOT: 0.35, // s
  PERFECT_INNER_RING: { SPEED: 380, DECAY: 4, WIDTH: 2 },
  SPARKS: { COUNT: 14, RALLY_CAP: 14, SPEED: 340, SPREAD: 1.7, SIZE: [1.5, 3] }, // rad, px
  PERFECT_SPARKS: { COUNT: 18, SPEED: 520, SPREAD: 1.2, SIZE: [2, 4] },
  POWER_SPARKS: { COUNT: 18, SPEED: 620, SPREAD: 2.2, SIZE: [2, 4] },
  ARC: { SPEED: 420, DECAY: 6, WIDTH: 2, SPREAD: 2.2 }, // px/s, 1/s, px, rad
  // The perfect hit's wave: big and quick, out to near half the court, so it is felt anywhere on
  // screen; a thin front with a soft wake behind it, so it never hides the ball
  PERFECT_RING: { SPEED: 900, DECAY: 2.2, WIDTH: 3, WAKE: 16 },
  POWER_RINGS: { SPEED: 820, INNER_SPEED: 560, DECAY: 4.5, WIDTH: 4 },
  // The power shot's impact frame: the court in shadow under it for a frame or two, then its colours
  // split ABERRATION px apart, closing over ABERRATION_FOR s
  IMPACT_FRAME: 0.035, // s
  ABERRATION: 5, // px
  ABERRATION_FOR: 0.18, // s
  // Its sound waits out its hit-stop under a hush, so the shot lands as the ball leaves
  POWER_SOUND_DELAY: HIT_STOP.POWER_SHOT,
} as const;

/**
 * A wall struck: its rail lights and a wave runs along it (strength from MIN at the serve's speed
 * to 1 at the level's top), the ball flattens against it a little, the court is kicked toward
 * it, and above SPARKS_FROM of the top speed sparks fly off it into the court.
 */
const WALL = {
  RIPPLE_MIN: 0.35,
  SQUASH: 0.3,
  KICK: 2, // px at the top speed
  SPARKS_FROM: 0.5,
  SPARKS: 10,
  SPARK_SPEED: 260,
  SPREAD: 1.6, // rad
  LIGHT: 180, // px across at the top speed, thrown on the backdrop for LIGHT_FOR s
  LIGHT_FOR: 0.25,
} as const;

/**
 * A point scored (6.4): the goal line it went over lights and a wave runs up and down it, sparks
 * spray back into the court and a wave rolls out over it, all in the scorer's colour; the court is
 * kicked toward that goal, the backdrop flares, and the beaten paddle shorts out.
 */
const GOAL = {
  KICK: 6, // px
  LINE_INSET: 5, // px inside the court edge the goal line lights, so all of it is on screen
  SPARKS: 40,
  WHITE_SPARKS: 20,
  SPARK_SPEED: 520,
  SPREAD: 2.2, // rad, the cone the sparks spray back into the court
  WAVE_SPEED: 620,
  WAVE_WAKE: 22, // px
  LIGHT: 320, // px across, thrown on the backdrop for LIGHT_FOR s
  LIGHT_FOR: 0.6,
  ABERRATION: 4, // px the colours split, closing over ABERRATION_FOR s
  ABERRATION_FOR: 0.25,
} as const;

// A rally's streak on screen crumbling as its point is scored (from FROM hits, as the HUD shows
// it): sparks off it, falling as its halves do
const STREAK_CRUMBLE = { FROM: 5, SPARKS: 24, SPEED: 160, COLOR: '#ffe53b' } as const;

// Particle bursts: how many and how fast
const BURST = {
  SCORE_INSET: 6, // a goal's sparks go off just inside the goal line
  FIREWORK_COUNT: 40,
  FIREWORK_SPEED: 340,
  POWER_COUNT: 36, // per color, twice over
  POWER_SPEED: 560,
  BRICK_COUNT: 14, // a broken brick's shards, in its colour
  BRICK_SPEED: 220,
} as const;

// Overdrive: the meter filling up, and the power shot going off
const OVERDRIVE_FX = {
  POWER_SHAKE: 4,
  READY_RING_SPEED: 380,
  READY_RING_DECAY: 3.5, // 1/s
} as const;

// Shockwave ring expansion speeds
const SHOCKWAVE_SPEED = {
  SCORE: 620,
  TIME_WARP: 300,
} as const;

// The slowed world's ring around the paddle that slowed it, in Reflex's blue
const TIME_WARP_COLOR = '#4f8cff';

// Burning-ball embers during the rally climax
const EMBERS = {
  RATE: 70, // per second at full climax
  COLORS: ['#ffffff', '#ffe53b', '#ff9a3b', '#ff2bd6'],
  SPREAD: 1.6, // radians around the direction opposite to the ball's flight
  SPEED_MIN: 40,
  SPEED_RANGE: 110,
} as const;

export interface EffectsDirectorDeps {
  renderer: Renderer;
  audio: AudioEngine;
  particles: ParticleSystem;
  paddles: readonly Paddle[];
  translate: (key: 'win' | 'lose' | 'player1Wins' | 'player2Wins') => string;
  /**
   * The backdrop the match starting asks for (a challenge's own); null, or left out, for the
   * player's.
   */
  matchScene?: () => SceneId | null;
  /**
   * Whether two people play the match on court: its end is always someone's win, celebrated in
   * the winner's color, never the defeat. Nobody does when left out.
   */
  isTwoPlayer?: () => boolean;
  /**
   * What the finale says of an attempt at a challenge, told by its verdict rather than by who
   * won the match; null, or left out, for a match that is no attempt.
   */
  challengeFinale?: (finale: FinaleStart) => ChallengeFinale | null;
  /**
   * Whether the match starting is the one on court started again (restart): it keeps its
   * backdrop and song, with no channels flicking over. No match is when left out.
   */
  isRestart?: () => boolean;
}

type FinaleStart = Extract<MatchEvent, { type: 'finaleStart' }>;

/** The finale's sign over an attempt, and whether it passed (celebrated) or not (the defeat). */
export interface ChallengeFinale {
  label: string;
  text: string;
  isPassed: boolean;
  /** This pass is the player's last challenge to pass: now every one is (the music's big sting). */
  completesAll?: boolean;
}

/** Where across the court `x` is, as a sound's pan: -1 the left edge, 1 the right. */
const courtPan = (x: number) => (x / COURT.WIDTH) * 2 - 1;

// The serve's countdown (5.7b): s before the ball leaves at which a tick sounds; a pip as it leaves
const SERVE_TICKS = [0.8, 0.4] as const;

// The moments heard over time. A skate on ice (5.9): it glides above MIN px/s, as loud as its speed
// against FULL; it pushes off when it gains PUSH_GAIN px/s every second from below PUSH_FROM, at
// most every PUSH_GAP s; it stops when steered back against a slide faster than STOP_FROM, the
// target further than STOP_REACH px away. The clock: ticks once a second in its last URGENT s (as
// the condition line turns urgent), every FAST_STEP s in its last FAST s
const SKATE = {
  MIN: 40,
  FULL: 700,
  PUSH_GAIN: 2500,
  PUSH_FROM: 150,
  PUSH_GAP: 0.25,
  STOP_FROM: 250,
  STOP_REACH: 20,
} as const;
const CLOCK = { URGENT: 10, FAST: 3, FAST_STEP: 0.25 } as const;

/**
 * Everything the player sees and hears in response to the match: hit sounds, sparks and glow,
 * screen shake, deciding-point drama, the rally climax and the end-of-match finale.
 * It reacts to MatchFlow events and never changes the rules or the outcome.
 */
export class EffectsDirector {
  private readonly drama = new MatchPointDrama();
  private readonly climax = new RallyClimax();
  private readonly paddleFx: PaddleEffects;
  private readonly squash = new BallSquash();
  /**
   * How white-hot each ball burns off a perfect hit, by its place in the list: above 1 through
   * the hit-stop, fading to 0 over IMPACT.WHITE_HOT s after it.
   */
  private readonly whiteHot: number[] = [];
  /** The match's balls as the last step left them, to tell which one a hit or bounce was. */
  private balls: readonly Ball[] = [];
  /** Hits in the rally on court, as its last hit left them: its streak, should it end. */
  private rally = 0;
  /** A power shot's sound waiting out its hit-stop: `in` s more. */
  private powerSound: { rally: number; pan: number; in: number } | null = null;
  /** Each paddle's meter as the last frame left it, to see a charge go. */
  private meterCharges: (number | null)[] = [];
  /** The match's top ball speed, for how hard a hit sounds. */
  private maxBallSpeed: number = DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL].maxSpeed;
  private fireworks: VictoryFireworks | null = null;

  private readonly renderer: Renderer;
  private readonly audio: AudioEngine;
  private readonly particles: ParticleSystem;
  private readonly paddles: readonly Paddle[];
  private readonly translate: EffectsDirectorDeps['translate'];
  private readonly matchScene: () => SceneId | null;

  private readonly isTwoPlayer: () => boolean;
  /** The serve's wait as the last step left it, to hear its countdown cross each tick. */
  private lastServeTime = 0;
  /**
   * Each paddle's skate on ice: its speed as the last step left it, whether it is braking, and
   * the time before it may push off again.
   */
  private readonly skates: { speed: number; isBraking: boolean; pushIn: number }[] = [];
  /** Whether the match is being played on ice, as the last step left it: its hits tink. */
  private isOnIce = false;
  /** The match clock as the last step left it, and whether the next tick is a tock. */
  private lastTimeLeft: number | null = null;
  private isTock = false;
  private readonly challengeFinale: NonNullable<EffectsDirectorDeps['challengeFinale']>;
  private readonly isRestart: () => boolean;

  constructor(deps: EffectsDirectorDeps) {
    this.renderer = deps.renderer;
    this.audio = deps.audio;
    this.particles = deps.particles;
    this.paddles = deps.paddles;
    this.paddleFx = new PaddleEffects(deps.paddles.length);
    this.translate = deps.translate;
    this.matchScene = deps.matchScene ?? (() => null);
    this.isTwoPlayer = deps.isTwoPlayer ?? (() => false);
    this.challengeFinale = deps.challengeFinale ?? (() => null);
    this.isRestart = deps.isRestart ?? (() => false);
  }

  /** Simulation speed requested by the match-point slow motion (1 = normal). */
  public get timeScale(): number {
    return this.drama.timeScale;
  }

  /** Edge darkening in [0, 1] from the deciding-point drama. */
  public get vignette(): number {
    return this.drama.vignette;
  }

  /** Camera zoom on the ball (1 = none) while the deciding ball slows down. */
  public get cameraZoom(): number {
    return this.drama.zoom;
  }

  /** Rally climax build-up in [0, 1]. */
  public get climaxLevel(): number {
    return this.climax.level;
  }

  /** Hit glow of each paddle in [0, 1]. */
  public get paddleGlow(): readonly number[] {
    return this.paddleFx.glow;
  }

  /** How brightly the charge each paddle's meter just lost still burns, in [0, 1]. */
  public get meterSpent(): readonly number[] {
    return this.paddleFx.spent;
  }

  /** How far each paddle is knocked back toward its own goal by its last hit, px. */
  public get paddleRecoil(): readonly number[] {
    return this.paddleFx.recoil;
  }

  /** How far each paddle is shorted out by the point it just lost, in [0, 1]. */
  public get paddleOut(): readonly number[] {
    return this.paddleFx.out;
  }

  /** How white-hot each ball burns off a perfect hit, in [0, 1], by its place in the list. */
  public get ballWhiteHot(): readonly number[] {
    return this.whiteHot.map((level) => Math.min(1, level));
  }

  /** Each ball's squash off its last hit or bounce, by its place in the match's list. */
  public get ballSquash(): readonly (Squash | null)[] {
    return this.squash.squash;
  }

  /** How far each paddle leans, radians (a whip off a spinning hit). */
  public get paddleTilt(): readonly number[] {
    return this.paddleFx.tilt;
  }

  /**
   * An implants' core loses its charges one at a time, to an implant or a hit that wasn't
   * perfect: each one lost flares on the meter as it goes, so the player sees where it went and
   * that the rest are still there. (A power shot empties the meter with a blast of its own.)
   */
  private followMeters(flow: MatchFlow): void {
    const charges = flow.overdriveCharges;
    const cores = flow.implantCores;
    charges.forEach((charge, i) => {
      const before = this.meterCharges[i] ?? null;
      if (cores[i] && charge !== null && before !== null && before - charge === 1) {
        this.paddleFx.onSpend(i);
      }
    });
    this.meterCharges = charges;
  }

  /** A side's color: its first paddle's. */
  private colorOf(side: Side): string {
    return this.paddles.find((p) => p.side === side)!.color;
  }

  /** Runs on the wall clock before the simulation step, which may be slowed by it. */
  public beforeSimulation(realDt: number, flow: MatchFlow): void {
    this.balls = flow.balls;
    if (flow.phase === 'finale') return;
    this.maxBallSpeed = DIFFICULTY_CONFIGS[flow.difficulty].maxSpeed;

    const { isMatchActive, scores, rules } = flow;
    // The drama follows whichever ball is about to decide the point
    if (this.drama.update(realDt, isMatchActive, flow.leadBall, this.paddles, scores, rules)) {
      this.audio.sfx.playHeartbeat();
    }
    this.audio.music.setDramaLevel(this.drama.level);

    // Slow build-up while the rally stays hot; the drop lands when it peaks
    if (this.climax.update(realDt, flow.isMatchActive, flow.rally, flow.serveTime)) {
      this.renderer.triggerClimaxSurge();
      this.audio.music.triggerDrop();
    }
    this.audio.music.setClimaxLevel(this.climax.level);
  }

  /** Continuous effects after the simulation step, on the same (possibly slowed) clock. */
  public afterSimulation(dt: number, flow: MatchFlow): void {
    this.followMeters(flow);
    this.followServe(flow);
    this.followIce(dt, flow);
    this.followBallInDark(flow);
    this.followClock(flow);
    const sparkRally = flow.phase === 'finale' ? 0 : flow.rally;
    // A charged Overdrive sparks off its paddle until the shot is played
    const charged = (flow.overdriveStreaks ?? []).map(
      (streak) => flow.phase !== 'finale' && (streak ?? 0) >= OVERDRIVE.CHARGE,
    );
    this.animate(dt, flow.isBallLive ? flow.balls : [], sparkRally, charged);
    this.followPowerSound(dt);

    for (const shot of this.fireworks?.update(dt) ?? []) {
      this.particles.burst(shot.x, shot.y, shot.color, BURST.FIREWORK_COUNT, BURST.FIREWORK_SPEED);
      this.particles.shockwave(shot.x, shot.y, shot.color, SHOCKWAVE_SPEED.SCORE);
      this.renderer.addFlash(FLASH.FIREWORK);
      this.renderer.addShake(SHAKE.FIREWORK);
      this.audio.sfx.playFireworkPop();
    }

    this.particles.update(dt);
  }

  /**
   * Moves what the effects draw on by `dt` s, the particles excepted: the paddles' glow, recoil
   * and sparks, the balls' squash and heat, the embers off burning `balls` (those in flight). The
   * match's frame calls it, and a replay (app/MatchReplay) on balls of its own.
   * @param charged whether each paddle's Overdrive is charged
   */
  public animate(
    dt: number,
    balls: readonly Ball[],
    rally: number,
    charged: readonly boolean[] = [],
  ): void {
    this.balls = balls.length > 0 ? balls : this.balls;
    this.paddleFx.update(dt, this.paddles, this.particles, rally, charged);
    this.squash.update(dt);
    for (let i = 0; i < this.whiteHot.length; i++) {
      this.whiteHot[i] = Math.max(0, this.whiteHot[i] - dt / IMPACT.WHITE_HOT);
    }
    // Every ball burns with the climax; a power shot burns like the full climax
    for (const ball of balls) {
      const emberLevel = Math.max(this.climax.level, ball.isPowerShot ? 1 : 0);
      if (emberLevel > 0.05) this.emitClimaxEmbers(dt, emberLevel, ball);
    }
  }

  /**
   * Reacts to everything the match reports from now on.
   * @returns a function that stops it
   */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.subscribe((event) => this.handle(event));
  }

  public handle(event: MatchEvent): void {
    switch (event.type) {
      case 'matchStart':
        // Every match is played on another backdrop, found by flicking through the channels:
        // its own, if it asks for one, else the player's. A restart is the same match again, on
        // the backdrop (and to the song) it was being played on. The old set is heard only when
        // it is seen: staying on the same backdrop, or cutting over with reduced motion, is silent
        if (!this.isRestart()) {
          const { music } = this.audio;
          music.enterScene(this.renderer.switchChannel(true, this.matchScene()));
          // The match's song comes in as the picture does, the cut hidden in the static; the
          // chime rings the chord it opens on
          const isSurfing = this.renderer.isSurfing;
          music.openMatch(isSurfing ? CHANNEL_SURF_TUNED_IN : 0);
          if (isSurfing) this.audio.sfx.playChannelSurf(music.getUpcomingHarmony());
        }
        this.renderer.addFlash(FLASH.START);
        this.paddleFx.reset();
        this.squash.reset();
        this.whiteHot.length = 0;
        this.powerSound = null;
        this.resetTension();
        // Again, at once: the last match's sting gives way to this one's music
        this.audio.music.cutFinale();
        break;

      case 'returnToMenu':
        this.paddleFx.reset();
        this.squash.reset();
        this.whiteHot.length = 0;
        this.powerSound = null;
        this.resetTension();
        break;

      case 'serve':
        this.drama.onServe();
        break;

      case 'wallBounce':
        if (event.isPost) {
          this.renderer.addShake(SHAKE.BUMP);
          this.audio.sfx.playPostBounce(courtPan(event.x));
        } else {
          this.onWallBounce(event.x, event.y);
          this.audio.sfx.playWallBounce(courtPan(event.x));
        }
        break;

      case 'brickBreak': {
        // It bounces like a wall and shatters in its own colour
        const { brick } = event;
        this.renderer.addShake(SHAKE.BUMP);
        this.audio.sfx.playBrickBreak(courtPan(event.x));
        this.particles.burst(
          brick.x + brick.width / 2,
          brick.y + brick.height / 2,
          brickColor(brick),
          BURST.BRICK_COUNT,
          BURST.BRICK_SPEED,
        );
        break;
      }

      case 'paddleHit':
        this.onPaddleHit(event);
        break;

      case 'score':
        this.onScore(event);
        break;

      case 'modifier':
        this.onModifierMoment(event);
        break;

      case 'skill':
        this.onSkill(event);
        break;

      case 'finaleStart':
        this.onFinaleStart(event);
        break;

      case 'gameOver':
        this.fireworks = null;
        this.renderer.hideFinalScore();
        this.audio.music.recover();
        this.resetTension();
        break;
    }
  }

  /**
   * A paddle hit, as hard as it was struck: the contact the strongest frame (a flare, the ball
   * flattened, the paddle knocked back, the court kicked the way the ball went), then sparks
   * streaking off the same way and a quick ring.
   */
  private onPaddleHit(hit: Extract<MatchEvent, { type: 'paddleHit' }>): void {
    const paddle = this.paddles[hit.paddleIndex];
    this.rally = hit.rally;
    const force = getSpeedHeat(hit.speed, this.maxBallSpeed);
    const kind = hit.isPowerShot ? 'POWER' : hit.isPerfect ? 'PERFECT' : null;
    const strength = (range: { MIN: number; MAX: number; PERFECT: number; POWER: number }) =>
      kind ? range[kind] : range.MIN + (range.MAX - range.MIN) * force;
    // A perfect hit and a power shot hold the match still a moment (HIT_STOP): so does their look
    const hold = hit.isPowerShot ? HIT_STOP.POWER_SHOT : hit.isPerfect ? HIT_STOP.PERFECT : 0;

    this.paddleFx.onHit(hit.paddleIndex, strength(IMPACT.RECOIL));
    this.squash.onHit(this.ballAt(hit.x, hit.y), 'x', strength(IMPACT.SQUASH), hold);
    this.renderer.addKick(hit.heading, strength(IMPACT.KICK));
    const flareColor = hit.isPowerShot ? COLORS.YELLOW : paddle.color;
    const glint = hit.isPerfect ? IMPACT.GLINT : 0;
    const flareFor = hold + IMPACT.FLARE_FOR;
    this.particles.flare(hit.x, hit.y, strength(IMPACT.FLARE), flareColor, flareFor, glint);
    this.particles.light(hit.x, hit.y, strength(IMPACT.LIGHT), flareColor, hold + IMPACT.LIGHT_FOR);

    const { SPARKS, ARC } = IMPACT;
    const sparks = SPARKS.COUNT + Math.min(hit.rally, SPARKS.RALLY_CAP);
    this.particles.burst(hit.x, hit.y, paddle.color, sparks, SPARKS.SPEED * (0.7 + 0.6 * force), {
      heading: hit.heading,
      spread: SPARKS.SPREAD,
      size: SPARKS.SIZE,
      isStreak: true,
    });

    if (hit.isPerfect) {
      const { PERFECT_SPARKS, PERFECT_RING, PERFECT_INNER_RING } = IMPACT;
      this.whiteHot[this.ballAt(hit.x, hit.y)] = 1 + hold / IMPACT.WHITE_HOT;
      this.particles.shockwave(hit.x, hit.y, paddle.color, PERFECT_INNER_RING.SPEED, {
        decay: PERFECT_INNER_RING.DECAY,
        width: PERFECT_INNER_RING.WIDTH,
      });
      this.particles.burst(hit.x, hit.y, COLORS.WHITE, PERFECT_SPARKS.COUNT, PERFECT_SPARKS.SPEED, {
        heading: hit.heading,
        spread: PERFECT_SPARKS.SPREAD,
        size: PERFECT_SPARKS.SIZE,
        isStreak: true,
      });
      this.particles.shockwave(hit.x, hit.y, COLORS.WHITE, PERFECT_RING.SPEED, {
        decay: PERFECT_RING.DECAY,
        width: PERFECT_RING.WIDTH,
        wake: PERFECT_RING.WAKE,
      });
    } else if (!hit.isPowerShot) {
      // A plain hit's ring: an arc opening onto the court, the way the ball went
      this.particles.shockwave(hit.x, hit.y, paddle.color, ARC.SPEED, {
        decay: ARC.DECAY,
        width: ARC.WIDTH,
        heading: paddle.side === 0 ? 0 : Math.PI,
        spread: ARC.SPREAD,
      });
    }

    if (hit.isPowerShot) {
      this.onPowerShot(hit);
    } else {
      this.audio.sfx.playPaddleHit(hit.rally, hit.isPerfect, paddle.side, {
        pan: courtPan(hit.x),
        force,
        size: paddle.spec.height / STANDARD_PADDLE.height,
      });
    }
    if (this.isOnIce) this.audio.sfx.playIceTink(courtPan(hit.x));

    if (hit.chargedOverdrive) {
      this.particles.shockwave(hit.x, hit.y, COLORS.YELLOW, OVERDRIVE_FX.READY_RING_SPEED, {
        decay: OVERDRIVE_FX.READY_RING_DECAY,
      });
      this.audio.sfx.playOverdriveReady(courtPan(hit.x));
    }
  }

  /**
   * An Overdrive goes off: on top of the hit, a white-hot blast the way the ball went, two rings,
   * the court in shadow for a frame, and its sound landing out of a hush as the ball leaves.
   */
  private onPowerShot(hit: Extract<MatchEvent, { type: 'paddleHit' }>): void {
    const { POWER_SPARKS, POWER_RINGS } = IMPACT;
    for (const color of [COLORS.YELLOW, COLORS.WHITE]) {
      this.particles.burst(hit.x, hit.y, color, POWER_SPARKS.COUNT, POWER_SPARKS.SPEED, {
        heading: hit.heading,
        spread: POWER_SPARKS.SPREAD,
        size: POWER_SPARKS.SIZE,
        isStreak: true,
      });
    }
    const ring = { decay: POWER_RINGS.DECAY, width: POWER_RINGS.WIDTH };
    this.particles.shockwave(hit.x, hit.y, COLORS.YELLOW, POWER_RINGS.SPEED, ring);
    this.particles.shockwave(hit.x, hit.y, COLORS.PINK, POWER_RINGS.INNER_SPEED, ring);
    this.renderer.addImpactFrame(IMPACT.IMPACT_FRAME);
    this.renderer.addAberration(IMPACT.ABERRATION, IMPACT.ABERRATION_FOR);
    this.renderer.addShake(OVERDRIVE_FX.POWER_SHAKE);
    this.audio.sfx.hushForShot(IMPACT.POWER_SOUND_DELAY);
    this.powerSound = { rally: hit.rally, pan: courtPan(hit.x), in: IMPACT.POWER_SOUND_DELAY };
  }

  /**
   * A wall struck, as hard as the ball's speed: its rail lights and a wave runs along it, the ball
   * flattens against it, the court is kicked toward it, and a fast ball strikes sparks off it.
   */
  private onWallBounce(x: number, y: number): void {
    const force = getSpeedHeat(this.balls[this.ballAt(x, y)]?.speed ?? 0, this.maxBallSpeed);
    const isTop = y < COURT.HEIGHT / 2;
    const railY = isTop
      ? COURT.TOP_WALL - COURT_LINES.RAIL_THICKNESS / 2
      : COURT.HEIGHT - COURT.BOTTOM_WALL + COURT_LINES.RAIL_THICKNESS / 2;
    this.particles.ripple(x, railY, WALL.RIPPLE_MIN + (1 - WALL.RIPPLE_MIN) * force);
    const railColor = mixHexColors(COLORS.CYAN, COLORS.PINK, x / COURT.WIDTH);
    this.particles.light(x, railY, WALL.LIGHT * (0.4 + 0.6 * force), railColor, WALL.LIGHT_FOR);
    this.squash.onHit(this.ballAt(x, y), 'y', WALL.SQUASH * (0.5 + 0.5 * force));
    this.renderer.addKick(isTop ? -Math.PI / 2 : Math.PI / 2, WALL.KICK * force);
    if (force > WALL.SPARKS_FROM) {
      this.particles.burst(x, railY, railColor, WALL.SPARKS, WALL.SPARK_SPEED, {
        heading: isTop ? Math.PI / 2 : -Math.PI / 2,
        spread: WALL.SPREAD,
        isStreak: true,
      });
    }
  }

  /** A power shot's sound, landing once its hit-stop is over. */
  private followPowerSound(dt: number): void {
    const sound = this.powerSound;
    if (!sound) return;
    sound.in -= dt;
    if (sound.in > 0) return;
    this.powerSound = null;
    this.audio.sfx.playPowerShot(sound.rally, sound.pan);
  }

  /** Which ball in the match's list is the one at (x, y): the nearest. */
  private ballAt(x: number, y: number): number {
    let nearest = 0;
    let best = Infinity;
    this.balls.forEach((ball, i) => {
      const distance = (ball.x - x) ** 2 + (ball.y - y) ** 2;
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    return nearest;
  }

  /** A skill's sound and burst; what lasts (a spin, a slowed world) the renderer draws itself. */
  private onSkill(use: Extract<MatchEvent, { type: 'skill' }>): void {
    switch (use.skill) {
      case 'arc': {
        const paddle = this.paddles[use.paddleIndex];
        this.paddleFx.onWhip(use.paddleIndex, paddle.side, paddle.velocity, use.strength);
        this.audio.sfx.playSpin(use.strength);
        break;
      }
      case 'analyzer':
        this.audio.sfx.playScan();
        break;
      case 'reflex':
        this.particles.shockwave(use.x, use.y, TIME_WARP_COLOR, SHOCKWAVE_SPEED.TIME_WARP);
        this.audio.sfx.playTimeWarp();
        this.audio.music.holdTape(REFLEX.MAX_DURATION);
        break;
    }
  }

  private onScore(score: Extract<MatchEvent, { type: 'score' }>): void {
    const burstX =
      score.scoringPlayerIndex === 0 ? COURT.WIDTH - BURST.SCORE_INSET : BURST.SCORE_INSET;
    const color = this.colorOf(score.scoringPlayerIndex);
    // The ball went right, into the right goal, for the left side; back into the court is the other way
    const intoGoal = score.scoringPlayerIndex === 0 ? 0 : Math.PI;
    const backIn = intoGoal + Math.PI;
    const goalX = score.scoringPlayerIndex === 0 ? COURT.WIDTH - GOAL.LINE_INSET : GOAL.LINE_INSET;
    const y = Math.min(Math.max(score.y, COURT.TOP_WALL), COURT.HEIGHT - COURT.BOTTOM_WALL);

    this.particles.ripple(goalX, y, 1, true, color);
    this.particles.light(goalX, y, GOAL.LIGHT, color, GOAL.LIGHT_FOR);
    const spray = { heading: backIn, spread: GOAL.SPREAD, isStreak: true, size: [2, 4] } as const;
    this.particles.burst(burstX, y, color, GOAL.SPARKS, GOAL.SPARK_SPEED, spray);
    this.particles.burst(burstX, y, COLORS.WHITE, GOAL.WHITE_SPARKS, GOAL.SPARK_SPEED, spray);
    this.particles.shockwave(burstX, y, color, GOAL.WAVE_SPEED, { wake: GOAL.WAVE_WAKE });
    this.renderer.addKick(intoGoal, GOAL.KICK);
    this.renderer.addShake(SHAKE.SCORE);
    this.renderer.addFlash(FLASH.SCORE);
    this.renderer.flareBackdrop();
    this.renderer.addAberration(GOAL.ABERRATION, GOAL.ABERRATION_FOR);
    // The rally's streak, if it showed, crumbles into sparks
    if (this.rally >= STREAK_CRUMBLE.FROM) {
      this.particles.burst(
        COURT.WIDTH / 2,
        HUD_LAYOUT.SCORE_Y,
        STREAK_CRUMBLE.COLOR,
        STREAK_CRUMBLE.SPARKS,
        STREAK_CRUMBLE.SPEED,
        { heading: Math.PI / 2, spread: Math.PI },
      );
    }
    this.rally = 0;
    // The side beaten for it shorts out, every paddle it has
    this.paddles.forEach((paddle, i) => {
      if (paddle.side !== score.scoringPlayerIndex) this.paddleFx.onConcede(i);
    });

    if (!score.isDemo) {
      // Heard from the goal it went in, the scorer's opponent's. In a match of two every point
      // is someone's win; otherwise the left side is the player
      const pan = score.scoringPlayerIndex === 0 ? 1 : -1;
      if (this.isTwoPlayer() || score.scoringPlayerIndex === 0) this.audio.sfx.playPointWon(pan);
      else this.audio.sfx.playPointLost(pan);
    }
  }

  /** A modifier's moment, heard: the wind turning, the middle post rising, a paddle shrinking. */
  private onModifierMoment(moment: Extract<MatchEvent, { type: 'modifier' }>): void {
    switch (moment.moment) {
      case 'windTurn':
        this.audio.sfx.playWindTurn(moment.direction);
        break;
      case 'postRise':
        this.audio.sfx.playPostRise();
        break;
      case 'paddleShrink': {
        const paddle = this.paddles[moment.paddleIndex];
        this.audio.sfx.playShrink(moment.share, courtPan(paddle.x));
        break;
      }
    }
  }

  /**
   * A person's paddle on ice heard as a skate (5.9): a push as it speeds up hard from slow, a
   * glide while it slides, a hockey stop as it is steered against its slide at speed.
   */
  private followIce(dt: number, flow: MatchFlow): void {
    this.isOnIce = flow.activeModifiers.includes('ice');
    const isOn = this.isOnIce && (flow.phase === 'serving' || flow.phase === 'rally');
    let glide: { speed: number; pan: number } | null = null;
    for (const [i, paddle] of this.paddles.entries()) {
      const state = (this.skates[i] ??= { speed: 0, isBraking: false, pushIn: 0 });
      const speed = Math.abs(paddle.velocity);
      const gained = speed - state.speed;
      state.speed = speed;
      state.pushIn = Math.max(0, state.pushIn - dt);
      if (!isOn || !flow.isPlayerPaddle(i)) continue;
      const pan = courtPan(paddle.x);

      if (gained > SKATE.PUSH_GAIN * dt && speed - gained < SKATE.PUSH_FROM && state.pushIn === 0) {
        this.audio.sfx.playSkatePush(speed / SKATE.FULL, pan);
        state.pushIn = SKATE.PUSH_GAP;
      }
      // Braking: the paddle wants the other way from where it slides
      const wants = Math.sign(paddle.targetY - paddle.y);
      const isBraking =
        speed > SKATE.STOP_FROM &&
        wants !== 0 &&
        wants !== Math.sign(paddle.velocity) &&
        Math.abs(paddle.targetY - paddle.y) > SKATE.STOP_REACH;
      if (isBraking && !state.isBraking) this.audio.sfx.playSkateStop(speed / SKATE.FULL, pan);
      state.isBraking = isBraking || (state.isBraking && speed > SKATE.MIN);

      if (speed > SKATE.MIN && (!glide || speed / SKATE.FULL > glide.speed)) {
        glide = { speed: speed / SKATE.FULL, pan };
      }
    }
    this.audio.sfx.setSkateGlide(glide?.speed ?? null, glide?.pan);
  }

  /**
   * In the dark the ball is heard as its air (5.9): where it is, swelling as it closes on a
   * person's goal; silent but while it flies.
   */
  private followBallInDark(flow: MatchFlow): void {
    const isOn =
      flow.activeModifiers.includes('darkness') && flow.isBallLive && flow.phase === 'rally';
    if (!isOn) {
      this.audio.sfx.setBallAir(null);
      return;
    }
    const ball = flow.leadBall;
    const side: Side = ball.vx < 0 ? 0 : 1;
    const isComingAtPerson = this.isTwoPlayer() || side === 0;
    const goal = side === 0 ? 0 : COURT.WIDTH;
    const distance = Math.min(1, Math.abs(ball.drawX - goal) / COURT.WIDTH);
    this.audio.sfx.setBallAir({
      x: courtPan(ball.drawX),
      height: 1 - ball.drawY / COURT.HEIGHT,
      nearness: isComingAtPerson ? 1 - distance : 0,
      speed: Math.min(1, ball.speed / this.maxBallSpeed),
    });
  }

  /** The match clock's last seconds tick, faster at the very end. */
  private followClock(flow: MatchFlow): void {
    const time = flow.timeLeft;
    const last = this.lastTimeLeft;
    this.lastTimeLeft = time;
    if (time === null || last === null || time >= last || time > CLOCK.URGENT) return;
    if (flow.phase !== 'serving' && flow.phase !== 'rally') return;
    const step = time <= CLOCK.FAST ? CLOCK.FAST_STEP : 1;
    if (Math.ceil(last / step) !== Math.ceil(time / step)) {
      this.audio.sfx.playClockTick(this.isTock);
      this.isTock = !this.isTock;
    }
  }

  /**
   * The serve's countdown, heard as the wait runs out: two ticks, a pip as the ball leaves; on
   * the deciding point a sting as it is served, in place of the ticks.
   */
  private followServe(flow: MatchFlow): void {
    const time = flow.serveTime;
    const last = this.lastServeTime;
    this.lastServeTime = time;
    if (flow.phase !== 'serving' && flow.phase !== 'rally') return;

    const isDeciding = flow.isDecidingPoint;
    // A new serve: the wait starts again
    if (time > last) {
      if (isDeciding) this.audio.sfx.playDeciderSting();
      return;
    }
    if (!isDeciding && SERVE_TICKS.some((tick) => last > tick && time <= tick)) {
      this.audio.sfx.playServeTick();
    }
    if (last > 0 && time <= 0) this.audio.sfx.playServeGo();
  }

  /**
   * End-of-match cutscene: play is frozen but the canvas stays live, so particles,
   * flashes, the background and the neon score sign keep animating until the menu.
   */
  private onFinaleStart(finale: FinaleStart): void {
    this.resetTension();
    const isTwoPlayer = this.isTwoPlayer();
    // An attempt ends as its verdict says, not as its match did: a match won short of the
    // challenge's goal is no win. Outside a match of two the left side is the player
    const attempt = this.challengeFinale(finale);
    const playerWon = attempt ? attempt.isPassed : isTwoPlayer || finale.winnerIndex === 0;

    if (playerWon) {
      this.renderer.triggerVictoryEffect();
      this.renderer.celebrate();
      this.renderer.addFlash(FLASH.FINALE_WIN);
      this.renderer.addShake(SHAKE.FINALE_WIN);

      // The winning ball went into the loser's goal (skipped in a look without effects: no
      // particles are drawn there, and the shots' pop sound would otherwise still play)
      if (this.renderer.showsEffects) {
        this.fireworks = new VictoryFireworks(finale.winnerIndex === 0 ? 1 : -1, finale.ballY, [
          this.colorOf(finale.winnerIndex),
          COLORS.WHITE,
          COLORS.YELLOW,
        ]);
      }

      this.playFinaleSting(attempt?.completesAll ? 'allPassed' : 'win');
    } else {
      this.renderer.triggerCrtGlitch();
      this.renderer.addShake(SHAKE.FINALE_LOSS);

      this.playFinaleSting('loss');
    }

    this.renderer.showFinalScore({
      text: attempt?.text ?? finalScoreText(finale.scores),
      label:
        attempt?.label ??
        this.translate(
          isTwoPlayer
            ? finale.winnerIndex === 0
              ? 'player1Wins'
              : 'player2Wins'
            : playerWon
              ? 'win'
              : 'lose',
        ),
      // An attempt's sign burns in the color of whoever it went to: the player's, or the CPU's
      color: this.colorOf(attempt ? (attempt.isPassed ? 0 : 1) : finale.winnerIndex),
      isWin: playerWon,
    });
  }

  /**
   * The end heard: the song playing's sting from its hook (audio/music/sting.ts), or, where the
   * synthwave music isn't heard (muted, the classic look), the stand-alone jingle.
   */
  private playFinaleSting(kind: FinaleSting): void {
    if (this.audio.isMusicHeard) {
      this.audio.music.playFinale(kind);
    } else if (kind === 'loss') {
      this.audio.sfx.playDefeat();
    } else {
      this.audio.sfx.playVictory();
    }
  }

  /** Drops the deciding-point drama and the rally climax at once, sound included. */
  private resetTension(): void {
    this.drama.reset();
    this.audio.music.setDramaLevel(0);

    this.climax.reset();
    this.audio.music.resetClimax();
  }

  /** Embers off a burning `ball` during the rally climax or a power shot, `level` in [0, 1]. */
  private emitClimaxEmbers(dt: number, level: number, ball: Ball): void {
    const expected = EMBERS.RATE * level * dt;
    const count = Math.floor(expected + Math.random());

    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(-ball.vy, -ball.vx) + (Math.random() - 0.5) * EMBERS.SPREAD;
      const speed = EMBERS.SPEED_MIN + Math.random() * EMBERS.SPEED_RANGE;
      this.particles.addParticle({
        x: ball.x + (Math.random() - 0.5) * ball.radius,
        y: ball.y + (Math.random() - 0.5) * ball.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.3,
        color: EMBERS.COLORS[Math.floor(Math.random() * EMBERS.COLORS.length)],
        size: 1 + Math.random() * 2,
      });
    }
  }
}
