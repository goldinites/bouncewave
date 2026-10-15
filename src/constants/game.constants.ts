export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 500;

export const PADDLE_WIDTH = 14;
export const PADDLE_HEIGHT = 92;
export const PADDLE_OFFSET_X = 34;
export const PADDLE_SPEED = 500;
export const PADDLE_SMOOTH_FACTOR = 22;
export const PADDLE_GLOW_DECAY = 4;
export const PADDLE_TOP_MARGIN = 20;
export const PADDLE_BOTTOM_MARGIN = 20;

// Hit offset is normalized to [-1, 1] from paddle center to edge
export const PADDLE_MAX_BOUNCE_ANGLE = 1.1; // radians, reached at the very edge
export const PADDLE_BOUNCE_CURVE = 1.6; // >1 keeps mid hits flatter and sharpens edge hits
// Paddle inertia: moving paddle nudges the outgoing angle, kept soft for jerky touch input
export const PADDLE_VELOCITY_SMOOTHING = 12; // 1/s, ~80 ms averaging window
export const PADDLE_SPIN_DEADZONE = 40; // px/s ignored as jitter
export const PADDLE_SPIN_REFERENCE_SPEED = 600; // px/s where the nudge reaches ~76% of max
export const PADDLE_SPIN_MAX_ANGLE = 0.2; // radians (~11°), saturates softly via tanh
export const PERFECT_HIT_ZONE = 0.15; // central share of the half-height that counts as perfect
export const PERFECT_HIT_BOOST = 0.25; // temporary extra speed share right after a perfect hit
export const PERFECT_HIT_BOOST_DURATION = 0.8; // seconds for the boost to fade out

export const COURT_TOP_WALL = 14;
export const COURT_BOTTOM_WALL = 14;
export const COURT_NET_LINE_WIDTH = 3;
export const COURT_NET_DASH_PATTERN = [12, 14];

export const BALL_INITIAL_RADIUS = 8;
export const BALL_INITIAL_SPEED = 340;
export const BALL_TRAIL_MAX_LENGTH = 9;
export const BALL_OUT_OF_BOUNDS_OFFSET = 30;
export const BALL_MAX_TRAIL_RALLY = 14;

// Rally length at which "heat" maxes out and the climax (music drop, laser surge) kicks in
export const CLIMAX_RALLY = BALL_MAX_TRAIL_RALLY;

export const WINNING_SCORE = 10;

export const SERVE_DELAY_NORMAL = 1.2;
export const SERVE_DELAY_START = 1.5;
export const SERVE_DELAY_DEMO = 0.5;
export const SERVE_DELAY_GAME_OVER = 0.8;

export const TWO_PI = Math.PI * 2;

export const COLORS = {
  CYAN: '#19f0ff',
  PINK: '#ff2bd6',
  PURPLE: '#b79bff',
  YELLOW: '#ffe53b',
  BG_DARK: '#0b0320',
  TEXT_LIGHT: '#f4e9ff',
  WHITE: '#ffffff',
  OVERLAY_BG: 'rgba(8, 2, 26, 0.6)',
} as const;

export const CSS_CLASSES = {
  GAME_UI_HIDDEN: 'game__ui--hidden',
  GAME_PAUSE_HIDDEN: 'game-pause--hidden',
  CRT_GLITCH_ACTIVE: 'crt-glitch-active',
  VICTORY_BURST_ACTIVE: 'victory-burst-active',
} as const;
