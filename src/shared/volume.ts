/**
 * A volume the player sets (the music's, the sounds'), in percent: 0 is silence, 100 the mix as
 * it was balanced (step 5.9). The settings step it by tens.
 */
export type Volume = number;

export const VOLUME = {
  MAX: 100,
  STEP: 10,
  // dB each step down from MAX takes off: the ear hears loudness in decibels, so even steps of
  // gain would sound alike at the top and fall away all at once at the bottom (10% is -27 dB)
  STEP_DB: 3,
} as const;

/** Every volume the settings step through, from silence up. */
export const VOLUMES: readonly Volume[] = Array.from(
  { length: VOLUME.MAX / VOLUME.STEP + 1 },
  (_, i) => i * VOLUME.STEP,
);

export const isVolume = (value: unknown): value is Volume =>
  typeof value === 'number' && VOLUMES.includes(value);

/** The gain a volume plays at: 1 at MAX, STEP_DB less each step down, nothing at 0. */
export function volumeGain(volume: Volume): number {
  if (volume <= 0) return 0;
  const steps = (VOLUME.MAX - Math.min(volume, VOLUME.MAX)) / VOLUME.STEP;
  return 10 ** ((-steps * VOLUME.STEP_DB) / 20);
}

/** The volume a step up (1) or down (-1) from `volume`, held at the ends. */
export function stepVolume(volume: Volume, step: 1 | -1): Volume {
  return Math.min(VOLUME.MAX, Math.max(0, volume + step * VOLUME.STEP));
}
