import { AudioEngine } from '@/audio/AudioEngine';
import { MUSIC_LAYERS, MusicLayer } from '@/audio/music/Arrangement';
import { SONGS } from '@/audio/music/songs';
import { SoundEffects } from '@/audio/sfx/SoundEffects';

const READOUT_MS = 250; // how often the position and latency are redrawn while open

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
  { name: 'hit', play: (sfx) => sfx.playPaddleHit(1, false, 0) },
  { name: 'hit cpu', play: (sfx) => sfx.playPaddleHit(1, false, 1) },
  {
    name: 'rally ×8',
    play: (sfx, i) => sfx.playPaddleHit(i + 1, false, i % 2),
    times: 8,
    every: 0.32,
  },
  { name: 'perfect', play: (sfx) => sfx.playPaddleHit(3, true) },
  {
    name: 'perfect ×4',
    play: (sfx, i) => sfx.playPaddleHit(i + 1, true, i % 2),
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
 * to a song and one of its parts, pins intensity and the climax, silences layers, replays the way
 * into a part, and plays every action sound and its series — so music is composed by ear, not
 * blind (docs/AUDIO.md). The address keeps the song, the part and the silenced layers
 * (`?song=night-drive&part=chorus&mute=drums`), so a link points at a place in a song; it works
 * without `?debug` too.
 */
export class SoundStand {
  private readonly audio: AudioEngine;
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly songSelect: HTMLSelectElement;
  private readonly partSelect: HTMLSelectElement;
  private readonly readout: HTMLElement;
  private readonly layerBoxes = new Map<MusicLayer, HTMLInputElement>();
  private readonly listeners = new AbortController();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readoutTimer: ReturnType<typeof setInterval> | null = null;
  private isOpen = false;
  private isVisible = false;

  constructor(audio: AudioEngine) {
    this.audio = audio;

    this.el = document.createElement('section');
    this.el.setAttribute('aria-label', 'Sound stand (debug)');
    Object.assign(this.el.style, {
      position: 'fixed',
      bottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
      left: 'calc(6px + env(safe-area-inset-left, 0px))',
      zIndex: '9999',
      display: 'none',
      flexDirection: 'column',
      gap: '4px',
      padding: '4px 8px',
      width: 'min(260px, calc(100vw - 12px))',
      maxHeight: '70vh',
      overflowY: 'auto',
      boxSizing: 'border-box',
      font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      color: '#19f0ff',
      background: 'rgba(0, 0, 0, 0.75)',
      borderRadius: '4px',
    });

    const toggle = this.button('♪ sound stand', () => this.setOpen(!this.isOpen));
    toggle.style.color = '#7cfc8a';
    toggle.dataset.stand = 'toggle';

    this.body = document.createElement('div');
    Object.assign(this.body.style, { display: 'none', flexDirection: 'column', gap: '4px' });

    this.songSelect = this.select('song', [
      ['', '— the game’s —'],
      ...SONGS.map((song): [string, string] => [song.id, song.title]),
    ]);
    this.partSelect = this.select('part', []);
    this.on(this.songSelect, 'change', () => {
      this.fillParts();
      this.audition();
    });
    this.on(this.partSelect, 'change', () => this.audition());

    const transport = this.row(
      this.button('↻ transition', () => this.audio.music.replayTransition()),
      this.button('drop', () => this.audio.music.triggerDrop()),
    );

    this.readout = document.createElement('span');
    this.readout.style.color = '#ffd84d';

    this.body.append(
      this.songSelect,
      this.partSelect,
      transport,
      this.slider('intensity', (level) => this.audio.music.pinIntensity(level)),
      this.slider('climax', (level) => this.audio.music.pinClimax(level)),
      this.layerRows(),
      this.soundButtons(),
      this.readout,
    );
    this.el.append(toggle, this.body);
    document.body.appendChild(this.el);

    this.restoreFromAddress();
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

  private setOpen(isOpen: boolean): void {
    this.isOpen = isOpen;
    this.body.style.display = isOpen ? 'flex' : 'none';
    this.updateReadoutTimer();
  }

  /** The readout runs only while someone can see it. */
  private updateReadoutTimer(): void {
    const shouldRun = this.isOpen && this.isVisible;
    if (shouldRun && this.readoutTimer === null) {
      this.showReadout();
      this.readoutTimer = setInterval(() => this.showReadout(), READOUT_MS);
    } else if (!shouldRun && this.readoutTimer !== null) {
      clearInterval(this.readoutTimer);
      this.readoutTimer = null;
    }
  }

  private showReadout(): void {
    const { songId, part, bar } = this.audio.music.getPosition();
    const latency = this.audio.getLatency();
    const ms = (seconds: number) => (seconds * 1000).toFixed(0);
    const delay = latency ? `\nlatency ${ms(latency.base)} + out ${ms(latency.output)} ms` : '';
    this.readout.textContent = `${songId} · ${part} · bar ${bar + 1}${delay}`;
    this.readout.style.whiteSpace = 'pre-wrap';
  }

  /** The chosen song's parts, "any" first: the song then follows the game's heat. */
  private fillParts(): void {
    const song = SONGS.find((s) => s.id === this.songSelect.value);
    const options: [string, string][] = song
      ? [
          ['', 'any part'],
          ...song.sections.map((s): [string, string] => [s.name, `${s.name} · ${s.tier}`]),
        ]
      : [];
    this.partSelect.replaceChildren(...options.map(([value, label]) => this.option(value, label)));
    this.partSelect.disabled = !song;
  }

  private audition(): void {
    this.audio.unlock();
    const song = this.songSelect.value || null;
    const part = (song && this.partSelect.value) || null;
    this.audio.music.audition(song, part);
    this.saveToAddress({ song, part });
  }

  private layerRows(): HTMLElement {
    const rows = this.row(
      ...MUSIC_LAYERS.map((layer) => {
        const label = document.createElement('label');
        Object.assign(label.style, { display: 'flex', gap: '3px', alignItems: 'center' });
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
    rows.style.flexWrap = 'wrap';
    return rows;
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
    label.style.minWidth = '9ch';
    const apply = () => pin(box.checked ? Number(range.value) : null);
    this.on(box, 'change', apply);
    this.on(range, 'input', () => {
      box.checked = true;
      apply();
    });
    return this.row(box, label, range);
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
    Object.assign(button.style, {
      font: 'inherit',
      color: 'inherit',
      background: 'rgba(25, 240, 255, 0.12)',
      border: '1px solid rgba(25, 240, 255, 0.4)',
      borderRadius: '3px',
      padding: '2px 6px',
      cursor: 'pointer',
    });
    this.on(button, 'click', onClick);
    return button;
  }

  private row(...children: HTMLElement[]): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '4px', alignItems: 'center' });
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
