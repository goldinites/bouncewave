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
  /** The highest rate it is rendered at (`RENDER_RATE`); the device's if left out. */
  maxRate?: number;
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
  /** The highest rate it is rendered at (`RENDER_RATE`); the device's if left out. */
  maxRate?: number;
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

/**
 * Rates a sound may be rendered at below the device's, in Hz: a sound holds nothing above half
 * its rate, so one with no highs — a bass, a pad, a warm lead, a low drum — renders at a third or
 * half of 48 kHz and takes as much less memory, sounding the same. Bright sounds (cymbals, hats,
 * the snare, the DX7's tine) keep the device's rate.
 */
export const RENDER_RATE = { LOW: 16000, MID: 24000, HIGH: 32000 } as const;

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

/**
 * Lets the main thread draw a frame and take input before going on: building a sound's graph is
 * done there, and a song's dozens built in one go held it for a tenth of a second, a stutter in
 * the middle of a match (ROADMAP 7.2f). The renders themselves run on the audio thread meanwhile.
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/**
 * `start` for each of `items` in a task of its own, the main thread let go between them, all of
 * them under way together; resolves with their results in order.
 */
async function inTurns<T, R>(items: readonly T[], start: (item: T) => Promise<R>): Promise<R[]> {
  const started: Promise<R>[] = [];
  for (const item of items) {
    await yieldToMain();
    const job = start(item);
    // One failing while the rest are still being started is reported by Promise.all below, not
    // as an unhandled rejection meanwhile
    job.catch(() => {});
    started.push(job);
  }
  return Promise.all(started);
}

/**
 * Offline renders under way at once. A song's seventy-odd takes all rendering together finished
 * together, and the browser handed their buffers to the main thread back to back: the more sounds
 * a song has, the longer the page went without a frame (Neon Cathedral ~5 ms past the timer's own
 * lateness here, ~90 on a CI runner). Eight at a time hold it at that lateness, the song's render
 * taking about as long as before.
 */
const MAX_RENDERS = 8;

let rendering = 0;
const waiting: (() => void)[] = [];

/** Runs `job` once fewer than `MAX_RENDERS` are under way, in a task of its own. */
async function inSlot<T>(job: () => Promise<T>): Promise<T> {
  if (rendering >= MAX_RENDERS) await new Promise<void>((resolve) => waiting.push(resolve));
  else rendering++;
  try {
    // The slot was handed over from a finished job's task: this one is built in its own
    await yieldToMain();
    return await job();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else rendering--;
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
  /** What renders asked for from now on wait for: the sounds that must come first. */
  private gate: Promise<unknown> = Promise.resolve();

  /**
   * Renders the sounds that must come first (the action sounds: the first hit comes within
   * seconds, a song's instruments have their live synths meanwhile); renders asked for from now
   * on start once they are done. Both kinds are asked for here, before the gate closes: one asked
   * for after it, chained on the other, waited for itself, and nothing was ever rendered again.
   */
  public renderFirst(
    rate: number,
    sounds: Record<string, SampleRecipe>,
    pitched: Record<string, PitchedRecipe>,
  ): Promise<void> {
    const first = Promise.all([this.render(rate, sounds), this.renderPitched(rate, pitched)]);
    this.gate = first.catch(() => {});
    return first.then(() => {});
  }

  /** Renders every recipe not rendered yet; resolves when they all are. */
  public async render(rate: number, recipes: Record<string, SampleRecipe>): Promise<void> {
    const Offline = offlineContextClass();
    if (!Offline) return;
    const pending = this.claim(recipes);
    // Nothing new to render: the time it took stays as it was
    if (pending.length === 0) return;
    await this.gate;

    // Each take built in a task of its own, up to `MAX_RENDERS` rendering together
    await inTurns(pending, ([id, recipe]) => this.renderSound(rate, Offline, id, recipe)).catch(
      () => {
        // A sound that failed to render stays on its live synth
      },
    );
    this.finished();
  }

  /** Renders one sound, every variant of it, into the bank. */
  private async renderSound(
    rate: number,
    Offline: OfflineContextClass,
    id: string,
    recipe: SampleRecipe,
  ): Promise<void> {
    const takes = Array.from({ length: recipe.variants }, (_, variant) => variant);
    const variants = await inTurns(takes, (variant) =>
      inSlot(async () => {
        const at = Math.min(rate, recipe.maxRate ?? rate);
        const ctx = new Offline(1, Math.ceil(recipe.duration * at), at);
        recipe.build(ctx, seededRandom(hash(`${id}:${variant}`)));
        const buffer = await renderOffline(ctx);
        // Renders finishing together would be scaled all in one go
        await yieldToMain();
        if (recipe.reverse) {
          for (let c = 0; c < buffer.numberOfChannels; c++) buffer.getChannelData(c).reverse();
        }
        normalise(buffer, recipe.level ?? 0);
        return buffer;
      }),
    );
    this.buffers.set(id, variants);
  }

  /** Renders every pitched instrument not rendered yet, root by root. */
  public async renderPitched(rate: number, recipes: Record<string, PitchedRecipe>): Promise<void> {
    const Offline = offlineContextClass();
    if (!Offline) return;
    const pending = this.claim(recipes);
    // Nothing new to render: the time it took stays as it was
    if (pending.length === 0) return;
    await this.gate;

    // Each root built in a task of its own, up to `MAX_RENDERS` rendering together
    await inTurns(pending, ([id, recipe]) =>
      this.renderInstrument(rate, Offline, id, recipe),
    ).catch(() => {
      // An instrument that failed to render stays on its live synth
    });
    this.finished();
  }

  /** Renders one pitched instrument, root by root, into the bank. */
  private async renderInstrument(
    rate: number,
    Offline: OfflineContextClass,
    id: string,
    recipe: PitchedRecipe,
  ): Promise<void> {
    const roots = await inTurns(recipe.roots, (root) =>
      inSlot(async (): Promise<RenderedRoot> => {
        const loop = recipe.loop;
        const tune = loop
          ? (hz: number) => Math.max(1, Math.round(hz * loop.length)) / loop.length
          : (hz: number) => hz;
        const frequency = tune(midiToFrequency(root));
        const at = Math.min(rate, recipe.maxRate ?? rate);
        const ctx = new Offline(recipe.channels ?? 1, Math.ceil(recipe.duration * at), at);
        recipe.build(ctx, seededRandom(hash(`${id}:${root}`)), frequency, tune);
        const buffer = await renderOffline(ctx);
        // Renders finishing together would be scaled all in one go
        await yieldToMain();
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

  /** Every sound starts again from its first variant: renders that must match play the same takes. */
  public rewind(): void {
    this.turns.clear();
  }

  /**
   * Frees rendered sounds, so a sound no song in play needs takes no memory; asked for again, it
   * is rendered again. A note already playing keeps its buffer until it ends.
   */
  public release(ids: Iterable<string>): void {
    for (const id of ids) {
      this.buffers.delete(id);
      this.roots.delete(id);
      this.turns.delete(id);
      this.requested.delete(id);
    }
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
