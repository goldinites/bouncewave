/**
 * Clamps a number between a minimum and a maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between two numbers.
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Converts a MIDI note number to its frequency in Hertz (Hz).
 * A4 = MIDI note 69 = 440 Hz.
 */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Returns a random number in the range [min, max).
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a random integer in the range [min, max].
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}
