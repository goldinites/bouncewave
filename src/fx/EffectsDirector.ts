import { AudioEngine } from '@/audio/AudioEngine';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { PaddleEffects } from '@/fx/PaddleEffects';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { RallyClimax } from '@/fx/RallyClimax';
import { VictoryFireworks } from '@/fx/VictoryFireworks';
import { Ball } from '@/match/Ball';
import { COURT, BALL } from '@/match/config';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { Paddle } from '@/match/Paddle';
import { Renderer } from '@/render/Renderer';
import { COLORS } from '@/shared/palette';

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
} as const;

// Shockwave ring expansion speeds; a plain hit uses the ParticleSystem default
const SHOCKWAVE_SPEED = {
  PERFECT: 520,
  SCORE: 620,
} as const;

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
  paddles: [Paddle, Paddle];
  ball: Ball;
  translate: (key: 'win' | 'lose') => string;
}

/**
 * Everything the player sees and hears in response to the match: hit sounds, sparks and glow,
 * screen shake, match-point tension, the rally climax and the end-of-match finale.
 * It reacts to MatchFlow events and never changes the rules or the outcome.
 */
export class EffectsDirector {
  private readonly drama = new MatchPointDrama();
  private readonly climax = new RallyClimax();
  private readonly paddleFx = new PaddleEffects();
  private fireworks: VictoryFireworks | null = null;

  private readonly renderer: Renderer;
  private readonly audio: AudioEngine;
  private readonly particles: ParticleSystem;
  private readonly paddles: [Paddle, Paddle];
  private readonly ball: Ball;
  private readonly translate: EffectsDirectorDeps['translate'];

  constructor(deps: EffectsDirectorDeps) {
    this.renderer = deps.renderer;
    this.audio = deps.audio;
    this.particles = deps.particles;
    this.paddles = deps.paddles;
    this.ball = deps.ball;
    this.translate = deps.translate;
  }

  /** Simulation speed requested by the match-point slow motion (1 = normal). */
  public get timeScale(): number {
    return this.drama.timeScale;
  }

  /** Match-point tension in [0, 1] (vignette). */
  public get tension(): number {
    return this.drama.level;
  }

  /** Rally climax build-up in [0, 1]. */
  public get climaxLevel(): number {
    return this.climax.level;
  }

  /** Hit glow of each paddle in [0, 1]. */
  public get paddleGlow(): readonly [number, number] {
    return this.paddleFx.glow;
  }

  /** Runs on the wall clock before the simulation step, which may be slowed by it. */
  public beforeSimulation(realDt: number, flow: MatchFlow): void {
    if (flow.phase === 'finale') return;

    this.drama.update(realDt, flow.isMatchActive, this.ball, this.paddles);
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
    const sparkRally = flow.phase === 'finale' ? 0 : flow.rally;
    this.paddleFx.update(dt, this.paddles, this.particles, sparkRally);

    if (flow.isBallLive && this.climax.level > 0.05) {
      this.emitClimaxEmbers(dt);
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

  public handle(event: MatchEvent): void {
    switch (event.type) {
      case 'matchStart':
        this.renderer.addFlash(FLASH.START);
        this.paddleFx.reset();
        this.resetTension();
        break;

      case 'returnToMenu':
        this.audio.music.newSong();
        this.renderer.nextBackground();
        this.paddleFx.reset();
        this.resetTension();
        break;

      case 'serve':
        this.drama.onServe();
        break;

      case 'wallBounce':
        this.renderer.addShake(SHAKE.WALL_BOUNCE);
        this.audio.sfx.playWallBounce();
        break;

      case 'paddleHit':
        this.onPaddleHit(event);
        break;

      case 'score':
        this.onScore(event);
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

    this.audio.sfx.playPaddleHit(hit.rally, hit.isPerfect, hit.paddleIndex);
  }

  private onScore(score: Extract<MatchEvent, { type: 'score' }>): void {
    const burstX =
      score.scoringPlayerIndex === 0 ? COURT.WIDTH - BURST.SCORE_INSET : BURST.SCORE_INSET;
    const color = this.paddles[score.scoringPlayerIndex].color;

    this.particles.burst(burstX, score.y, color, BURST.SCORE_COUNT, BURST.SCORE_SPEED);
    this.particles.shockwave(burstX, score.y, color, SHOCKWAVE_SPEED.SCORE);
    this.renderer.addShake(SHAKE.SCORE);
    this.renderer.addFlash(FLASH.SCORE);

    if (!score.isDemo) {
      this.audio.sfx.playScore();
    }
  }

  /**
   * End-of-match cutscene: play is frozen but the canvas stays live, so particles,
   * flashes, the background and the neon score sign keep animating until the menu.
   */
  private onFinaleStart(finale: Extract<MatchEvent, { type: 'finaleStart' }>): void {
    this.resetTension();
    const playerWon = finale.winnerIndex === 0;

    if (playerWon) {
      this.renderer.triggerVictoryEffect();
      this.renderer.celebrate();
      this.renderer.addFlash(FLASH.FINALE_WIN);
      this.renderer.addShake(SHAKE.FINALE_WIN);

      // The winning ball went into the right-hand goal
      this.fireworks = new VictoryFireworks(1, finale.ballY, [
        this.paddles[0].color,
        COLORS.WHITE,
        COLORS.YELLOW,
      ]);

      this.audio.sfx.playVictory();
      this.audio.music.duck();
    } else {
      this.renderer.triggerCrtGlitch();
      this.renderer.addShake(SHAKE.FINALE_LOSS);

      this.audio.sfx.playDefeat();
      this.audio.music.tapeStop();
    }

    this.renderer.showFinalScore({
      scores: finale.scores,
      label: this.translate(playerWon ? 'win' : 'lose'),
      color: this.paddles[finale.winnerIndex].color,
      isWin: playerWon,
    });
  }

  /** Drops match-point tension and the rally climax at once, sound included. */
  private resetTension(): void {
    this.drama.reset();
    this.audio.music.setDramaLevel(0);

    this.climax.reset();
    this.audio.music.setClimaxLevel(0);
  }

  /** Burning-ball embers during the rally climax. */
  private emitClimaxEmbers(dt: number): void {
    const expected = EMBERS.RATE * this.climax.level * dt;
    const count = Math.floor(expected + Math.random());
    const ball = this.ball;

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
