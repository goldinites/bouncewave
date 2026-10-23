/*
 * The track render's page (served by the dev server, never built; `npm run render`,
 * scripts/render.mjs): plays a song's whole form into an offline audio context through the
 * game's own mixer — faster than real time, silently, every bar as the stand's "whole form"
 * plays it — and turns it into pictures and numbers (analysis.ts).
 *
 * The script calls `window.renderSong({ song, lead, mute })`, which resolves to the report and
 * the pictures as PNG data URLs.
 */

// A fixed seed for the music's humanizing, reset before each render, so a render with paddle
// hits and one without them differ only by the hits. Set before the audio is imported
let seed = 0x5eed;
const reseed = () => (seed = 0x5eed);
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const { K_WEIGHTING, Mixer } = await import('@/audio/Mixer');
const { WHOLE_FORM } = await import('@/audio/music/Conductor');
const { MusicEngine } = await import('@/audio/music/MusicEngine');
const { soundsFor } = await import('@/audio/music/palette');
const { STEPS_PER_BAR } = await import('@/audio/music/score');
const { SONGS } = await import('@/audio/music/songs');
const { DRUM_SAMPLES } = await import('@/audio/samples/drums');
const { PITCHED_SAMPLES } = await import('@/audio/samples/pitched');
const { SampleBank } = await import('@/audio/samples/SampleBank');
const { TRANSITION_SAMPLES } = await import('@/audio/samples/transitions');
const { SoundEffects } = await import('@/audio/sfx/SoundEffects');
const analysis = await import('./analysis');
const { ANALYSIS, REPORT_BANDS } = analysis;

type LeadVoice = import('@/audio/music/score').LeadVoice;
type MusicLayer = import('@/audio/music/score').MusicLayer;
type Song = import('@/audio/music/score').Song;
type Tier = import('@/audio/music/score').Tier;

const RATE = 48000;
// Each part played at the heat its tier has in a match (audio/music/intensity.ts): calm in the
// menus and between points, the groove in an ordinary rally, the build and the peak in a hot one
// with the climax building, so a peak is heard against a verse as a player hears it
const PLAYED_AT: Record<Tier, { intensity: number; climax: number }> = {
  calm: { intensity: 0.35, climax: 0 },
  groove: { intensity: 0.6, climax: 0 },
  rise: { intensity: 0.8, climax: 0.5 },
  high: { intensity: 1, climax: 1 },
};
// s before a part starts that its heat is set: the scheduler plans steps 0.15 s ahead
const HEAT_LEAD = 0.2;
const START_DELAY = 0.1; // s: the music engine's own delay before its first step
const TAIL = 2; // s rendered past the form, for the last reverb
const TICK = 0.05; // s of audio between the scheduler's ticks (it looks 0.15 s ahead)
const HIT_STEP = 4; // the step of each bar a test hit lands on: the second beat
const HIT_KINDS = ['player', 'cpu', 'perfect'] as const;
const HIT_BARS = 13; // at least: a hit of each kind on four bars

// The pictures: a bar's width, the spectrum's height and range, the similarity's cell
const PICTURE = {
  BAR_PX: 12,
  AXIS_PX: 44, // left, for the frequencies
  HEADER_PX: 18, // top, for the parts
  ROWS: 360,
  LOW_HZ: 30,
  HIGH_HZ: 16000,
  RANGE_DB: 80, // below the loudest cell, black
  CELL_PX: 6,
  FONT: '11px monospace',
} as const;
const GRID_HZ = [50, 100, ANALYSIS.PHONE_CUT, 300, 1000, 3000, 10000];

export interface RenderOptions {
  song: string;
  lead?: LeadVoice;
  mute?: MusicLayer[];
}

interface MusicRender {
  song: Song;
  /** Either the whole form or one section, by name. */
  part: string;
  seconds: number;
  mute?: MusicLayer[];
  lead?: LeadVoice;
  /** Paddle hits played at these times, s, of these kinds. */
  hits?: { at: number; kind: (typeof HIT_KINDS)[number]; rally: number }[];
}

declare global {
  interface Window {
    renderSong?: typeof renderSong;
  }
}

const bank = new SampleBank();
await bank.render(RATE, DRUM_SAMPLES);
await bank.renderPitched(RATE, PITCHED_SAMPLES);
await bank.render(RATE, TRANSITION_SAMPLES);

const barSeconds = (song: Song) => (60 / song.bpm / 4) * STEPS_PER_BAR;

/** The song, or a part of it, rendered through the game's mixer: the master's output. */
async function renderMusic({ song, part, seconds, mute = [], lead, hits = [] }: MusicRender) {
  const { pitched, oneShots } = soundsFor(song, lead ? { lead } : {});
  await bank.renderPitched(RATE, pitched);
  await bank.render(RATE, oneShots);
  reseed();
  bank.rewind();

  const context = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  // The game's audio is written for a live context; an offline one has all it uses
  const ac = context as unknown as AudioContext;
  const mixer = new Mixer(ac);
  const music = new MusicEngine();
  for (const layer of mute) music.setLayerMuted(layer, true);
  if (lead) music.setLeadVoice(lead);
  // The heat of each part, from just before it starts
  const heats =
    part === WHOLE_FORM
      ? partsOf(song).map(({ section, start }) => ({ at: start - HEAT_LEAD, tier: section.tier }))
      : [{ at: 0, tier: song.sections.find((s) => s.name === part)!.tier }];
  const heat = (tier: Tier) => {
    music.pinIntensity(PLAYED_AT[tier].intensity);
    music.pinClimax(PLAYED_AT[tier].climax);
  };
  heat(heats[0].tier);
  // Before init, so the engine prepares this song's sounds and room, not one picked at random
  music.audition(song.id, part);
  music.init(ac, mixer.music, bank, 'manual');
  // The room is built off a timer, out of the scheduler's tick
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sfx = new SoundEffects(
    () => ac,
    () => false,
    () => true,
    () => music.getHarmony(),
    () => mixer,
  );

  // Every action at its render quantum (128 frames), where the context can be suspended
  const actions = new Map<number, (() => void)[]>();
  const at = (time: number, action: () => void) => {
    const frame = Math.round((time * RATE) / 128) * 128;
    if (frame <= 0 || frame >= context.length) return;
    actions.set(frame, [...(actions.get(frame) ?? []), action]);
  };
  for (const { at: time, tier } of heats.slice(1)) at(time, () => heat(tier));
  for (let time = TICK; time < seconds; time += TICK) at(time, () => music.tick());
  for (const hit of hits) {
    at(hit.at, () =>
      sfx.playPaddleHit(hit.rally, hit.kind === 'perfect', hit.kind === 'cpu' ? 1 : 0),
    );
  }
  for (const [frame, run] of actions) {
    void context.suspend(frame / RATE).then(() => {
      for (const action of run) action();
      void context.resume();
    });
  }
  music.tick();
  const buffer = await context.startRendering();
  music.dispose();
  return [buffer.getChannelData(0), buffer.getChannelData(1)];
}

/** The mono mix through the meter's K-weighting, as the stand reads loudness. */
async function kWeighted(mono: Float32Array<ArrayBuffer>): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, mono.length, RATE);
  const buffer = context.createBuffer(1, mono.length, RATE);
  buffer.copyToChannel(mono, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const lowCut = context.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = K_WEIGHTING.LOW_CUT;
  lowCut.Q.value = 0.5;
  const presence = context.createBiquadFilter();
  presence.type = 'highshelf';
  presence.frequency.value = K_WEIGHTING.SHELF_FREQUENCY;
  presence.gain.value = K_WEIGHTING.SHELF_GAIN;
  source.connect(lowCut).connect(presence).connect(context.destination);
  source.start();
  return (await context.startRendering()).getChannelData(0);
}

/** The form's parts in order, each with its first bar and time. */
function partsOf(song: Song) {
  let bar = 0;
  return song.form.map((index) => {
    const section = song.sections[index];
    const part = { section, bar, start: START_DELAY + bar * barSeconds(song) };
    bar += section.bars;
    return part;
  });
}

const frameAt = (seconds: number) => Math.round((seconds * RATE) / ANALYSIS.HOP);

/** A canvas of the given size, black, in the pictures' font. */
function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.font = PICTURE.FONT;
  ctx.textBaseline = 'top';
  return { element, ctx };
}

// Black through purple and orange to pale yellow, like magma: quiet to loud
const HEAT: [number, number, number][] = [
  [0, 0, 4],
  [80, 18, 123],
  [183, 55, 121],
  [252, 137, 97],
  [252, 253, 191],
];
function heat(level: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, level)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  const t = x - i;
  return HEAT[i].map((c, k) => Math.round(c + (HEAT[i + 1][k] - c) * t)) as [
    number,
    number,
    number,
  ];
}

/**
 * Spectrum pictures on one time axis, a bar `BAR_PX` wide: each layer's frames (rows of power
 * from low to high) to a colour of its own, or to the heat scale if there is one layer. Parts are
 * marked along the top, frequencies down the side, the phone's cut in red.
 */
function spectrumPicture(
  song: Song,
  layers: { frames: number[][]; tint?: [number, number, number] }[],
) {
  const parts = partsOf(song);
  const bars = parts.reduce((sum, part) => sum + part.section.bars, 0);
  const width = PICTURE.AXIS_PX + bars * PICTURE.BAR_PX;
  const height = PICTURE.HEADER_PX + PICTURE.ROWS;
  const { element, ctx } = canvas(width, height);
  const image = ctx.createImageData(bars * PICTURE.BAR_PX, PICTURE.ROWS);
  const columnFrames = (x: number) => {
    const bar = x / PICTURE.BAR_PX;
    const from = frameAt(START_DELAY + bar * barSeconds(song));
    const to = Math.max(
      from + 1,
      frameAt(START_DELAY + (bar + 1 / PICTURE.BAR_PX) * barSeconds(song)),
    );
    return [from, to];
  };
  for (const { frames, tint } of layers) {
    const columns = Array.from({ length: image.width }, (_, x) => {
      const [from, to] = columnFrames(x);
      return analysis.sumFrames(frames, from, to).map((power) => power / (to - from));
    });
    let top: number = ANALYSIS.SILENCE_DB;
    for (const rows of columns) for (const power of rows) top = Math.max(top, analysis.db(power));
    columns.forEach((rows, x) => {
      rows.forEach((power, row) => {
        const level = (analysis.db(power) - top + PICTURE.RANGE_DB) / PICTURE.RANGE_DB;
        const color: number[] = tint ? tint.map((c) => c * Math.max(0, level) ** 1.5) : heat(level);
        const i = ((PICTURE.ROWS - 1 - row) * image.width + x) * 4;
        for (let k = 0; k < 3; k++) image.data[i + k] = Math.min(255, image.data[i + k] + color[k]);
        image.data[i + 3] = 255;
      });
    });
  }
  ctx.putImageData(image, PICTURE.AXIS_PX, PICTURE.HEADER_PX);

  const yOf = (hz: number) =>
    PICTURE.HEADER_PX +
    PICTURE.ROWS * (1 - Math.log(hz / PICTURE.LOW_HZ) / Math.log(PICTURE.HIGH_HZ / PICTURE.LOW_HZ));
  for (const hz of GRID_HZ) {
    const y = Math.round(yOf(hz)) + 0.5;
    const isPhone = hz === ANALYSIS.PHONE_CUT;
    ctx.strokeStyle = isPhone ? 'rgba(255,60,60,0.8)' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(PICTURE.AXIS_PX - 4, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.fillStyle = isPhone ? '#f66' : '#aaa';
    ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, 2, y - 6);
  }
  for (const part of parts) {
    const x = PICTURE.AXIS_PX + part.bar * PICTURE.BAR_PX + 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(`${part.section.name} ${part.bar + 1}`, x + 3, 3);
  }
  return element.toDataURL('image/png');
}

/** The bars' similarity, a cell each, bright where alike, the parts marked on both axes. */
function similarityPicture(song: Song, similarity: number[][]) {
  const n = similarity.length;
  const margin = PICTURE.HEADER_PX;
  const size = n * PICTURE.CELL_PX;
  const { element, ctx } = canvas(margin + size, margin + size);
  similarity.forEach((row, i) =>
    row.forEach((value, j) => {
      const level = Math.round(255 * Math.max(0, value));
      ctx.fillStyle = `rgb(${level},${level},${level})`;
      ctx.fillRect(
        margin + j * PICTURE.CELL_PX,
        margin + i * PICTURE.CELL_PX,
        PICTURE.CELL_PX,
        PICTURE.CELL_PX,
      );
    }),
  );
  ctx.strokeStyle = 'rgba(255,80,200,0.8)';
  for (const part of partsOf(song)) {
    const at = margin + part.bar * PICTURE.CELL_PX + 0.5;
    ctx.beginPath();
    ctx.moveTo(at, margin);
    ctx.lineTo(at, margin + size);
    ctx.moveTo(margin, at);
    ctx.lineTo(margin + size, at);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(part.section.name.slice(0, 6), at + 2, 3);
  }
  return element.toDataURL('image/png');
}

async function renderSong({ song: id, lead, mute = [] }: RenderOptions) {
  const song = SONGS.find((s) => s.id === id);
  if (!song) throw new Error(`No song called ${id}`);
  const startedAt = performance.now();
  const parts = partsOf(song);
  const bars = parts.reduce((sum, part) => sum + part.section.bars, 0);
  const seconds = START_DELAY + bars * barSeconds(song) + TAIL;
  const whole = { song, part: WHOLE_FORM, seconds, lead };
  const others = (keep: MusicLayer) =>
    (['drums', 'bass', 'pads', 'arp', 'lead', 'counter', 'fx'] as MusicLayer[]).filter(
      (l) => l !== keep,
    );

  const mix = await renderMusic({ ...whole, mute });
  const leadAlone = await renderMusic({ ...whole, mute: others('lead') });
  const arpAlone = await renderMusic({ ...whole, mute: others('arp') });

  const pictureEdges = analysis.logEdges(PICTURE.LOW_HZ, PICTURE.HIGH_HZ, PICTURE.ROWS);
  const shapeEdges = analysis.logEdges(40, PICTURE.HIGH_HZ, 24);
  const reportEdges = [...REPORT_BANDS.map((b) => b.low), REPORT_BANDS.at(-1)!.high];
  const mono = analysis.toMono(mix);
  const [pictureFrames, shapeFrames, reportFrames] = analysis.spectrogram(mono, RATE, [
    pictureEdges,
    shapeEdges,
    reportEdges,
  ]);
  const [leadPicture, leadShapes] = analysis.spectrogram(analysis.toMono(leadAlone), RATE, [
    pictureEdges,
    shapeEdges,
  ]);
  const [arpPicture, arpShapes] = analysis.spectrogram(analysis.toMono(arpAlone), RATE, [
    pictureEdges,
    shapeEdges,
  ]);
  const weighted = await kWeighted(mono);

  const partReports = parts.map(({ section, bar, start }) => {
    const end = start + section.bars * barSeconds(song);
    const [from, to] = [start, end].map((t) => Math.round(t * RATE));
    const [frameFrom, frameTo] = [frameAt(start), frameAt(end)];
    const bands = analysis.sumFrames(reportFrames, frameFrom, frameTo);
    const total = bands.reduce((sum, value) => sum + value, 0);
    const abovePhone = bands.slice(2).reduce((sum, value) => sum + value, 0);
    const leadBands = analysis.sumFrames(leadShapes, frameFrom, frameTo);
    const arpBands = analysis.sumFrames(arpShapes, frameFrom, frameTo);
    return {
      name: section.name,
      tier: section.tier,
      bar,
      bars: section.bars,
      rms: analysis.levels(weighted, from, to).rms,
      peak: Math.max(...mix.map((channel) => analysis.levels(channel, from, to).peak)),
      bands: bands.map((value) => analysis.db(value) - analysis.db(total)),
      phoneLoss: analysis.db(total) - analysis.db(abovePhone),
      leadHz: analysis.centroidHz(leadBands, shapeEdges),
      arpHz: analysis.centroidHz(arpBands, shapeEdges),
      leadArpOverlap: analysis.overlap(leadBands, arpBands),
      melody: analysis.melodyStats(section),
    };
  });
  const rallyParts = partReports.filter((p) => p.tier === 'groove' || p.tier === 'high');
  const loudness =
    (rallyParts.length ? rallyParts : partReports).reduce((sum, p) => sum + p.rms, 0) /
    Math.max(1, (rallyParts.length ? rallyParts : partReports).length);

  // The hits over the loudest part, played alone from its start: rendered without and with them
  const loudest = partReports.reduce((a, b) => (b.rms > a.rms ? b : a));
  const section = song.sections.find((s) => s.name === loudest.name)!;
  // A short part loops, so there are hits enough to judge by
  const hitBars = Math.max(section.bars, HIT_BARS);
  const hitSeconds = START_DELAY + hitBars * barSeconds(song) + 0.5;
  const hits = Array.from({ length: hitBars - 1 }, (_, i) => ({
    at: START_DELAY + (i + 1) * barSeconds(song) + (HIT_STEP / STEPS_PER_BAR) * barSeconds(song),
    kind: HIT_KINDS[i % HIT_KINDS.length],
    rally: i + 1,
  }));
  const partMusic = { song, part: section.name, seconds: hitSeconds, lead, mute };
  const without = analysis.toMono(await renderMusic(partMusic));
  const withHits = analysis.toMono(await renderMusic({ ...partMusic, hits }));
  const beforeHits = Math.round(hits[0].at * RATE);
  const residual = without.subarray(0, beforeHits).map((value, i) => withHits[i] - value);
  const hitReports = HIT_KINDS.map((kind) => ({
    kind,
    margins: hits
      .filter((hit) => hit.kind === kind)
      .map((hit) => analysis.hitMargin(without, withHits, RATE, hit.at)),
  }));

  const barShapes = Array.from({ length: bars }, (_, bar) =>
    analysis.sumFrames(
      shapeFrames,
      frameAt(START_DELAY + bar * barSeconds(song)),
      frameAt(START_DELAY + (bar + 1) * barSeconds(song)),
    ),
  );
  const similarity = analysis.selfSimilarity(barShapes);
  const novelty = analysis.novelty(similarity);
  const changes = analysis.textureChanges(novelty);

  const options = [lead ? `--lead=${lead}` : '', mute.length ? `--mute=${mute.join(',')}` : '']
    .filter(Boolean)
    .join(' ');
  const report: import('./analysis').TrackReport = {
    title: song.title,
    id: song.id,
    bpm: song.bpm,
    level: song.level ?? 0,
    options,
    parts: partReports,
    loudness,
    hitPart: loudest.name,
    hits: hitReports,
    hitResidual: analysis.levels(residual).rms - analysis.levels(without, 0, beforeHits).rms,
    novelty,
    bars,
    changes,
    still: analysis.longestStill(changes, bars),
    renderSeconds: (performance.now() - startedAt) / 1000,
  };
  return {
    report,
    markdown: analysis.formatReport(report),
    images: {
      'spectrogram.png': spectrumPicture(song, [{ frames: pictureFrames }]),
      'lead-arp.png': spectrumPicture(song, [
        { frames: leadPicture, tint: [255, 60, 220] },
        { frames: arpPicture, tint: [40, 230, 255] },
      ]),
      'similarity.png': similarityPicture(song, similarity),
    },
  };
}

window.renderSong = renderSong;
