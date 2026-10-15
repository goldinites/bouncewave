import { randomRange, TWO_PI } from '@/shared/math';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  color: string;
  velocity: number;
}

const PARTICLE_LIFE_DECAY = 1.8;
const PARTICLE_VELOCITY_DAMPING = 0.98;
const SHOCKWAVE_EXPANSION_SPEED = 260;

export class ParticleSystem {
  public particles: Particle[] = [];
  public rings: ShockwaveRing[] = [];

  public addParticle(p: Particle): void {
    this.particles.push(p);
  }

  public burst(x: number, y: number, color: string, count: number, baseSpeed = 260): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TWO_PI;
      const speed = baseSpeed * (0.3 + Math.random());
      this.particles.push({
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
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= PARTICLE_VELOCITY_DAMPING;
      p.vy *= PARTICLE_VELOCITY_DAMPING;
      p.life -= dt * PARTICLE_LIFE_DECAY;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.radius += r.velocity * dt;
      r.life -= dt * PARTICLE_LIFE_DECAY;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }
}
