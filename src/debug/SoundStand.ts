import { AudioEngine } from '@/audio/AudioEngine';
import { WHOLE_FORM } from '@/audio/music/Conductor';
import { MusicPosition } from '@/audio/music/MusicEngine';
import { KITS, KitName } from '@/audio/music/kits';
import { VoiceOverrides } from '@/audio/music/palette';
import {
  BassVoice,
  LeadVoice,
  MUSIC_LAYERS,
  MusicLayer,
  PadVoice,
  STEPS_PER_BAR,
  Tier,
} from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { isHitStyle } from '@/audio/samples/actions';
import { SoundEffects } from '@/audio/sfx/SoundEffects';
import { debugHeading } from '@/debug/theme';

const READOUT_MS = 250; // how often the position and latency are redrawn while open
// The player's form strip: each part coloured by its heat
const TIER_COLOURS: Record<Tier, string> = {
  calm: '#3d6bff',
  groove: '#19f0ff',
  rise: '#ffd84d',
  high: '#ff6ad5',
};
const BEATS_PER_BAR = STEPS_PER_BAR / 4;

/** A sound of the game's, or a series of it, as the stand plays it. */
interface StandSound {
  name: string;
  /** Plays the `index`-th sound of the series. */
  play: (sfx: SoundEffects, index: number) => void;
  times?: number;
  /** Seconds between the sounds of a series. */
  every?: number;
}

/** Every action sound, alone and in the series it comes in during a match. */
export const STAND_SOUNDS: readonly StandSound[] = [
  { name: 'hit', play: (sfx) => sfx.playPaddleHit(1, false, 0, { pan: -0.9 }) },
  { name: 'hit hard', play: (sfx) => sfx.playPaddleHit(1, false, 0, { pan: -0.9, force: 1 }) },
  { name: 'hit cpu', play: (sfx) => sfx.playPaddleHit(1, false, 1, { pan: 0.9 }) },
  {
    // From side to side, the ball faster with every hit, as a rally heats up
    name: 'rally ×8',
    play: (sfx, i) =>
      sfx.playPaddleHit(i + 1, false, i % 2, { pan: i % 2 ? 0.9 : -0.9, force: i / 7 }),
    times: 8,
    every: 0.32,
  },
  { name: 'perfect', play: (sfx) => sfx.playPaddleHit(3, true, 0, { pan: -0.9 }) },
  {
    name: 'perfect ×4',
    play: (sfx, i) => sfx.playPaddleHit(i + 1, true, i % 2, { pan: i % 2 ? 0.9 : -0.9 }),
    times: 4,
    every: 0.32,
  },
  { name: 'overdrive', play: (sfx) => sfx.playPowerShot(4) },
  { name: 'od ready', play: (sfx) => sfx.playOverdriveReady() },
  { name: 'wall', play: (sfx) => sfx.playWallBounce() },
  { name: 'arc', play: (sfx) => sfx.playSpin(0.4) },
  { name: 'arc max', play: (sfx) => sfx.playSpin(1) },
  { name: 'analyzer', play: (sfx) => sfx.playScan() },
  { name: 'reflex', play: (sfx) => sfx.playTimeWarp() },
  { name: 'score', play: (sfx) => sfx.playScore() },
  { name: 'heartbeat ×4', play: (sfx) => sfx.playHeartbeat(), times: 4, every: 0.9 },
  { name: 'channel surf', play: (sfx) => sfx.playChannelSurf() },
  { name: 'victory', play: (sfx) => sfx.playVictory() },
  { name: 'defeat', play: (sfx) => sfx.playDefeat() },
  { name: 'fireworks ×6', play: (sfx) => sfx.playFireworkPop(), times: 6, every: 0.25 },
  { name: 'click', play: (sfx) => sfx.playSettingsClick() },
];

/**
 * Developer-only listening stand, shown with the debug overlay (`?debug` or F3): holds the music
 * to a song and one of its parts, pins intensity and the climax, silences layers, and plays every
 * action sound and its series — so music is composed by ear, not blind (docs/AUDIO.md). A
 * player on top pauses, steps between songs, shows where the music is in the song's form and
 * the time, and jumps to any part of the form with a click. The address keeps the song, the
 * part and the silenced layers (`?song=neon-cathedral&part=chorus&mute=drums`), so a link points at
 * a place in a song, and `&lead=sax` puts every melody on another lead; it works without
 * `?debug` too.
 */
export class SoundStand {
  private readonly audio: AudioEngine;
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly songSelect: HTMLSelectElement;
  private readonly partSelect: HTMLSelectElement;
  private readonly readout: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly clock: HTMLElement;
  /** The playing song's form, one segment a step, wide as its bars. */
  private readonly timeline: HTMLElement;
  private timelineSong: string | null = null;
  private readonly layerBoxes = new Map<MusicLayer, HTMLInputElement>();
  private readonly listeners = new AbortController();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readoutTimer: ReturnType<typeof setInterval> | null = null;
  private isVisible = false;
  /** The master's loudness summed since the music last changed place, for an average. */
  private loudness = { power: 0, readings: 0 };

  constructor(audio: AudioEngine) {
    this.audio = audio;

    this.el = document.createElement('section');
    this.el.setAttribute('aria-label', 'Sound stand (debug)');
    // Placed by the debug dock (DebugDock.ts), in its "sound" tab
    Object.assign(this.el.style, { display: 'none', flexDirection: 'column', gap: '6px' });

    this.body = document.createElement('div');
    Object.assign(this.body.style, { display: 'flex', flexDirection: 'column', gap: '6px' });

    this.songSelect = this.select('song', [
      ['', '— the game’s —'],
      ...SONGS.map((song): [string, string] => [
        song.id,
        song.sketch ? `✎ ${song.title}` : song.title,
      ]),
    ]);
    this.partSelect = this.select('part', []);
    this.on(this.songSelect, 'change', () => {
      this.fillParts();
      this.audition();
    });
    this.on(this.partSelect, 'change', () => this.audition());

    const previous = this.button('⏮', () => this.stepSong(-1));
    previous.dataset.player = 'previous';
    this.pauseButton = this.button('⏸', () => this.setPaused(!this.audio.isPaused));
    this.pauseButton.dataset.player = 'pause';
    const next = this.button('⏭', () => this.stepSong(1));
    next.dataset.player = 'next';
    this.clock = document.createElement('span');
    this.clock.className = 'dbg-mono';
    const player = this.row(previous, this.pauseButton, next, this.clock);
    this.timeline = document.createElement('div');
    this.timeline.dataset.stand = 'timeline';
    Object.assign(this.timeline.style, { display: 'flex', gap: '2px', height: '16px' });

    this.readout = document.createElement('div');
    this.readout.className = 'dbg-status dbg-mono';

    this.body.append(
      debugHeading('Player'),
      player,
      this.timeline,
      debugHeading('Music'),
      this.songSelect,
      this.partSelect,
      debugHeading('Heat (ticked: held by the stand)'),
      this.slider('intensity', (level) => this.audio.music.pinIntensity(level)),
      this.slider('climax', (level) => this.audio.music.pinClimax(level)),
      debugHeading('Layers'),
      this.layerRows(),
      debugHeading('Game sounds'),
      this.soundButtons(),
      debugHeading('Status'),
      this.readout,
    );
    this.el.append(this.body);
    document.body.appendChild(this.el);

    this.restoreFromAddress();
  }

  /** The panel's element, for the debug dock to place. */
  public get element(): HTMLElement {
    return this.el;
  }

  public setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.el.style.display = isVisible ? 'flex' : 'none';
    this.updateReadoutTimer();
  }

  public dispose(): void {
    this.listeners.abort();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    if (this.readoutTimer !== null) clearInterval(this.readoutTimer);
    this.el.remove();
  }

  /** A link's song, part and silenced layers, applied as the game opens. */
  private restoreFromAddress(): void {
    const params = new URLSearchParams(window.location.search);
    const muted = (params.get('mute') ?? '').split(',');
    this.layerBoxes.forEach((box, layer) => {
      box.checked = !muted.includes(layer);
      this.audio.music.setLayerMuted(layer, !box.checked);
    });

    // Another lead, bass, pad or kit on every song, by link only (`&lead=marimba&kit=japan`):
    // how a sound of the wider palette is heard before a track plays it, and how
    // `npm run render -- --lead=` levels the leads
    const overrides: VoiceOverrides = {};
    const lead = params.get('lead');
    const bass = params.get('bass');
    const pad = params.get('pad');
    const kit = params.get('kit');
    if (lead) overrides.lead = lead as LeadVoice;
    if (bass) overrides.bass = bass as BassVoice;
    if (pad) overrides.pad = pad as PadVoice;
    if (kit && kit in KITS) overrides.kit = kit as KitName;
    if (Object.keys(overrides).length > 0) this.audio.music.setOverrides(overrides);
    // The paddle hits' character, in a match too (`&sfx=neon`)
    const style = params.get('sfx');
    if (style && isHitStyle(style)) this.audio.sfx.hitStyle = style;

    const song = params.get('song');
    if (!song || !SONGS.some((s) => s.id === song)) return;
    this.songSelect.value = song;
    this.fillParts();
    const part = params.get('part');
    if (part && [...this.partSelect.options].some((option) => option.value === part)) {
      this.partSelect.value = part;
    }
    // No unlock: the page has just opened, and only a gesture may start the audio
    this.audio.music.audition(song, this.partSelect.value || null);
  }

  /** The readout runs only while someone can see it. */
  private updateReadoutTimer(): void {
    const shouldRun = this.isVisible;
    if (shouldRun && this.readoutTimer === null) {
      this.showReadout();
      this.readoutTimer = setInterval(() => this.showReadout(), READOUT_MS);
    } else if (!shouldRun && this.readoutTimer !== null) {
      clearInterval(this.readoutTimer);
      this.readoutTimer = null;
    }
  }

  private showReadout(): void {
    const position = this.audio.music.getPosition();
    this.showPlayer(position);
    const { songId, part, bar, step, steps, pass } = position;
    const place = (step >= 0 ? ` ${step + 1}/${steps}` : '') + (pass > 0 ? ` ×${pass + 1}` : '');
    const latency = this.audio.getLatency();
    const ms = (seconds: number) => (seconds * 1000).toFixed(0);
    const delay = latency ? `\nlatency ${ms(latency.base)} + out ${ms(latency.output)} ms` : '';
    this.readout.textContent = `${songId} · ${part}${place} · bar ${bar + 1}${delay}${this.describeSamples()}${this.describeLevels()}`;
    this.readout.style.whiteSpace = 'pre-wrap';
  }

  /**
   * The chosen song's parts: "any" first, the song then following the game's heat; then its
   * whole form, played in order from the start, peaks and all.
   */
  private fillParts(): void {
    const song = SONGS.find((s) => s.id === this.songSelect.value);
    const options: [string, string][] = song
      ? [
          [WHOLE_FORM, 'whole form'],
          ['', 'any part'],
          ...song.sections.map((s): [string, string] => [s.name, `${s.name} · ${s.tier}`]),
        ]
      : [];
    this.partSelect.replaceChildren(...options.map(([value, label]) => this.option(value, label)));
    this.partSelect.disabled = !song;
  }

  /**
   * The master's loudness: now, on average since the music last changed place (what songs are
   * evened out by, `level` in songs.ts), and its peak. Plain RMS, not LUFS: enough to compare.
   */
  private describeLevels(): string {
    const levels = this.audio.getMasterLevels();
    if (!levels) return '';
    const { loudness } = this;
    loudness.power += 10 ** (levels.rms / 10);
    loudness.readings++;
    const average = 10 * Math.log10(loudness.power / loudness.readings);
    const db = (value: number) => value.toFixed(1);
    return `\nrms ${db(levels.rms)} (avg ${db(average)}) · peak ${db(levels.peak)} dB`;
  }

  /** Plays what is picked: the song and part, from step `fromStep` of a whole form. */
  private audition(fromStep = 0): void {
    this.loudness = { power: 0, readings: 0 };
    // Picking music means hearing it
    if (this.audio.isPaused) this.setPaused(false);
    this.audio.unlock();
    const song = this.songSelect.value || null;
    const part = (song && this.partSelect.value) || null;
    this.audio.music.audition(song, part, fromStep);
    this.saveToAddress({ song, part });
    this.showReadout();
  }

  private setPaused(isPaused: boolean): void {
    this.audio.setPaused(isPaused);
    this.pauseButton.textContent = isPaused ? '▶' : '⏸';
  }

  /** The song before or after the picked one in the list, played through from its start. */
  private stepSong(by: number): void {
    const ids = SONGS.map((song) => song.id);
    const index = ids.indexOf(this.songSelect.value);
    const next = index < 0 ? (by > 0 ? 0 : ids.length - 1) : (index + by + ids.length) % ids.length;
    this.playForm(ids[next], 0);
  }

  /** A song's whole form, in order, from one of its steps. */
  private playForm(songId: string, step: number): void {
    this.songSelect.value = songId;
    this.fillParts();
    this.partSelect.value = WHOLE_FORM;
    this.audition(step);
  }

  /** The time through the playing song's form and its length, and the strip of its parts. */
  private showPlayer({ songId, part, bar, step }: MusicPosition): void {
    const song = SONGS.find((s) => s.id === songId);
    if (!song) return;
    const bars = song.form.map((index) => song.sections[index].bars);
    if (this.timelineSong !== songId) {
      this.timelineSong = songId;
      this.timeline.replaceChildren(
        ...song.form.map((index, i) => {
          const { name, tier } = song.sections[index];
          const segment = document.createElement('div');
          segment.dataset.step = String(i);
          segment.title = `${i + 1}. ${name} · ${tier} · ${bars[i]} bars`;
          Object.assign(segment.style, {
            flex: `${bars[i]} 1 0`,
            minWidth: '2px',
            borderRadius: '2px',
            cursor: 'pointer',
          });
          this.on(segment, 'click', () => this.playForm(songId, i));
          return segment;
        }),
      );
    }
    [...this.timeline.children].forEach((child, i) => {
      const segment = child as HTMLElement;
      const colour = TIER_COLOURS[song.sections[song.form[i]].tier];
      if (i === step) {
        // The playing part fills up bar by bar
        const done = Math.round(((bar + 1) / bars[i]) * 100);
        segment.style.background = `linear-gradient(90deg, ${colour} ${done}%, ${colour}55 ${done}%)`;
        segment.style.opacity = '1';
      } else {
        segment.style.background = colour;
        segment.style.opacity = i < step ? '0.55' : '0.25';
      }
    });
    const barSeconds = (BEATS_PER_BAR * 60) / song.bpm;
    const sum = (list: number[]) => list.reduce((total, n) => total + n, 0);
    const time = (seconds: number) =>
      `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    this.clock.textContent =
      step >= 0
        ? `${time((sum(bars.slice(0, step)) + bar) * barSeconds)} / ${time(sum(bars) * barSeconds)} · ${part}`
        : part;
  }

  private layerRows(): HTMLElement {
    const rows = this.row(
      ...MUSIC_LAYERS.map((layer) => {
        const label = document.createElement('label');
        Object.assign(label.style, { display: 'flex', gap: '4px', alignItems: 'center' });
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        box.dataset.layer = layer;
        this.on(box, 'change', () => {
          this.audio.music.setLayerMuted(layer, !box.checked);
          const muted = [...this.layerBoxes].filter(([, b]) => !b.checked).map(([id]) => id);
          this.saveToAddress({ mute: muted.join(',') || null });
        });
        this.layerBoxes.set(layer, box);
        const name = document.createElement('span');
        name.textContent = layer;
        label.append(box, name);
        return label;
      }),
    );
    rows.append(this.glideSwitch());
    rows.style.flexWrap = 'wrap';
    rows.style.columnGap = '12px';
    return rows;
  }

  /** Portamento on the lead, on and off, to hear the melody with and without it. */
  private glideSwitch(): HTMLLabelElement {
    const label = document.createElement('label');
    Object.assign(label.style, { display: 'flex', gap: '3px', alignItems: 'center' });
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.dataset.glide = '';
    this.on(box, 'change', () => this.audio.music.setGlide(box.checked));
    const name = document.createElement('span');
    name.textContent = 'glide';
    label.append(box, name);
    return label;
  }

  /** How many instruments are rendered, the memory they take and how long they took. */
  private describeSamples(): string {
    const { samples } = this.audio;
    const count = samples.ids.length;
    if (count === 0) return '';
    const megabytes = (samples.bytes / 1024 / 1024).toFixed(1);
    return `\nsamples ${count} · ${megabytes} MB · ${samples.renderTime.toFixed(0)} ms`;
  }

  private soundButtons(): HTMLElement {
    const buttons = this.row(
      ...STAND_SOUNDS.map((sound) => {
        const button = this.button(sound.name, () => this.playSound(sound));
        button.dataset.sound = sound.name;
        return button;
      }),
    );
    buttons.style.flexWrap = 'wrap';
    return buttons;
  }

  /** Plays a sound, or its series, heard even behind the menus. */
  private playSound(sound: StandSound): void {
    this.audio.unlock();
    const play = (index: number) => {
      this.audio.isAuditioning = true;
      try {
        sound.play(this.audio.sfx, index);
      } finally {
        this.audio.isAuditioning = false;
      }
    };
    play(0);
    for (let i = 1; i < (sound.times ?? 1); i++) {
      const timer = setTimeout(
        () => {
          this.timers.delete(timer);
          play(i);
        },
        i * (sound.every ?? 0) * 1000,
      );
      this.timers.add(timer);
    }
  }

  /** A slider with a "pin" box: unticked, the game moves the value; ticked, the slider does. */
  private slider(name: string, pin: (level: number | null) => void): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.pin = name;
    const range = document.createElement('input');
    range.type = 'range';
    Object.assign(range, { min: '0', max: '1', step: '0.05', value: '0.5' });
    range.dataset.level = name;
    range.style.flex = '1';
    const label = document.createElement('span');
    label.textContent = name;
    label.style.minWidth = '8ch';
    // The value it holds, or that the game is free to move it
    const value = document.createElement('span');
    value.className = 'dbg-mono dbg-muted';
    value.style.minWidth = '4ch';
    value.style.textAlign = 'right';
    const apply = () => {
      value.textContent = box.checked ? Number(range.value).toFixed(2) : 'game';
      pin(box.checked ? Number(range.value) : null);
    };
    value.textContent = 'game';
    this.on(box, 'change', apply);
    this.on(range, 'input', () => {
      box.checked = true;
      apply();
    });
    return this.row(box, label, range, value);
  }

  private select(name: string, options: [string, string][]): HTMLSelectElement {
    const select = document.createElement('select');
    select.dataset.stand = name;
    select.style.font = 'inherit';
    select.append(...options.map(([value, label]) => this.option(value, label)));
    return select;
  }

  private option(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    this.on(button, 'click', onClick);
    return button;
  }

  private row(...children: HTMLElement[]): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '6px', alignItems: 'center' });
    row.append(...children);
    return row;
  }

  /** Listens until dispose; the control keeps no focus, so the keys go on steering the paddle. */
  private on(target: HTMLElement, type: string, handler: () => void): void {
    target.addEventListener(
      type,
      () => {
        handler();
        // A slider keeps focus while dragged; anything else lets go at once
        if (type !== 'input') target.blur();
      },
      { signal: this.listeners.signal },
    );
  }

  /** Writes the given parameters into the address (null removes one), keeping `?debug` bare. */
  private saveToAddress(params: Record<string, string | null>): void {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url.toString().replace(/([?&])debug=(&|$)/, '$1debug$2'));
  }
}
