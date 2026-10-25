/**
 * The channel surf at the start of a match: a few backdrops flick past through static, a step
 * apiece, before the one the match is played on settles in. Shared by the picture and the sound.
 */
export const CHANNEL_SURF = {
  /** Backdrops shown in turn, the last one the match's own. */
  CHANNELS: 5,
  /** Seconds each one is on screen before the next flicks in. */
  STEP: 0.14,
  /** Seconds the static takes to clear once the last one is on. */
  SETTLE: 0.35,
  /**
   * Seconds the static takes to clear when one channel is tuned to straight off, as the quick
   * match's setup flicks between backdrops: quick enough to flick through them.
   */
  TUNE: 0.25,
} as const;
