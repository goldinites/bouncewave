import { describe, expect, it, vi } from 'vitest';
import { DIFFICULTY_CONFIGS } from '@/constants/difficulty.constants';
import {
  COURT_BOTTOM_WALL,
  COURT_TOP_WALL,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_OFFSET_X,
  PADDLE_WIDTH,
} from '@/constants/game.constants';
import { Physics, PhysicsCallbacks } from '@/core/Physics';
import { Ball } from '@/entities/Ball';
import { Paddle } from '@/entities/Paddle';
import { ParticleSystem } from '@/entities/ParticleSystem';
import { DifficultyLevel } from '@/types/difficulty.types';
import { GameMode } from '@/types/game.types';

describe('Physics Engine', () => {
  const getMockCallbacks = (): {
    callbacks: PhysicsCallbacks;
    spies: Record<keyof PhysicsCallbacks, ReturnType<typeof vi.fn>>;
  } => {
    const spies = {
      onWallBounce: vi.fn(),
      onPaddleHit: vi.fn(),
      onScore: vi.fn(),
      onScreenShake: vi.fn(),
    };
    return { callbacks: spies, spies };
  };

  it('handles top wall bounce and inverts vy', () => {
    const ball = new Ball();
    ball.x = 400;
    ball.y = COURT_TOP_WALL + 5;
    ball.vy = -300;
    ball.vx = 200;

    const p1 = new Paddle(0, PADDLE_OFFSET_X, '#19f0ff');
    const p2 = new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    const particles = new ParticleSystem();
    const rallyRef = { current: 0 };
    const { callbacks, spies } = getMockCallbacks();

    Physics.updateBallMovement(
      ball,
      [p1, p2],
      particles,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      GameMode.PLAYER_VS_AI,
      rallyRef,
      0.016,
      callbacks,
    );

    expect(ball.vy).toBeGreaterThan(0);
    expect(spies.onWallBounce).toHaveBeenCalled();
  });

  it('handles bottom wall bounce and inverts vy', () => {
    const ball = new Ball();
    ball.x = 400;
    ball.y = GAME_HEIGHT - COURT_BOTTOM_WALL - 5;
    ball.vy = 300;
    ball.vx = 200;

    const p1 = new Paddle(0, PADDLE_OFFSET_X, '#19f0ff');
    const p2 = new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    const particles = new ParticleSystem();
    const rallyRef = { current: 0 };
    const { callbacks, spies } = getMockCallbacks();

    Physics.updateBallMovement(
      ball,
      [p1, p2],
      particles,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      GameMode.PLAYER_VS_AI,
      rallyRef,
      0.016,
      callbacks,
    );

    expect(ball.vy).toBeLessThan(0);
    expect(spies.onWallBounce).toHaveBeenCalled();
  });

  it('handles left paddle collision and accelerates ball', () => {
    const ball = new Ball();
    const p1 = new Paddle(0, PADDLE_OFFSET_X, '#19f0ff');
    const p2 = new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');

    p1.y = 250;
    p1.targetY = 250;

    ball.x = p1.x + PADDLE_WIDTH + 2;
    ball.y = 250;
    ball.vx = -400;
    ball.vy = 0;
    ball.speed = 400;

    const particles = new ParticleSystem();
    const rallyRef = { current: 0 };
    const { callbacks, spies } = getMockCallbacks();

    Physics.updateBallMovement(
      ball,
      [p1, p2],
      particles,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      GameMode.PLAYER_VS_AI,
      rallyRef,
      0.016,
      callbacks,
    );

    expect(ball.vx).toBeGreaterThan(0);
    expect(p1.glow).toBe(1.0);
    expect(rallyRef.current).toBe(1);
    expect(spies.onPaddleHit).toHaveBeenCalledWith(0, 1);
  });

  it('triggers score callback when ball exits playing field', () => {
    const ball = new Ball();
    ball.x = -35;
    ball.vx = -500;

    const p1 = new Paddle(0, PADDLE_OFFSET_X, '#19f0ff');
    const p2 = new Paddle(1, GAME_WIDTH - PADDLE_OFFSET_X - PADDLE_WIDTH, '#ff2bd6');
    const particles = new ParticleSystem();
    const rallyRef = { current: 0 };
    const { callbacks, spies } = getMockCallbacks();

    Physics.updateBallMovement(
      ball,
      [p1, p2],
      particles,
      DIFFICULTY_CONFIGS[DifficultyLevel.NORMAL],
      GameMode.PLAYER_VS_AI,
      rallyRef,
      0.016,
      callbacks,
    );

    expect(spies.onScore).toHaveBeenCalledWith(1); // Player 2 scores
  });
});
