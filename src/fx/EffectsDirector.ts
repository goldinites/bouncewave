import { AudioEngine } from '@/audio/AudioEngine';
import { FinaleSting } from '@/audio/music/sting';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { PaddleEffects } from '@/fx/PaddleEffects';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { RallyClimax } from '@/fx/RallyClimax';
import { VictoryFireworks } from '@/fx/VictoryFireworks';
import { Ball } from '@/match/Ball';
import { COURT, BALL } from '@/match/config';
import { DIFFICULTY_CONFIGS, DifficultyLevel } from '@/match/difficulty';
import { getSpeedHeat } from '@/match/heat';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { STANDARD_PADDLE } from '@/match/PaddleSpec';
import { Side } from '@/match/side';
import { REFLEX } from '@/match/skills/Reflex';
import { finalScoreText } from '@/render/FinalScoreRenderer';
import { brickColor } from '@/render/ModifierRenderer';
import { Renderer } from '@/render/Renderer';
import { EventBus } from '@/shared/EventBus';
import { COLORS } from '@/shared/palette';
import { SceneId } from '@/shared/scenes';

// Screen shake per event (px); a paddle hit shakes
// base + (ball speed − serve speed) / divisor, plus a bonus when perfect
const SHAKE = {
  WALL_BOUNCE: 2,
  PADDLE_HIT_BASE: 3,
  PADDLE_HIT_SPEED_DIVISOR: 90,
  PERFECT_BONUS: 3,
  SCORE: 14,
  FIREWORK: 4,
  FINALE_WIN: 12,
  FINALE_LOSS: 18,
} as const;

// Screen flash per event
const FLASH = {
  START: 1.0,
  PERFECT_HIT: 0.6,
  SCORE: 0.8,
  FIREWORK: 0.25,
  FINALE_WIN: 0.9,
} as const;

// Particle bursts: how many and how fast
const BURST = {
  HIT_COUNT: 18,
  HIT_RALLY_CAP: 20, // each rally hit adds a particle, up to this many
  PERFECT_COUNT: 16,
  PERFECT_SPEED: 380,
  SCORE_COUNT: 46,
  SCORE_SPEED: 460,
  SCORE_INSET: 6, // score bursts go off just inside the goal line
  FIREWORK_COUNT: 40,
  FIREWORK_SPEED: 340,
  POWER_COUNT: 36, // per color, twice over
  POWER_SPEED: 560,
  BRICK_COUNT: 14, // a broken brick's shards, in its colour
  BRICK_SPEED: 220,
} as const;

// Overdrive: the meter filling up, and the power shot going off
const OVERDRIVE_FX = {
  POWER_SHAKE: 8,
  POWER_FLASH: 0.7,
  POWER_RING_SPEED: 760,
  READY_RING_SPEED: 380,
} as const;

// Shockwave ring expansion speeds; a plain hit uses the ParticleSystem default
const SHOCKWAVE_SPEED = {
  PERFECT: 520,
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

// 5.7c's moments heard over time. Ice: a scrape grain every GRAIN s while a player's paddle coasts
// faster than MIN px/s, as loud as its speed against FULL px/s. Darkness: the ball's sonar pings
// every FAR s, quickening to NEAR s as it closes on a person's goal. The clock: ticks once a second
// in its last URGENT s (as the condition line turns urgent), every FAST_STEP s in its last FAST s
const ICE_SCRAPE = { GRAIN: 0.06, MIN: 40, FULL: 700 } as const;
const SONAR = { FAR: 0.45, NEAR: 0.1 } as const;
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
  /** Each paddle's speed as the last step left it, and the time to the next scrape on ice. */
  private lastPaddleSpeeds: number[] = [];
  /** Whether the match is being played on ice, as the last step left it: its hits tink. */
  private isOnIce = false;
  private nextScrapeIn = 0;
  private nextPingIn = 0;
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
    this.followSonar(dt, flow);
    this.followClock(flow);
    const sparkRally = flow.phase === 'finale' ? 0 : flow.rally;
    this.paddleFx.update(dt, this.paddles, this.particles, sparkRally);

    // Every ball burns with the climax; a power shot burns like the full climax
    if (flow.isBallLive) {
      for (const ball of flow.balls) {
        const emberLevel = Math.max(this.climax.level, ball.isPowerShot ? 1 : 0);
        if (emberLevel > 0.05) this.emitClimaxEmbers(dt, emberLevel, ball);
      }
    }

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
        // the backdrop (and to the song) it was being played on
        if (!this.isRestart()) {
          this.audio.music.enterScene(this.renderer.switchChannel(true, this.matchScene()));
          this.audio.sfx.playChannelSurf();
        }
        this.renderer.addFlash(FLASH.START);
        this.paddleFx.reset();
        this.resetTension();
        // Again, at once: the last match's sting gives way to this one's music
        this.audio.music.cutFinale();
        break;

      case 'returnToMenu':
        this.paddleFx.reset();
        this.resetTension();
        break;

      case 'serve':
        this.drama.onServe();
        break;

      case 'wallBounce':
        this.renderer.addShake(SHAKE.WALL_BOUNCE);
        if (event.isPost) this.audio.sfx.playPostBounce(courtPan(event.x));
        else this.audio.sfx.playWallBounce(courtPan(event.x));
        break;

      case 'brickBreak': {
        // It bounces like a wall and shatters in its own colour
        const { brick } = event;
        this.renderer.addShake(SHAKE.WALL_BOUNCE);
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

  private onPaddleHit(hit: Extract<MatchEvent, { type: 'paddleHit' }>): void {
    const paddle = this.paddles[hit.paddleIndex];
    this.paddleFx.onHit(hit.paddleIndex);

    this.renderer.addShake(
      SHAKE.PADDLE_HIT_BASE +
        (hit.speed - BALL.INITIAL_SPEED) / SHAKE.PADDLE_HIT_SPEED_DIVISOR +
        (hit.isPerfect ? SHAKE.PERFECT_BONUS : 0),
    );

    const burstCount = BURST.HIT_COUNT + Math.min(hit.rally, BURST.HIT_RALLY_CAP);
    this.particles.burst(hit.x, hit.y, paddle.color, burstCount);
    this.particles.shockwave(hit.x, hit.y, paddle.color);

    if (hit.isPerfect) {
      this.particles.burst(hit.x, hit.y, COLORS.WHITE, BURST.PERFECT_COUNT, BURST.PERFECT_SPEED);
      this.particles.shockwave(hit.x, hit.y, COLORS.WHITE, SHOCKWAVE_SPEED.PERFECT);
      this.renderer.addFlash(FLASH.PERFECT_HIT);
    }

    if (hit.isPowerShot) {
      this.onPowerShot(hit);
    } else {
      this.audio.sfx.playPaddleHit(hit.rally, hit.isPerfect, paddle.side, {
        pan: courtPan(hit.x),
        force: getSpeedHeat(hit.speed, this.maxBallSpeed),
        size: paddle.spec.height / STANDARD_PADDLE.height,
      });
    }
    if (this.isOnIce) this.audio.sfx.playIceTink(courtPan(hit.x));

    if (hit.chargedOverdrive) {
      this.particles.shockwave(hit.x, hit.y, COLORS.YELLOW, OVERDRIVE_FX.READY_RING_SPEED);
      this.audio.sfx.playOverdriveReady(courtPan(hit.x));
    }
  }

  /** The player's Overdrive goes off: a white-hot blast on top of the usual hit. */
  private onPowerShot(hit: Extract<MatchEvent, { type: 'paddleHit' }>): void {
    for (const color of [COLORS.YELLOW, COLORS.WHITE]) {
      this.particles.burst(hit.x, hit.y, color, BURST.POWER_COUNT, BURST.POWER_SPEED);
    }
    this.particles.shockwave(hit.x, hit.y, COLORS.YELLOW, OVERDRIVE_FX.POWER_RING_SPEED);
    this.particles.shockwave(hit.x, hit.y, COLORS.PINK, SHOCKWAVE_SPEED.PERFECT);
    this.renderer.addFlash(OVERDRIVE_FX.POWER_FLASH);
    this.renderer.addShake(OVERDRIVE_FX.POWER_SHAKE);
    this.audio.sfx.playPowerShot(hit.rally, courtPan(hit.x));
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

    this.particles.burst(burstX, score.y, color, BURST.SCORE_COUNT, BURST.SCORE_SPEED);
    this.particles.shockwave(burstX, score.y, color, SHOCKWAVE_SPEED.SCORE);
    this.renderer.addShake(SHAKE.SCORE);
    this.renderer.addFlash(FLASH.SCORE);

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

  /** On ice a person's paddle scrapes while it coasts, as loud as it is fast. */
  private followIce(dt: number, flow: MatchFlow): void {
    const speeds = this.paddles.map((paddle) => Math.abs(paddle.velocity));
    const last = this.lastPaddleSpeeds;
    this.lastPaddleSpeeds = speeds;
    this.isOnIce = flow.activeModifiers.includes('ice');
    if (!this.isOnIce || flow.phase === 'paused') return;
    this.nextScrapeIn -= dt;
    if (this.nextScrapeIn > 0) return;
    this.nextScrapeIn = ICE_SCRAPE.GRAIN;
    speeds.forEach((speed, i) => {
      // Coasting: moving, and no faster than a step ago
      const isCoasting = speed > ICE_SCRAPE.MIN && speed <= (last[i] ?? 0);
      if (isCoasting && flow.isPlayerPaddle(i)) {
        this.audio.sfx.playIceScrape(speed / ICE_SCRAPE.FULL, courtPan(this.paddles[i].x));
      }
    });
  }

  /**
   * In the dark the ball pings where it is, quicker the nearer it is to a person's goal: heard
   * where it cannot be seen.
   */
  private followSonar(dt: number, flow: MatchFlow): void {
    if (!flow.activeModifiers.includes('darkness') || !flow.isBallLive) return;
    this.nextPingIn -= dt;
    if (this.nextPingIn > 0) return;
    const ball = flow.leadBall;
    const goal = ball.vx < 0 ? 0 : COURT.WIDTH;
    const side: Side = ball.vx < 0 ? 0 : 1;
    const isComingAtPlayer = this.isTwoPlayer() || side === 0;
    const distance = Math.abs(ball.x - goal) / COURT.WIDTH;
    this.nextPingIn = isComingAtPlayer
      ? SONAR.NEAR + (SONAR.FAR - SONAR.NEAR) * Math.min(1, distance)
      : SONAR.FAR;
    this.audio.sfx.playSonar(courtPan(ball.drawX), 1 - ball.drawY / COURT.HEIGHT);
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
