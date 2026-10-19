import { Particle, ShockwaveRing } from '@/render/particles';
import { randomRange, TWO_PI } from '@/shared/math';

const PARTICLE_LIFE_DECAY = 1.8;
const PARTICLE_VELOCITY_DAMPING = 0.98;
const SHOCKWAVE_EXPANSION_SPEED = 260;
// Far above what a match produces (the victory fireworks peak at a few hundred); only a guard
// against a pile-up, e.g. after a long hitch
const MAX_PARTICLES = 800;

export class ParticleSystem {
  public particles: Particle[] = [];
  public rings: ShockwaveRing[] = [];

  public addParticle(p: Particle): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
  }

  public burst(x: number, y: number, color: string, count: number, baseSpeed = 260): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TWO_PI;
      const speed = baseSpeed * (0.3 + Math.random());
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        size: randomRange(1, 3.5),
      });
    }
  }

  public shockwave(
    x: number,
    y: number,
    color: string,
    expansionSpeed = SHOCKWAVE_EXPANSION_SPEED,
  ): void {
    this.rings.push({
      x,
      y,
      radius: 6,
      life: 1.0,
      color,
      velocity: expansionSpeed,
    });
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
      r.life -= dt * PARTICLE_LIFE_DECAY;
      if (r.life <= 0) removeAt(rings, i);
    }
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
