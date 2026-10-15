export const TEMPO = {
  INTENSITY_BPM: 8, // full intensity plays this many BPM faster than the track
  // Time constants (s) for the tempo to close ~63% of the gap to its target. Speeding up stays
  // fairly quick so a rally climax still pushes; slowing down is gentle, so the end of a climax
  // and a slower next song glide instead of jumping
  RISE_TIME: 1.5,
  FALL_TIME: 6,
} as const;

/** Where the tempo is heading: the track's own tempo, faster as the game heats up. */
export function getTargetBpm(trackBpm: number, intensity: number): number {
  return trackBpm + TEMPO.INTENSITY_BPM * intensity;
}

/** Moves the tempo toward its target over `dt` seconds of music. */
export function glideTempo(currentBpm: number, targetBpm: number, dt: number): number {
  const time = targetBpm > currentBpm ? TEMPO.RISE_TIME : TEMPO.FALL_TIME;
  return currentBpm + (targetBpm - currentBpm) * (1 - Math.exp(-dt / time));
}
