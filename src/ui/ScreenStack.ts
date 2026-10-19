import { computed, ReadonlySignal, signal } from '@preact/signals-core';
import { ComponentChild } from 'preact';
import { SceneId } from '@/shared/scenes';

/** What a screen shows: its title and subtitle, and the Preact screen under them. */
export interface ScreenView {
  title: string;
  subtitle: string;
  body: ComponentChild;
}

/** A screen as the stack holds it. */
export interface ScreenEntry {
  /** Tells the screen drawn again (its focus kept) from another one (the focus moved on). */
  id: string;
  /**
   * Builds what it shows from what it shows now. It runs in an effect: whatever signal it reads
   * (the settings, the profile) draws it again when that changes.
   */
  view: () => ScreenView;
  /**
   * The backdrop it wants behind it as it comes up, null for the player's; left out, the backdrop
   * stays as it is (the menus that belong to a match, the settings).
   */
  scene?: SceneId | null;
  /** Whether it sets a match up (quick, two players): the game previews its backdrop. */
  isMatchSetup?: boolean;
}

/**
 * The screens the player has come through, the one on show on top: BACK and Esc step down it.
 * Which screens lie under one is the way the player came, so the settings lead back to the pause
 * or the main menu, whichever they were opened from.
 */
export class ScreenStack {
  private readonly entries = signal<readonly ScreenEntry[]>([]);
  /** The screen on show, or null before any is. */
  public readonly top: ReadonlySignal<ScreenEntry | null> = computed(
    () => this.entries.value.at(-1) ?? null,
  );

  /** Opens a screen over the one on show. */
  public push(entry: ScreenEntry): void {
    this.entries.value = [...this.entries.value, entry];
  }

  /**
   * Starts over from these screens, the last on show: a root (the main menu, the pause), or the
   * way down to a screen opened from outside the menus (back from a challenge to its list).
   */
  public reset(...entries: ScreenEntry[]): void {
    this.entries.value = entries;
  }

  /**
   * Steps back to the screen under the one on show.
   * @returns whether it did (false on a root, which has none under it)
   */
  public back(): boolean {
    if (this.entries.value.length < 2) return false;
    this.entries.value = this.entries.value.slice(0, -1);
    return true;
  }
}
