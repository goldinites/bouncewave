import { AudioEngine } from '@/audio/AudioEngine';
import { BALL_INITIAL_SPEED, COLORS, GAME_WIDTH } from '@/constants/game.constants';
import {
  CLIMAX_EMBER_COLORS,
  CLIMAX_EMBER_RATE,
  FIREWORK_FLASH,
  FIREWORK_PARTICLES,
  FIREWORK_SHAKE,
  FIREWORK_SPEED,
  LOSS_DURATION,
  PARTICLE_HIT_BURST_COUNT_BASE,
  PARTICLE_HIT_BURST_RALLY_CAP,
  PARTICLE_PERFECT_BURST_COUNT,
  PARTICLE_PERFECT_BURST_SPEED,
  PARTICLE_SCORE_BURST_COUNT,
  PARTICLE_SCORE_BURST_SPEED,
  PERFECT_SHOCKWAVE_EXPANSION_SPEED,
  SCORE_SHOCKWAVE_EXPANSION_SPEED,
  SCREEN_FLASH_PERFECT_HIT,
  SCREEN_FLASH_SCORE,
  SCREEN_FLASH_START,
  SCREEN_SHAKE_PADDLE_HIT_BASE,
  SCREEN_SHAKE_PADDLE_HIT_SPEED_DIVISOR,
  SCREEN_SHAKE_PERFECT_BONUS,
  SCREEN_SHAKE_SCORE,
  SCREEN_SHAKE_WALL_BOUNCE,
  SHOCKWAVE_EXPANSION_SPEED,
  VICTORY_DURATION,
} from '@/constants/visual.constants';
import { MatchEvent, MatchFlow } from '@/match/MatchFlow';
import { MatchPointDrama } from '@/fx/MatchPointDrama';
import { RallyClimax } from '@/fx/RallyClimax';
import { VictoryFireworks } from '@/fx/VictoryFireworks';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { Renderer } from '@/render/Renderer';

// Screen punch when the match is decided
const FINALE_WIN_FLASH = 0.9;
const FINALE_WIN_SHAKE = 12;
const FINALE_LOSS_SHAKE = 18;
// Score bursts go off just inside the goal line
const SCORE_BURST_INSET = 6;
// Burning-ball embers during the climax
const EMBER_SPREAD = 1.6; // radians around the direction opposite to the ball's flight
const EMBER_SPEED_MIN = 40;
const EMBER_SPEED_RANGE = 110;

export interface EffectsDirectorDeps {
  renderer: Renderer;
  audio: AudioEngine;
  particles: ParticleSystem;
  paddles: [Paddle, Paddle];
  ball: Ball;
  translate: (key: 'win' | 'lose') => string;
}

/**
 * Everything the player sees and hears in response to the match: hit sounds and sparks,
 * screen shake, match-point tension, the rally climax and the end-of-match finale.
 * It reacts to MatchFlow events and never changes the rules or the outcome.
 */
export class EffectsDirector {
  private readonly drama = new MatchPointDrama();
  private readonly climax = new RallyClimax();
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
    this.paddles.forEach((p) => p.emitSparks(dt, this.particles, sparkRally));

    if (flow.isBallLive && this.climax.level > 0.05) {
      this.emitClimaxEmbers(dt);
    }

    for (const shot of this.fireworks?.update(dt) ?? []) {
      this.particles.burst(shot.x, shot.y, shot.color, FIREWORK_PARTICLES, FIREWORK_SPEED);
      this.particles.shockwave(shot.x, shot.y, shot.color, SCORE_SHOCKWAVE_EXPANSION_SPEED);
      this.renderer.addFlash(FIREWORK_FLASH);
      this.renderer.addShake(FIREWORK_SHAKE);
      this.audio.sfx.playFireworkPop();
    }

    this.particles.update(dt);
  }

  public handle(event: MatchEvent): void {
    switch (event.type) {
      case 'matchStart':
        this.renderer.addFlash(SCREEN_FLASH_START);
        this.resetTension();
        break;

      case 'returnToMenu':
        this.audio.music.newSong();
        this.renderer.background.nextBackground();
        this.resetTension();
        break;

      case 'serve':
        this.drama.onServe();
        break;

      case 'wallBounce':
        this.renderer.addShake(SCREEN_SHAKE_WALL_BOUNCE);
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
    paddle.glow = 1.0;

    this.renderer.addShake(
      SCREEN_SHAKE_PADDLE_HIT_BASE +
        (hit.speed - BALL_INITIAL_SPEED) / SCREEN_SHAKE_PADDLE_HIT_SPEED_DIVISOR +
        (hit.isPerfect ? SCREEN_SHAKE_PERFECT_BONUS : 0),
    );

    const burstCount =
      PARTICLE_HIT_BURST_COUNT_BASE + Math.min(hit.rally, PARTICLE_HIT_BURST_RALLY_CAP);
    this.particles.burst(hit.x, hit.y, paddle.color, burstCount);
    this.particles.shockwave(hit.x, hit.y, paddle.color, SHOCKWAVE_EXPANSION_SPEED);

    if (hit.isPerfect) {
      this.particles.burst(
        hit.x,
        hit.y,
        COLORS.WHITE,
        PARTICLE_PERFECT_BURST_COUNT,
        PARTICLE_PERFECT_BURST_SPEED,
      );
      this.particles.shockwave(hit.x, hit.y, COLORS.WHITE, PERFECT_SHOCKWAVE_EXPANSION_SPEED);
      this.renderer.addFlash(SCREEN_FLASH_PERFECT_HIT);
    }

    this.audio.sfx.playPaddleHit(hit.rally, hit.isPerfect, hit.paddleIndex);
  }

  private onScore(score: Extract<MatchEvent, { type: 'score' }>): void {
    const burstX =
      score.scoringPlayerIndex === 0 ? GAME_WIDTH - SCORE_BURST_INSET : SCORE_BURST_INSET;
    const color = this.paddles[score.scoringPlayerIndex].color;

    this.particles.burst(
      burstX,
      score.y,
      color,
      PARTICLE_SCORE_BURST_COUNT,
      PARTICLE_SCORE_BURST_SPEED,
    );
    this.particles.shockwave(burstX, score.y, color, SCORE_SHOCKWAVE_EXPANSION_SPEED);
    this.renderer.addShake(SCREEN_SHAKE_SCORE);
    this.renderer.addFlash(SCREEN_FLASH_SCORE);

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
      this.renderer.triggerVictoryEffect(VICTORY_DURATION);
      this.renderer.celebrate();
      this.renderer.addFlash(FINALE_WIN_FLASH);
      this.renderer.addShake(FINALE_WIN_SHAKE);

      // The winning ball went into the right-hand goal
      this.fireworks = new VictoryFireworks(1, finale.ballY, [
        this.paddles[0].color,
        COLORS.WHITE,
        COLORS.YELLOW,
      ]);

      this.audio.sfx.playVictory();
      this.audio.music.duck();
    } else {
      this.renderer.triggerCrtGlitch(LOSS_DURATION);
      this.renderer.addShake(FINALE_LOSS_SHAKE);

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
    const expected = CLIMAX_EMBER_RATE * this.climax.level * dt;
    const count = Math.floor(expected + Math.random());
    const ball = this.ball;

    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(-ball.vy, -ball.vx) + (Math.random() - 0.5) * EMBER_SPREAD;
      const speed = EMBER_SPEED_MIN + Math.random() * EMBER_SPEED_RANGE;
      this.particles.addParticle({
        x: ball.x + (Math.random() - 0.5) * ball.radius,
        y: ball.y + (Math.random() - 0.5) * ball.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.3,
        color: CLIMAX_EMBER_COLORS[Math.floor(Math.random() * CLIMAX_EMBER_COLORS.length)],
        size: 1 + Math.random() * 2,
      });
    }
  }
}
