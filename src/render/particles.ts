/**
 * What the renderer draws of the effects' particles: plain data, filled in by fx/ (the
 * ParticleSystem moves them) and only read here, so render/ never needs fx/.
 */

/** A spark, ember or firework shard: a coloured dot drifting and fading. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  /** Drawn as a streak along its flight rather than a dot: a spark struck off a hit. */
  isStreak?: boolean;
}

/** A ring spreading out from a hit and fading. */
export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
  velocity: number;
  /** Life lost per second: how soon it fades. */
  decay: number;
  /** Line width, px. */
  width: number;
  /** px of soft glow trailing inside its front, a wave rather than a line; none when 0. */
  wake: number;
  /**
   * Only an arc of it, facing this way (radians) and `spread` wide: a plain hit's ring opens
   * toward the court. The whole ring when left out.
   */
  heading?: number;
  spread?: number;
}

/** The flash of contact: a ball of light where something was struck, gone in a frame or two. */
export interface Flare {
  x: number;
  y: number;
  radius: number;
  life: number;
  /** Life lost per second. */
  decay: number;
  color: string;
  /** px each ray of a star glint reaches across it (a perfect hit's); none when 0. */
  spikes: number;
}

/** Seconds a wall's wave runs along its rail. */
export const RIPPLE_LIFE = 0.45;

/** A wall struck: its rail lights where it was hit and a wave runs off along it both ways. */
export interface Ripple {
  x: number;
  /** The rail's middle, px down the court. */
  y: number;
  /** Seconds since the bounce. */
  age: number;
  /** How hard it was struck, in [0, 1]. */
  strength: number;
}

/** Every particle and ring on screen this frame. */
export interface ParticleView {
  readonly particles: readonly Particle[];
  readonly rings: readonly ShockwaveRing[];
  readonly flares: readonly Flare[];
  readonly ripples: readonly Ripple[];
}
