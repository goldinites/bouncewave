import { Flare, Particle, Ripple, RIPPLE_LIFE, ShockwaveRing } from '@/render/particles';
import { randomRange, TWO_PI } from '@/shared/math';

const PARTICLE_LIFE_DECAY = 1.8;
const PARTICLE_VELOCITY_DAMPING = 0.98;
const SHOCKWAVE_EXPANSION_SPEED = 260;
const SHOCKWAVE_WIDTH = 3; // px
const SPARK_SIZE = { MIN: 1, MAX: 3.5 } as const; // px
// Far above what a match produces (the victory fireworks peak at a few hundred); only a guard
// against a pile-up, e.g. after a long hitch
const MAX_PARTICLES = 800;
// A few walls' waves at once at most, the oldest dropped
const MAX_RIPPLES = 6;

/** Where a burst throws its sparks, and what they are. */
export interface BurstShape {
  /** Thrown this way (radians), `spread` wide, rather than all round. */
  heading?: number;
  spread?: number;
  /** px across, the smallest and the largest. */
  size?: readonly [number, number];
  /** Streaks along their flight rather than dots. */
  isStreak?: boolean;
}

/** How a ring spreads: how soon it fades, how thick it is, and whether only an arc of it. */
export interface RingShape {
  decay?: number;
  width?: number;
  wake?: number;
  heading?: number;
  spread?: number;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public rings: ShockwaveRing[] = [];
  public flares: Flare[] = [];
  public ripples: Ripple[] = [];

  public addParticle(p: Particle): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
  }

  public burst(
    x: number,
    y: number,
    color: string,
    count: number,
    baseSpeed = 260,
    shape: BurstShape = {},
  ): void {
    const { heading, spread = TWO_PI, size = [SPARK_SIZE.MIN, SPARK_SIZE.MAX], isStreak } = shape;
    for (let i = 0; i < count; i++) {
      const angle =
        heading === undefined ? Math.random() * TWO_PI : heading + (Math.random() - 0.5) * spread;
      const speed = baseSpeed * (0.3 + Math.random());
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        size: randomRange(size[0], size[1]),
        isStreak,
      });
    }
  }

  public shockwave(
    x: number,
    y: number,
    color: string,
    expansionSpeed = SHOCKWAVE_EXPANSION_SPEED,
    shape: RingShape = {},
  ): void {
    this.rings.push({
      x,
      y,
      radius: 6,
      life: 1.0,
      color,
      velocity: expansionSpeed,
      decay: shape.decay ?? PARTICLE_LIFE_DECAY,
      width: shape.width ?? SHOCKWAVE_WIDTH,
      wake: shape.wake ?? 0,
      heading: shape.heading,
      spread: shape.spread,
    });
  }

  /**
   * The flash of contact at (x, y), `radius` px, gone in `duration` s; with `spikes`, a star
   * glint's rays reaching that far across it.
   */
  public flare(
    x: number,
    y: number,
    radius: number,
    color: string,
    duration: number,
    spikes = 0,
  ): void {
    this.flares.push({ x, y, radius, life: 1, decay: 1 / duration, color, spikes });
  }

  /**
   * A wall struck at `x`, its rail's middle at `y`, `strength` in [0, 1]; or, `isUpright`, a goal
   * line at `x` struck at `y`, in `color`.
   */
  public ripple(x: number, y: number, strength: number, isUpright = false, color?: string): void {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, age: 0, strength, isUpright, color });
  }

  /** Everything gone at once. */
  public clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.flares.length = 0;
    this.ripples.length = 0;
  }

  public update(dt: number): void {
    const particles = this.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= PARTICLE_VELOCITY_DAMPING;
      p.vy *= PARTICLE_VELOCITY_DAMPING;
      p.life -= dt * PARTICLE_LIFE_DECAY;
      if (p.life <= 0) removeAt(particles, i);
    }

    const rings = this.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.radius += r.velocity * dt;
      r.life -= dt * r.decay;
      if (r.life <= 0) removeAt(rings, i);
    }

    const flares = this.flares;
    for (let i = flares.length - 1; i >= 0; i--) {
      flares[i].life -= dt * flares[i].decay;
      if (flares[i].life <= 0) removeAt(flares, i);
    }

    for (const ripple of this.ripples) ripple.age += dt;
    while (this.ripples.length > 0 && this.ripples[0].age >= RIPPLE_LIFE) this.ripples.shift();
  }
}

/**
 * Removes an item in O(1) by moving the last one into its place. Draw order changes, which
 * doesn't show: particles and rings are drawn additively ('lighter').
 */
function removeAt<T>(items: T[], index: number): void {
  const last = items.pop() as T;
  if (index < items.length) items[index] = last;
}
