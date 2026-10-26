import { describe, expect, it } from 'vitest';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { Particle } from '@/render/particles';

const particle = (life: number, id: number): Particle => ({
  x: id,
  y: 0,
  vx: 0,
  vy: 0,
  life,
  color: '#fff',
  size: 1,
});

describe('ParticleSystem', () => {
  it('drops the burnt-out particles and rings and keeps every live one, updated once', () => {
    const system = new ParticleSystem();
    // Dying particles at the start, the middle and the end of the list
    [0.01, 1, 0.01, 1, 1, 0.01].forEach((life, id) => system.addParticle(particle(life, id)));
    system.shockwave(0, 0, '#fff');

    system.update(0.1);

    expect(system.particles.map((p) => p.x).sort()).toEqual([1, 3, 4]);
    for (const p of system.particles) expect(p.life).toBeCloseTo(1 - 0.1 * 1.8);
    expect(system.rings).toHaveLength(1);

    system.update(1);
    expect(system.particles).toHaveLength(0);
    expect(system.rings).toHaveLength(0);
  });

  it('caps how many particles can pile up', () => {
    const system = new ParticleSystem();
    for (let i = 0; i < 50; i++) system.burst(0, 0, '#fff', 40);
    expect(system.particles.length).toBeLessThanOrEqual(800);
  });

  it('lets a hit’s light on the backdrop fade over its time and go', () => {
    const system = new ParticleSystem();
    system.light(100, 200, 300, '#fff', 0.4);
    system.update(0.2);
    expect(system.lights[0].life).toBeCloseTo(0.5);
    system.update(0.25);
    expect(system.lights).toHaveLength(0);
  });
});
