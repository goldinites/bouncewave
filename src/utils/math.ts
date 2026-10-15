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
