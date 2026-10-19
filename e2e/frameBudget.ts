/**
 * How long a frame may take, as the frame bench (e2e/bench) times it on the CI runner: the
 * script's side of drawing a background with the match on it, and of simulating the match. A
 * frame at 60 per second has 16.7 ms in all. Not a phone's frame time (the pixels are filled on
 * its GPU, and the dynamic resolution steps in when frames run slow), but a line a change that
 * makes a frame much heavier crosses, in its own pull request.
 *
 * Calibrated on 2026-10-20: locally (Windows desktop) the backgrounds take 3–9 ms at the 95th
 * percentile, the simulation 0.03 ms on average. Raise a budget only for a reason, in the commit
 * that needs it.
 */
export const FRAME_BUDGET = {
  RENDER_P95: 16, // ms, each background, at the 95th percentile of its frames
  SIMULATION_MEAN: 1, // ms a frame (four steps of 1/240 s), on average
} as const;
