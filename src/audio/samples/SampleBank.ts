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
  /** Builds the sound into `ctx.destination`; `random` is seeded per variant. */
  build: (ctx: OfflineAudioContext, random: () => number) => void;
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
  private readonly requested = new Set<string>();
  /** Milliseconds the last `render` took, for the listening stand. */
  public renderTime = 0;

  /** Renders every recipe not rendered yet; resolves when they all are. */
  public async render(rate: number, recipes: Record<string, SampleRecipe>): Promise<void> {
    const Offline = offlineContextClass();
    if (!Offline) return;
    const started = performance.now();
    const pending = Object.entries(recipes).filter(([id]) => !this.requested.has(id));
    pending.forEach(([id]) => this.requested.add(id));

    await Promise.all(
      pending.map(async ([id, recipe]) => {
        const variants = await Promise.all(
          Array.from({ length: recipe.variants }, async (_, variant) => {
            const ctx = new Offline(1, Math.ceil(recipe.duration * rate), rate);
            recipe.build(ctx, seededRandom(hash(`${id}:${variant}`)));
            const buffer = await renderOffline(ctx);
            normalise(buffer, recipe.level ?? 0);
            return buffer;
          }),
        );
        this.buffers.set(id, variants);
      }),
    ).catch(() => {
      // A sound that failed to render stays on its live synth
    });
    this.renderTime = performance.now() - started;
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
    return [...this.buffers.keys()];
  }

  /** Memory the rendered sounds take, in bytes (32-bit float samples). */
  public get bytes(): number {
    let total = 0;
    for (const variants of this.buffers.values()) {
      for (const buffer of variants) total += buffer.length * buffer.numberOfChannels * 4;
    }
    return total;
  }
}
