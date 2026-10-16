export const TWO_PI = Math.PI * 2;

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
 * Moves `current` toward `target`, closing the gap at `rate` per second (exponential smoothing).
 * Any frame rate covers the same distance in the same time: one 1/30 s step lands exactly where
 * two 1/60 s steps do. Writing `current += (target - current) * Math.min(1, dt * rate)` instead
 * moves faster at low frame rates and slower at high ones.
 */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/**
 * Blends two `#rrggbb` colors and returns an `rgb(...)` string.
 */
export function mixHexColors(from: string, to: string, t: number): string {
  const amount = clamp(t, 0, 1);
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);

  const [r, g, b] = [1, 3, 5].map((offset) =>
    Math.round(lerp(channel(from, offset), channel(to, offset), amount)),
  );
  return `rgb(${r}, ${g}, ${b})`;
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
