import { midiToFrequency } from '@/shared/math';
import { seededRandom } from '@/shared/random';

/**
 * How one sound is made: a graph built in an offline context and rendered once, as many times as
 * it has variants, each with its own seeded randomness (its noise, a touch of pitch and decay),
 * so hits played in a row never sound like one recording looped.
 */
export interface SampleRecipe {
  /** Seconds rendered; the sound must have died away by then. */
  duration: number;
  variants: number;
  /** dB the rendered sound is set to after its peak is normalised to full scale. */
  level?: number;
  /** Played backwards once rendered: a crash becomes a swell into the hit. */
  reverse?: boolean;
  /**
   * How the sound moves: one that dies away (a hit), or one that swells toward its end and stops
   * there (a riser), which is played so its end lands on a downbeat. Dying away by default.
   */
  shape?: 'decay' | 'swell';
  /** Builds the sound into `ctx.destination`; `random` is seeded per variant. */
  build: (ctx: OfflineAudioContext, random: () => number) => void;
}

/**
 * How a pitched instrument is made: rendered at a few root notes (multisampling), each note then
 * played from the nearest root, sped up or slowed to its pitch — never more than a few semitones,
 * so the timbre holds. A sustained sound also loops: past `loop.start` it repeats every
 * `loop.length` seconds, as long as the note is held. For the join to be seamless, every
 * oscillator runs a whole number of cycles per loop: `build` passes each frequency through `tune`,
 * which rounds it to that grid (the pitch error this leaves is corrected by the playback rate).
 */
export interface PitchedRecipe {
  /** MIDI notes rendered. */
  roots: number[];
  /** Seconds rendered: a sustained sound renders a little past its loop's end. */
  duration: number;
  channels?: 1 | 2;
  /** Where a sustained sound loops, in seconds; none for one that dies away. */
  loop?: { start: number; length: number };
  level?: number;
  /**
   * Builds the note into `ctx.destination` at `frequency` (already tuned), every other
   * oscillator's frequency passed through `tune`; `random` is seeded per root.
   */
  build: (
    ctx: OfflineAudioContext,
    random: () => number,
    frequency: number,
    tune: (hz: number) => number,
  ) => void;
}

/** One rendered root of a pitched instrument. */
interface RenderedRoot {
  root: number;
  buffer: AudioBuffer;
  /** The frequency it actually sounds at, after tuning to its loop. */
  frequency: number;
  loop: { start: number; end: number } | null;
}

/** A note ready to play: the root's buffer, how fast to play it, and where it loops. */
export interface PitchedNote {
  buffer: AudioBuffer;
  rate: number;
  loop: { start: number; end: number } | null;
}

type OfflineContextClass = new (
  channels: number,
  length: number,
  rate: number,
) => OfflineAudioContext;

/** The offline context of this browser, the old prefixed Safari one included; null if none. */
function offlineContextClass(): OfflineContextClass | null {
  if (typeof window === 'undefined') return null;
  const prefixed = window as unknown as { webkitOfflineAudioContext?: OfflineContextClass };
  return window.OfflineAudioContext ?? prefixed.webkitOfflineAudioContext ?? null;
}

/** Renders the offline context, also where startRendering doesn't return a promise (old Safari). */
function renderOffline(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    ctx.oncomplete = (event) => resolve(event.renderedBuffer);
    const rendering = ctx.startRendering() as Promise<AudioBuffer> | undefined;
    rendering?.then(resolve, reject);
  });
}

/** The buffer scaled so its loudest sample sits at `level` dB below full scale. */
function normalise(buffer: AudioBuffer, level: number): void {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    for (const sample of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0) return;
  const scale = 10 ** (level / 20) / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= scale;
  }
}

/** A string's hash, so each sound's variants have seeds of their own. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The sounds the instruments play, rendered from code once (docs/AUDIO.md, "Технология"): each
 * id holds its variants, handed out in turn. Until a sound is rendered — or where the browser
 * can't render offline — `pick` returns null and the instrument plays its live synth instead.
 */
export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer[]>();
  private readonly turns = new Map<string, number>();
  private readonly roots = new Map<string, RenderedRoot[]>();
  private readonly requested = new Set<string>();
  /** When the first render started, so `renderTime` counts until everything was ready. */
  private firstStarted: number | null = null;
  /** Milliseconds from the first render's start to the last one's end, for the listening stand. */
  public renderTime = 0;

  /** Renders every recipe not rendered yet; resolves when they all are. */
  public async render(rate: number, recipes: Record<string, SampleRecipe>): Promise<void> {
    const Offline = offlineContextClass();
    if (!Offline) return;
    const pending = this.claim(recipes);

    await Promise.all(
      pending.map(async ([id, recipe]) => {
        const variants = await Promise.all(
          Array.from({ length: recipe.variants }, async (_, variant) => {
            const ctx = new Offline(1, Math.ceil(recipe.duration * rate), rate);
            recipe.build(ctx, seededRandom(hash(`${id}:${variant}`)));
            const buffer = await renderOffline(ctx);
            if (recipe.reverse) {
              for (let c = 0; c < buffer.numberOfChannels; c++) buffer.getChannelData(c).reverse();
            }
            normalise(buffer, recipe.level ?? 0);
            return buffer;
          }),
        );
        this.buffers.set(id, variants);
      }),
    ).catch(() => {
      // A sound that failed to render stays on its live synth
    });
    this.finished();
  }

  /** Renders every pitched instrument not rendered yet, root by root. */
  public async renderPitched(rate: number, recipes: Record<string, PitchedRecipe>): Promise<void> {
    const Offline = offlineContextClass();
    if (!Offline) return;
    const pending = this.claim(recipes);

    await Promise.all(
      pending.map(async ([id, recipe]) => {
        const roots = await Promise.all(
          recipe.roots.map(async (root): Promise<RenderedRoot> => {
            const loop = recipe.loop;
            const tune = loop
              ? (hz: number) => Math.max(1, Math.round(hz * loop.length)) / loop.length
              : (hz: number) => hz;
            const frequency = tune(midiToFrequency(root));
            const ctx = new Offline(recipe.channels ?? 1, Math.ceil(recipe.duration * rate), rate);
            recipe.build(ctx, seededRandom(hash(`${id}:${root}`)), frequency, tune);
            const buffer = await renderOffline(ctx);
            normalise(buffer, recipe.level ?? 0);
            return {
              root,
              buffer,
              frequency,
              loop: loop ? { start: loop.start, end: loop.start + loop.length } : null,
            };
          }),
        );
        this.roots.set(id, roots);
      }),
    ).catch(() => {
      // An instrument that failed to render stays on its live synth
    });
    this.finished();
  }

  /**
   * The note `midi` on a pitched instrument: its nearest root and the rate that brings it to the
   * note's pitch; null if the instrument isn't rendered.
   */
  public pickNote(id: string, midi: number): PitchedNote | null {
    const roots = this.roots.get(id);
    if (!roots?.length) return null;
    let nearest = roots[0];
    for (const candidate of roots) {
      if (Math.abs(candidate.root - midi) < Math.abs(nearest.root - midi)) nearest = candidate;
    }
    return {
      buffer: nearest.buffer,
      rate: midiToFrequency(midi) / nearest.frequency,
      loop: nearest.loop,
    };
  }

  /** The recipes no render has taken on yet, now taken. */
  private claim<T>(recipes: Record<string, T>): [string, T][] {
    this.firstStarted ??= performance.now();
    const pending = Object.entries(recipes).filter(([id]) => !this.requested.has(id));
    pending.forEach(([id]) => this.requested.add(id));
    return pending;
  }

  private finished(): void {
    this.renderTime = performance.now() - (this.firstStarted ?? performance.now());
  }

  /** The next variant of the sound, or null if it isn't rendered. */
  public pick(id: string): AudioBuffer | null {
    const variants = this.buffers.get(id);
    if (!variants?.length) return null;
    const turn = this.turns.get(id) ?? 0;
    this.turns.set(id, turn + 1);
    return variants[turn % variants.length];
  }

  /** The ids rendered so far. */
  public get ids(): string[] {
    return [...this.buffers.keys(), ...this.roots.keys()];
  }

  /** Memory the rendered sounds take, in bytes (32-bit float samples). */
  public get bytes(): number {
    let total = 0;
    for (const variants of this.buffers.values()) {
      for (const buffer of variants) total += buffer.length * buffer.numberOfChannels * 4;
    }
    for (const roots of this.roots.values()) {
      for (const { buffer } of roots) total += buffer.length * buffer.numberOfChannels * 4;
    }
    return total;
  }
}
