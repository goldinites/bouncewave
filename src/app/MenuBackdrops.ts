import { Song } from '@/audio/music/score';

// The menus' backdrops giving way one to the next with the menus' song (5.13, docs/ROADMAP.md)
const MENU_BACKDROPS = {
  // A backdrop stays at least this long, near enough one part of the menus' song, so coming
  // into the menus never brings a change at once
  MIN_SHOWN: 15, // s
  // With no music keeping time (not unlocked yet), a backdrop gives way on its own after this
  // long: eight bars of the menus' song at 84 BPM, and a little over, so the music's own part
  // changes come first whenever it plays
  ON_ITS_OWN: 25, // s
} as const;

/**
 * Changes the backdrop behind the menus, one after another, on the menus' song's part changes:
 * a part's start is heard ahead of time on the audio clock and the change waits for it to sound.
 * Active only while the menus' own music plays (the game says so as the screens change).
 */
export class MenuBackdrops {
  private isActive = false;
  /** Seconds the backdrop on screen has been shown since it came in, or since the menus did. */
  private shownFor = 0;
  /** The audio-clock time of the menus' song's next part, to change the backdrop at. */
  private pendingAt: number | null = null;

  /**
   * @param change dissolves to the next backdrop
   * @param audioTime the audio clock now; null while the music has none
   */
  constructor(
    private readonly change: () => void,
    private readonly audioTime: () => number | null,
  ) {}

  /** The menus' music started playing (true) or gave way to another (false). */
  public setActive(isActive: boolean): void {
    if (isActive && !this.isActive) this.shownFor = 0;
    this.isActive = isActive;
    this.pendingAt = null;
  }

  /** A part of a song starts at `time` on the audio clock; the menus' song's parts change it. */
  public onSectionStart(time: number, song: Song): void {
    if (this.isActive && song.place === 'menu') this.pendingAt = time;
  }

  /** Moves on by `dt` seconds of the frame loop. */
  public update(dt: number): void {
    if (!this.isActive) return;
    this.shownFor += dt;
    const now = this.audioTime();
    if (this.pendingAt !== null && now !== null && now >= this.pendingAt) {
      this.pendingAt = null;
      if (this.shownFor >= MENU_BACKDROPS.MIN_SHOWN) this.next();
      return;
    }
    if (this.shownFor >= MENU_BACKDROPS.ON_ITS_OWN) this.next();
  }

  private next(): void {
    this.shownFor = 0;
    this.change();
  }
}
