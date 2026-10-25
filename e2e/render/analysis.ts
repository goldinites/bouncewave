/*
 * The track render's arithmetic (`npm run render`, docs/AUDIO.md "Как делаем трек"): spectra,
 * loudness, bands, how alike the bars are, how far a paddle hit stands above the music, and the
 * report. Pure, so the unit tests check it (tests/trackAnalysis.test.ts); the render page
 * (render.ts) feeds it the rendered samples.
 */
import { MelodyNote, Section, STEPS_PER_BAR } from '@/audio/music/score';

export const ANALYSIS = {
  FFT_SIZE: 4096, // samples: 11.7 Hz bins at 48 kHz, fine enough for a bass line
  HOP: 1024, // samples between frames: 21 ms at 48 kHz
  SILENCE_DB: -120,
  TARGET_DB: -25, // where the soundtrack sits (docs/AUDIO.md, "Громкость")
  // The music bus's compressor takes about a quarter of any change: a `level` moves the
  // loudness by about three quarters of itself
  LEVEL_EFFECT: 0.75,
  PHONE_CUT: 150, // Hz: a phone's speaker plays nothing below this
  HIT_BAND: [1000, 4000], // Hz: where the paddle hits sit (docs/AUDIO.md, "Микс")
  // How a song's parts should stand to its grooves (docs/AUDIO.md, "Микс"): a peak louder, calm
  // parts quieter, dB, as [least, most]
  PEAK_LIFT: [2, 4],
  CALM_DROP: [3, 6],
  HIT_WINDOW: 0.06, // s after a hit's onset that it is heard against the music
  HIT_AUDIBLE_DB: 6, // a hit this far above the music in its band is clearly heard
  // Renders with and without hits differing by less than this against the music, where there is
  // no hit, are the same music: a lead's long tail may wander a little from one render to the next
  RESIDUAL_DB: -25,
  HIT_SHARE_DB: 20, // a band within this of the hit's loudest holds a fair share of it
  // A bar whose texture differs from the four before it by this much is a change of texture
  NOVELTY_CHANGE: 0.15,
  NOVELTY_HALF: 4, // bars on either side of the line the novelty compares
  // A moment of the match (a finale, the pause…): its level every LEVEL_STEP s, its steepest
  // sample-to-sample jump in each JUMP_WINDOW s against the steepest the same music makes without
  // it (a jump this many times steeper may be a click), and its longest stretch quieter than
  // SILENCE_FLOOR (a drop-out) in GAP_WINDOW s pieces
  LEVEL_STEP: 0.25,
  JUMP_WINDOW: 0.05,
  JUMP_SUSPECT: 2,
  SILENCE_FLOOR: -60, // dBFS
  GAP_WINDOW: 0.01,
} as const;

/** Octave bands a hit is looked for in, from its body to its click: 250 Hz to 16 kHz. */
const HIT_BANDS = logEdges(250, 16000, 6);

/** The bands the report breaks loudness into, as [low, high) Hz. */
export const REPORT_BANDS: readonly { name: string; low: number; high: number }[] = [
  { name: 'sub', low: 20, high: 60 },
  { name: 'bass', low: 60, high: 150 },
  { name: 'low-mid', low: 150, high: 500 },
  { name: 'mid', low: 500, high: 2000 },
  { name: 'presence', low: 2000, high: 6000 },
  { name: 'air', low: 6000, high: 16000 },
];

export const db = (power: number): number =>
  power > 0 ? Math.max(ANALYSIS.SILENCE_DB, 10 * Math.log10(power)) : ANALYSIS.SILENCE_DB;

/** In-place radix-2 FFT; the length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tRe = re[b] * wRe - im[b] * wIm;
        const tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = wRe * stepRe - wIm * stepIm;
        wIm = wRe * stepIm + wIm * stepRe;
        wRe = nextRe;
      }
    }
  }
}

const hannCache = new Map<number, Float64Array>();
const hann = (size: number): Float64Array => {
  let window = hannCache.get(size);
  if (!window) {
    window = new Float64Array(size);
    for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
    hannCache.set(size, window);
  }
  return window;
};

/**
 * The power of each frequency bin of `length` samples from `start` (zero beyond the end),
 * Hann-windowed or not, scaled so a full-scale sine reads about 0.5 summed over its bins: the
 * mean square of the signal, as RMS loudness counts it.
 */
export function powerSpectrum(
  samples: Float32Array,
  start: number,
  length: number = ANALYSIS.FFT_SIZE,
  size: number = ANALYSIS.FFT_SIZE,
  isWindowed = true,
): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const window = isWindowed ? hann(length) : null;
  let windowPower = 0;
  for (let i = 0; i < length; i++) {
    const w = window ? window[i] : 1;
    windowPower += w * w;
    const sample = samples[start + i] ?? 0;
    re[i] = sample * w;
  }
  fft(re, im);
  const power = new Float64Array(size / 2);
  // Parseval: the bins' powers, both halves, sum to `length` × the windowed mean square
  const scale = 2 / (size * windowPower);
  for (let k = 0; k < size / 2; k++) power[k] = (re[k] * re[k] + im[k] * im[k]) * scale;
  return power;
}

/** `count` bands spaced evenly in pitch from `low` to `high` Hz, as their `count + 1` edges. */
export function logEdges(low: number, high: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, i) => low * (high / low) ** (i / count));
}

/** A spectrum's power summed into the bands between consecutive `edges` (Hz). */
export function bandPowers(power: Float64Array, rate: number, edges: readonly number[]): number[] {
  const binHz = rate / (power.length * 2);
  const bands = new Array<number>(edges.length - 1).fill(0);
  for (let band = 0; band < bands.length; band++) {
    const from = Math.max(1, Math.ceil(edges[band] / binHz));
    const to = Math.min(power.length, Math.ceil(edges[band + 1] / binHz));
    if (from < to) {
      for (let k = from; k < to; k++) bands[band] += power[k];
    } else {
      // A band narrower than a bin (the low end of a fine picture) takes its share of the bin
      // it lies in, so it isn't left empty between its neighbours
      const bin = Math.min(
        power.length - 1,
        Math.round(Math.sqrt(edges[band] * edges[band + 1]) / binHz),
      );
      bands[band] = (power[bin] * (edges[band + 1] - edges[band])) / binHz;
    }
  }
  return bands;
}

/**
 * The short-time spectrum of the whole render, every `ANALYSIS.HOP` samples, summed into each of
 * the band sets: one array of frames per set, each frame its bands' powers.
 */
export function spectrogram(
  samples: Float32Array,
  rate: number,
  bandSets: readonly (readonly number[])[],
): number[][][] {
  const sets = bandSets.map((): number[][] => []);
  for (let start = 0; start + ANALYSIS.HOP <= samples.length; start += ANALYSIS.HOP) {
    const power = powerSpectrum(samples, start);
    bandSets.forEach((edges, i) => sets[i].push(bandPowers(power, rate, edges)));
  }
  return sets;
}

/** The two channels averaged, as the stand's meter and a phone's single speaker hear them. */
export function toMono(channels: readonly Float32Array[]): Float32Array<ArrayBuffer> {
  const mono = new Float32Array(channels[0].length);
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
  }
  return mono;
}

/** Mean square and peak of the samples in [from, to), in dBFS. */
export function levels(
  samples: Float32Array,
  from = 0,
  to = samples.length,
): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  const end = Math.min(to, samples.length);
  for (let i = from; i < end; i++) {
    sum += samples[i] * samples[i];
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return { rms: db(sum / Math.max(1, end - from)), peak: db(peak * peak) };
}

/** Each column (band) of the frames summed over the frames in [from, to). */
export function sumFrames(frames: readonly number[][], from: number, to: number): number[] {
  const sums = new Array<number>(frames[0]?.length ?? 0).fill(0);
  for (let f = Math.max(0, from); f < Math.min(to, frames.length); f++) {
    frames[f].forEach((value, band) => (sums[band] += value));
  }
  return sums;
}

/** The pitch centre of a spectrum summed into bands: the power-weighted geometric mean, Hz. */
export function centroidHz(bands: readonly number[], edges: readonly number[]): number {
  let total = 0;
  let logSum = 0;
  bands.forEach((power, i) => {
    total += power;
    logSum += power * Math.log(Math.sqrt(edges[i] * edges[i + 1]));
  });
  return total > 0 ? Math.exp(logSum / total) : 0;
}

/**
 * How much two spectra share the same bands, from 0 (apart) to 1 (the same): the intersection of
 * their shapes, each normalized to a total of one. A melody and an arpeggio high in it blur
 * into one line for the ear.
 */
export function overlap(a: readonly number[], b: readonly number[]): number {
  const sumA = a.reduce((sum, value) => sum + value, 0);
  const sumB = b.reduce((sum, value) => sum + value, 0);
  if (sumA === 0 || sumB === 0) return 0;
  return a.reduce((shared, value, i) => shared + Math.min(value / sumA, b[i] / sumB), 0);
}

/**
 * How alike every two bars sound, from -1 to 1: the cosine of their spectral shapes — each bar's
 * bands in dB less the bar's own mean (its loudness doesn't count), less each band's median over
 * the song (what all bars share doesn't count, and one odd part, an intro, doesn't swamp the
 * rest). A track that never changes is an even grid of bright squares.
 */
export function selfSimilarity(bars: readonly number[][]): number[][] {
  const logs = bars.map((bands) => {
    const values = bands.map((power) => db(power));
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    return values.map((value) => value - mean);
  });
  const medians = logs[0]?.map((_, band) => median(logs.map((bar) => bar[band]))) ?? [];
  const centred = logs.map((bar) => bar.map((value, band) => value - medians[band]));
  const norms = centred.map((bar) => Math.hypot(...bar));
  return centred.map((a, i) =>
    centred.map((b, j) => {
      const norm = norms[i] * norms[j];
      return norm > 0 ? a.reduce((sum, value, k) => sum + value * b[k], 0) / norm : 1;
    }),
  );
}

/**
 * How much the texture changes at the start of each bar, from 0 up (Foote's novelty): how much
 * less alike the bars across the line are than the bars on each side of it, `half` bars a side.
 */
export function novelty(
  similarity: readonly number[][],
  half: number = ANALYSIS.NOVELTY_HALF,
): number[] {
  const n = similarity.length;
  return similarity.map((_, line) => {
    let within = 0;
    let across = 0;
    let withinCount = 0;
    let acrossCount = 0;
    for (let i = line - half; i < line + half; i++) {
      for (let j = line - half; j < line + half; j++) {
        if (i < 0 || j < 0 || i >= n || j >= n || i === j) continue;
        const isAcross = i < line !== j < line;
        if (isAcross) {
          across += similarity[i][j];
          acrossCount++;
        } else {
          within += similarity[i][j];
          withinCount++;
        }
      }
    }
    if (acrossCount === 0 || withinCount === 0) return 0;
    return Math.max(0, (within / withinCount - across / acrossCount) / 2);
  });
}

/** The bars the texture changes on (novelty above `threshold`; bar 0 is the start). */
export function textureChanges(
  values: readonly number[],
  threshold: number = ANALYSIS.NOVELTY_CHANGE,
): number[] {
  return values.flatMap((value, bar) =>
    bar > 0 &&
    value >= threshold &&
    value >= (values[bar - 1] ?? 0) &&
    value >= (values[bar + 1] ?? 0)
      ? [bar]
      : [],
  );
}

/** The longest run of bars with no change of texture in it: its first bar and its length. */
export function longestStill(
  changes: readonly number[],
  bars: number,
): { from: number; length: number } {
  const lines = [0, ...changes.filter((bar) => bar > 0 && bar < bars), bars];
  let best = { from: 0, length: 0 };
  for (let i = 1; i < lines.length; i++) {
    const length = lines[i] - lines[i - 1];
    if (length > best.length) best = { from: lines[i - 1], length };
  }
  return best;
}

/**
 * How far a hit stands above the music over `window` seconds from `at`, in dB: in the band the
 * hits are meant to sit in (`ANALYSIS.HIT_BAND`), and in the band where it stands out most (of
 * those holding a fair share of it, `HIT_BANDS`), which is what decides whether it is heard. The
 * hit is what the render with hits has that the same render without them hasn't.
 */
export function hitMargin(
  music: Float32Array,
  withHits: Float32Array,
  rate: number,
  at: number,
  window: number = ANALYSIS.HIT_WINDOW,
): { inBand: number; best: number; bestHz: number } {
  const start = Math.round(at * rate);
  const length = Math.round(window * rate);
  const size = 2 ** Math.ceil(Math.log2(length));
  const hit = new Float32Array(length);
  for (let i = 0; i < length; i++) hit[i] = (withHits[start + i] ?? 0) - (music[start + i] ?? 0);
  const hitSpectrum = powerSpectrum(hit, 0, length, size, false);
  const musicSpectrum = powerSpectrum(music, start, length, size, false);
  const margin = (edges: readonly number[]) => {
    const hitBands = bandPowers(hitSpectrum, rate, edges);
    const musicBands = bandPowers(musicSpectrum, rate, edges);
    return hitBands.map((power, i) => ({ hit: db(power), margin: db(power) - db(musicBands[i]) }));
  };
  const [inBand] = margin(ANALYSIS.HIT_BAND);
  const bands = margin(HIT_BANDS);
  const loudest = Math.max(...bands.map((band) => band.hit));
  let best = { margin: -Infinity, hz: 0 };
  bands.forEach((band, i) => {
    if (band.hit >= loudest - ANALYSIS.HIT_SHARE_DB && band.margin > best.margin) {
      best = { margin: band.margin, hz: Math.sqrt(HIT_BANDS[i] * HIT_BANDS[i + 1]) };
    }
  });
  return { inBand: inBand.margin, best: best.margin, bestHz: best.hz };
}

/** The middle value of the numbers (NaN for none). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A section's melody, as the rules of docs/AUDIO.md count it: notes starting in each bar, and the
 * share of notes in quick runs (three notes in a row of an eighth or shorter) and held ones (half
 * a bar or more). Null for a section with no melody.
 */
export function melodyStats(
  section: Pick<Section, 'bars' | 'lead'>,
): { perBar: number[]; quick: number; held: number } | null {
  if (!section.lead) return null;
  const perBar = new Array<number>(section.bars).fill(0);
  const notes: MelodyNote[] = [];
  section.lead.forEach((note, step) => {
    if (!note) return;
    perBar[Math.floor(step / STEPS_PER_BAR)]++;
    notes.push(note);
  });
  if (notes.length === 0) return { perBar, quick: 0, held: 0 };
  const inQuickRun = notes.map(() => false);
  notes.forEach((_, i) => {
    const run = notes.slice(i, i + 3);
    if (run.length === 3 && run.every((n) => n.steps <= 2)) {
      for (let k = i; k < i + 3; k++) inQuickRun[k] = true;
    }
  });
  return {
    perBar,
    quick: inQuickRun.filter(Boolean).length / notes.length,
    held: notes.filter((n) => n.steps >= STEPS_PER_BAR / 2).length / notes.length,
  };
}

/** The `level` change, in dB to half a dB, that brings a song measured at `loudness` to the target. */
export function levelChange(loudness: number): number {
  return Math.round(((ANALYSIS.TARGET_DB - loudness) / ANALYSIS.LEVEL_EFFECT) * 2) / 2;
}

/**
 * How a song's tiers stand to its grooves, from its parts: each tier's mean loudness, how much
 * louder the peaks are and how much quieter the calm parts (dB; NaN for a tier the song lacks),
 * and how much brighter the peaks are in the presence band.
 */
export function dynamics(parts: readonly Pick<PartReport, 'tier' | 'rms' | 'bands'>[]) {
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
  const of = (tier: string) => parts.filter((part) => part.tier === tier);
  const presence = REPORT_BANDS.findIndex((band) => band.name === 'presence');
  const groove = mean(of('groove').map((p) => p.rms));
  const high = mean(of('high').map((p) => p.rms));
  const calm = mean(of('calm').map((p) => p.rms));
  return {
    groove,
    high,
    calm,
    peakLift: high - groove,
    calmDrop: groove - calm,
    peakBrightening:
      mean(of('high').map((p) => p.bands[presence])) -
      mean(of('groove').map((p) => p.bands[presence])),
  };
}

/** Whether `value` is within [least, most]: the verdict a report prints beside it. */
const verdict = (value: number, [least, most]: readonly number[]) =>
  Number.isNaN(value) ? '—' : value < least ? 'too little' : value > most ? 'too much' : 'ok';

/** One part of the form as rendered. */
export interface PartReport {
  name: string;
  tier: string;
  /** Its first bar in the form, from 0, and how many it has. */
  bar: number;
  bars: number;
  rms: number;
  peak: number;
  /** Each of REPORT_BANDS' level against the part's whole power, dB. */
  bands: number[];
  /** How much quieter the part is on a phone's speaker, with nothing below PHONE_CUT, dB. */
  phoneLoss: number;
  /** Pitch centres of the melody and the arpeggio alone, Hz (0 if the layer is silent). */
  leadHz: number;
  arpHz: number;
  /** How much the melody's and the arpeggio's spectra overlap, from 0 to 1. */
  leadArpOverlap: number;
  melody: ReturnType<typeof melodyStats>;
}

export interface HitReport {
  kind: string;
  /** Every hit of the kind: how far above the music it stands (hitMargin). */
  margins: ReturnType<typeof hitMargin>[];
}

/** A moment of the match rendered over a groove: how it sounds as it comes and goes. */
export interface MomentReport {
  name: string;
  /** What happens when, s from the start. */
  events: string;
  /** dBFS every LEVEL_STEP s. */
  levels: number[];
  /** The steepest jump after the first event, against the music's own steepest, and where, s. */
  jump: { ratio: number; at: number };
  /** The longest stretch quieter than SILENCE_FLOOR after the first event, s. */
  gap: number;
}

/** The level of `samples` every `step` seconds, dBFS. */
export function levelTrack(samples: Float32Array, rate: number, step: number): number[] {
  const size = Math.round(step * rate);
  return Array.from({ length: Math.floor(samples.length / size) }, (_, i) =>
    Math.round(levels(samples, i * size, (i + 1) * size).rms),
  );
}

/** The steepest step from one sample to the next in [from, to). */
function steepest(samples: Float32Array, from: number, to: number): number {
  let top = 0;
  for (let i = Math.max(1, from); i < Math.min(to, samples.length); i++) {
    top = Math.max(top, Math.abs(samples[i] - samples[i - 1]));
  }
  return top;
}

/**
 * The steepest jump from `start` s on, as a share of the steepest in `music` — the same music
 * rendered without the moment — and the window it is in: a click is a jump far steeper than any
 * the music makes by itself.
 */
export function worstJump(
  samples: Float32Array,
  music: Float32Array,
  rate: number,
  start: number,
): { ratio: number; at: number } {
  const reference = Math.max(1e-6, steepest(music, 0, music.length));
  const size = Math.round(ANALYSIS.JUMP_WINDOW * rate);
  let worst = { ratio: 0, at: start };
  for (let from = Math.round(start * rate); from < samples.length; from += size) {
    const ratio = steepest(samples, from, from + size) / reference;
    if (ratio > worst.ratio) worst = { ratio, at: from / rate };
  }
  return worst;
}

/** The longest run of GAP_WINDOW pieces quieter than SILENCE_FLOOR from `start` s on, in s. */
export function longestGap(samples: Float32Array, rate: number, start: number): number {
  const size = Math.round(ANALYSIS.GAP_WINDOW * rate);
  let run = 0;
  let longest = 0;
  for (let from = Math.round(start * rate); from + size <= samples.length; from += size) {
    run = levels(samples, from, from + size).rms < ANALYSIS.SILENCE_FLOOR ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest * ANALYSIS.GAP_WINDOW;
}

export interface TrackReport {
  title: string;
  id: string;
  bpm: number;
  level: number;
  /** The stand's swaps and mutes the render was made with, as written on the command line. */
  options: string;
  parts: PartReport[];
  /** The parts a rally plays (verses and peaks), what songs are levelled by. */
  loudness: number;
  hitPart: string;
  hits: HitReport[];
  /** How far apart the renders with and without hits are before the first hit, dB under the music. */
  hitResidual: number;
  /** The texture's change at the start of every bar (novelty). */
  novelty: number[];
  bars: number;
  changes: number[];
  still: { from: number; length: number };
  /** The match's moments over a groove (5.8): the finales, the pause, the deciding point… */
  moments: MomentReport[];
  renderSeconds: number;
}

const signed = (value: number, digits = 1) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** The report as Markdown, for `renders/<song>/report.md` and for reading in the terminal. */
export function formatReport(report: TrackReport): string {
  const { parts, hits } = report;
  const change = levelChange(report.loudness);
  const dyn = dynamics(parts);
  const lines = [
    `# ${report.title}`,
    '',
    `${report.bpm} bpm · ${report.bars} bars · whole form, each part at its tier's heat in a match` +
      (report.options ? ` · ${report.options}` : '') +
      ` · rendered in ${report.renderSeconds.toFixed(1)} s`,
    '',
    '## Loudness',
    '',
    `Rally parts (groove, high): **${report.loudness.toFixed(1)} dB** against ${ANALYSIS.TARGET_DB}: ` +
      `level ${signed(report.level, 1)} → **${signed(report.level + change, 1)}** (${signed(change, 1)}).`,
    '',
    'Each band in dB against the part as a whole; phone: how much quieter it is with nothing below ' +
      `${ANALYSIS.PHONE_CUT} Hz.`,
    '',
    `| part | bars | rms dB | peak dB | ${REPORT_BANDS.map((b) => b.name).join(' | ')} | phone dB |`,
    `| --- | --- | --- | --- | ${REPORT_BANDS.map(() => '---').join(' | ')} | --- |`,
    ...parts.map(
      (p) =>
        `| ${p.name} · ${p.tier} | ${p.bar + 1}–${p.bar + p.bars} | ${p.rms.toFixed(1)} | ${p.peak.toFixed(1)} | ` +
        `${p.bands.map((band) => band.toFixed(0)).join(' | ')} | ${signed(-p.phoneLoss)} |`,
    ),
    '',
    '## Dynamics',
    '',
    `Against the grooves (${dyn.groove.toFixed(1)} dB): peaks ${signed(dyn.peakLift)} dB ` +
      `(${ANALYSIS.PEAK_LIFT.join('–')} wanted: ${verdict(dyn.peakLift, ANALYSIS.PEAK_LIFT)}), ` +
      `calm parts ${signed(-dyn.calmDrop)} dB (${ANALYSIS.CALM_DROP.join('–')} quieter wanted: ` +
      `${verdict(dyn.calmDrop, ANALYSIS.CALM_DROP)}); peaks ${signed(dyn.peakBrightening)} dB ` +
      'brighter in the presence band.',
    '',
    `## Paddle hits over ${report.hitPart}, the loudest part`,
    '',
    `How far each hit stands above the music in its first ${ANALYSIS.HIT_WINDOW * 1000} ms, median ` +
      `of ${hits[0]?.margins.length ?? 0} hits: where it stands out most (heard from ` +
      `${signed(ANALYSIS.HIT_AUDIBLE_DB, 0)} dB), and in ${ANALYSIS.HIT_BAND[0] / 1000}–` +
      `${ANALYSIS.HIT_BAND[1] / 1000} kHz, where docs/AUDIO.md puts the hits.`,
    '',
    '| hit | best dB | at Hz | worst best dB | heard | in 1–4 kHz dB |',
    '| --- | --- | --- | --- | --- | --- |',
    ...hits.map(({ kind, margins }) => {
      const best = margins.map((m) => m.best);
      const worst = Math.min(...best);
      const heard =
        worst >= ANALYSIS.HIT_AUDIBLE_DB
          ? 'yes'
          : median(best) >= ANALYSIS.HIT_AUDIBLE_DB
            ? 'mostly'
            : 'NO';
      const hz = Math.round(median(margins.map((m) => m.bestHz)));
      return `| ${kind} | ${signed(median(best))} | ${hz} | ${signed(worst)} | ${heard} | ${signed(median(margins.map((m) => m.inBand)))} |`;
    }),
    ...(report.hitResidual > ANALYSIS.RESIDUAL_DB
      ? [
          '',
          `**The renders with and without hits differ by ${report.hitResidual.toFixed(0)} dB against the music before the first hit: the margins are unreliable.**`,
        ]
      : []),
    '',
    '## Melody and arpeggio',
    '',
    'Pitch centres of each alone, and how much their spectra overlap (high: the ear may hear one line).',
    '',
    '| part | melody Hz | arpeggio Hz | overlap |',
    '| --- | --- | --- | --- |',
    ...parts.map(
      (p) =>
        `| ${p.name} | ${p.leadHz ? Math.round(p.leadHz) : '—'} | ${p.arpHz ? Math.round(p.arpHz) : '—'} | ` +
        `${p.leadHz && p.arpHz ? percent(p.leadArpOverlap) : '—'} |`,
    ),
    '',
    '## Texture',
    '',
    `Novelty by bar: ${report.novelty.map((value) => Math.round(value * 100)).join(' ')}.`,
    `Changes on bars: ${report.changes.map((bar) => bar + 1).join(', ') || 'none'}.`,
    `Longest stretch without a change: **${report.still.length} bars** ` +
      `(bars ${report.still.from + 1}–${report.still.from + report.still.length}).`,
    '',
    '## Match moments',
    '',
    `Each over the groove: its level every ${ANALYSIS.LEVEL_STEP} s (dBFS), the steepest ` +
      'jump after it against the music’s own before it (×; above ' +
      `${ANALYSIS.JUMP_SUSPECT} may be a click: listen), the longest stretch below ` +
      `${ANALYSIS.SILENCE_FLOOR} dBFS after it.`,
    '',
    '| moment | events | jump | gap s | levels |',
    '| --- | --- | --- | --- | --- |',
    ...report.moments.map(
      (m) =>
        `| ${m.name} | ${m.events} | ${m.jump.ratio >= ANALYSIS.JUMP_SUSPECT ? '**' : ''}` +
        `×${m.jump.ratio.toFixed(1)} at ${m.jump.at.toFixed(2)} s` +
        `${m.jump.ratio >= ANALYSIS.JUMP_SUSPECT ? '**' : ''} | ${m.gap.toFixed(2)} | ` +
        `${m.levels.join(' ')} |`,
    ),
    '',
    '## Melody notes',
    '',
    '| part | notes per bar | quick | held |',
    '| --- | --- | --- | --- |',
    ...parts
      .filter((p) => p.melody)
      .map(
        (p) =>
          `| ${p.name} | ${p.melody!.perBar.join(' ')} | ${percent(p.melody!.quick)} | ${percent(p.melody!.held)} |`,
      ),
    '',
  ];
  return lines.join('\n');
}
