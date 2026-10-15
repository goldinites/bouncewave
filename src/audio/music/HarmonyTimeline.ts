/** What the music is playing right now: bar root (MIDI) and chord intervals in semitones. */
export interface Harmony {
  root: number;
  chord: readonly number[];
}

interface TimedHarmony extends Harmony {
  time: number;
}

/**
 * Remembers recent chord changes with their audio-clock start times. Steps are scheduled
 * ahead of playback, so "the chord now" is the latest change whose time has been reached.
 */
export class HarmonyTimeline {
  private readonly entries: TimedHarmony[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  public get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  public push(time: number, harmony: Harmony): void {
    this.entries.push({ time, root: harmony.root, chord: harmony.chord });
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
  }

  /** The chord sounding at `time`; the oldest known one if `time` precedes them all. */
  public at(time: number): Harmony | null {
    if (this.entries.length === 0) return null;

    let current = this.entries[0];
    for (const entry of this.entries) {
      if (entry.time <= time) current = entry;
    }
    return { root: current.root, chord: current.chord };
  }
}
