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
}

/** A ring spreading out from a hit and fading. */
export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
  velocity: number;
}

/** Every particle and ring on screen this frame. */
export interface ParticleView {
  readonly particles: readonly Particle[];
  readonly rings: readonly ShockwaveRing[];
}
