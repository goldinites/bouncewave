import { describe, expect, it } from 'vitest';
import { PaddleEffects } from '@/fx/PaddleEffects';
import { ParticleSystem } from '@/fx/ParticleSystem';
import { COURT, PADDLE } from '@/match/config';
import { Paddle } from '@/match/Paddle';
import { COLORS } from '@/shared/palette';

describe('PaddleEffects whip', () => {
  const setup = () => {
    const paddles = [
      new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
      new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
    ];
    const fx = new PaddleEffects(paddles.length);
    const run = (seconds: number) => {
      const angles: number[] = [];
      for (let t = 0; t < seconds; t += 1 / 60) {
        fx.update(1 / 60, paddles, new ParticleSystem(), 0);
        angles.push(fx.tilt[0]);
      }
      return angles;
    };
    return { fx, run };
  };

  /** The angles a whip goes through, frame by frame at 60 Hz, for `seconds`. */
  const whip = (side: number, velocity: number, strength: number, seconds = 0.6) => {
    const { fx, run } = setup();
    fx.onWhip(side === 0 ? 0 : 1, side, velocity, strength);
    const angles = run(seconds);
    return side === 0 ? angles : angles.map(() => fx.tilt[1]);
  };

  it('turns each paddle’s face the way it swept the ball', () => {
    const { fx, run } = setup();
    fx.onWhip(0, 0, 500, 0.5);
    fx.onWhip(1, 1, 500, 0.5);
    run(0.1);
    // Moving down: the left paddle turns clockwise, the right one counterclockwise
    expect(fx.tilt[0]).toBeGreaterThan(0);
    expect(fx.tilt[1]).toBeLessThan(0);
  });

  it('leans further off a harder spin, and always enough to see', () => {
    const gentle = Math.max(...whip(0, -500, 0).map(Math.abs));
    const hard = Math.max(...whip(0, -500, 1).map(Math.abs));
    expect(gentle).toBeGreaterThan(0.1);
    expect(hard).toBeGreaterThan(gentle);
  });

  it('leans in and comes back smoothly, never past upright, then stands still', () => {
    const angles = whip(0, 500, 1);
    const peak = Math.max(...angles);
    // No frame moves it more than a third of the way
    for (let i = 1; i < angles.length; i++) {
      expect(Math.abs(angles[i] - angles[i - 1])).toBeLessThan(peak / 3);
    }
    expect(Math.abs(angles[0])).toBeLessThan(peak / 3);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(0);
    expect(angles.at(-1)).toBe(0);
  });
});

describe('PaddleEffects on a hit and a charged Overdrive', () => {
  const paddles = () => [
    new Paddle(0, PADDLE.OFFSET_X, '#19f0ff'),
    new Paddle(1, COURT.WIDTH - PADDLE.OFFSET_X - PADDLE.WIDTH, '#ff2bd6'),
  ];

  it('knocks a hit paddle back and lets it spring home, never past where it stood', () => {
    const fx = new PaddleEffects(2);
    const court = paddles();
    fx.onHit(0, 6);
    const recoils: number[] = [];
    for (let t = 0; t < 0.4; t += 1 / 240) {
      fx.update(1 / 240, court, new ParticleSystem(), 0);
      recoils.push(fx.recoil[0]);
    }
    expect(Math.max(...recoils)).toBeCloseTo(6, 0);
    expect(Math.min(...recoils)).toBeGreaterThanOrEqual(0);
    expect(recoils.at(-1)).toBe(0);
    expect(fx.recoil[1]).toBe(0);
  });

  it('sheds yellow sparks off a paddle only while its Overdrive is charged', () => {
    const fx = new PaddleEffects(2);
    const court = paddles();
    const sparks = new ParticleSystem();
    for (let t = 0; t < 1; t += 1 / 60) fx.update(1 / 60, court, sparks, 0, [true, false]);
    const yellow = sparks.particles.filter((p) => p.color === COLORS.YELLOW);
    expect(yellow.length).toBeGreaterThan(0);
    expect(yellow.every((p) => Math.abs(p.x - court[0].x) < 60)).toBe(true);
  });
});
