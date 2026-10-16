import { chordAt, Section, Song, STEPS_PER_BAR, Tier } from '@/audio/music/score';
import { Chord } from '@/audio/music/theory';

// A song plays at least this many bars before the conductor moves on, at the end of a
// section and never in the middle of a climax
export const SONG_BARS = 64;
// Bars a section plays before it may be left early for another tier; a build always finishes
const MIN_BARS: Record<Tier, number> = { calm: 2, groove: 2, rise: Infinity, high: 4 };
// Early exits land on a phrase boundary, so a melody is never cut off mid-phrase
const PHRASE_BARS = 2;

interface Position {
  songIndex: number;
  sectionIndex: number;
  bar: number;
}

/** Where to head next from `current` when the game wants `wanted`: a chorus is built up to. */
function route(current: Tier, wanted: Tier): Tier {
  if (wanted !== 'high') return wanted;
  return current === 'rise' || current === 'high' ? 'high' : 'rise';
}

/**
 * The song's form, decided bar by bar: which section plays, when the music moves to another
 * one as the game heats up or cools down, and when to move on to the next song.
 *
 * Halfway through every bar `plan` decides the next one, so a drum fill can lead into a new
 * section; `advance` then moves there at the bar line.
 */
export class Conductor {
  private readonly songs: readonly Song[];
  private position: Position;
  private planned: Position | null = null;
  /** Bars played in the current section before the current one, restarts included. */
  private barsInSection = 0;
  private barsInSong = 0;
  private isSongChangeRequested = false;
  /** How many times each tier was entered, to take turns between a song's sections of it. */
  private readonly turns = new Map<Tier, number>();

  constructor(songs: readonly Song[], songIndex: number, tier: Tier = 'calm') {
    this.songs = songs;
    const index = songIndex % songs.length;
    this.position = { songIndex: index, sectionIndex: this.pickSection(index, tier), bar: 0 };
  }

  public get song(): Song {
    return this.songs[this.position.songIndex];
  }

  public get section(): Section {
    return this.song.sections[this.position.sectionIndex];
  }

  /** Bar of the current section, from 0. */
  public get bar(): number {
    return this.position.bar;
  }

  /** Whether the next bar starts a section (a new one, or this one again): time for a fill. */
  public get isLastBar(): boolean {
    return this.planned?.bar === 0;
  }

  /** The chord the next bar opens with, for bass lines leading into it. */
  public get nextBarChord(): Chord {
    const next = this.planned ?? this.continuation();
    const section = this.songs[next.songIndex].sections[next.sectionIndex];
    return chordAt(section, next.bar * STEPS_PER_BAR);
  }

  /** Move on to the next song at the next phrase boundary. */
  public requestNewSong(): void {
    this.isSongChangeRequested = true;
  }

  /** Decides where the next bar goes, given the tier the game wants right now. */
  public plan(wanted: Tier): void {
    const { section, bar, position } = this;
    const isEnd = bar >= section.bars - 1;
    const tier = route(section.tier, wanted);
    const canLeave =
      isEnd || (this.barsInSection + 1 >= MIN_BARS[section.tier] && (bar + 1) % PHRASE_BARS === 0);
    const isQuiet = tier === 'calm' || tier === 'groove';

    if (
      isQuiet &&
      ((this.isSongChangeRequested && canLeave) || (isEnd && this.barsInSong + 1 >= SONG_BARS))
    ) {
      const songIndex = (position.songIndex + 1) % this.songs.length;
      this.planned = { songIndex, sectionIndex: this.pickSection(songIndex, tier), bar: 0 };
    } else if (tier !== section.tier && canLeave) {
      this.planned = {
        ...position,
        sectionIndex: this.pickSection(position.songIndex, tier),
        bar: 0,
      };
    } else if (isEnd) {
      this.planned = {
        ...position,
        sectionIndex: this.pickSection(position.songIndex, section.tier),
        bar: 0,
      };
    } else {
      this.planned = this.continuation();
    }
  }

  /** Moves to the bar `plan` decided on (or simply the next one) at the bar line. */
  public advance(): void {
    const next = this.planned ?? this.continuation();
    const isNewSong = next.songIndex !== this.position.songIndex;

    if (isNewSong) {
      this.barsInSong = 0;
      this.isSongChangeRequested = false;
    } else {
      this.barsInSong++;
    }
    const isNewSection = isNewSong || next.sectionIndex !== this.position.sectionIndex;
    this.barsInSection = isNewSection ? 0 : this.barsInSection + 1;

    this.position = next;
    this.planned = null;
  }

  /** The next bar of the current section, looping. */
  private continuation(): Position {
    const { position, section } = this;
    return { ...position, bar: (position.bar + 1) % section.bars };
  }

  /** One of the song's sections of `tier`, taking turns; falls back to the groove. */
  private pickSection(songIndex: number, tier: Tier): number {
    const sections = this.songs[songIndex].sections;
    let candidates = sections.flatMap((section, i) => (section.tier === tier ? [i] : []));
    if (candidates.length === 0) {
      candidates = sections.flatMap((section, i) => (section.tier === 'groove' ? [i] : []));
    }
    if (candidates.length === 0) return 0;

    const turn = this.turns.get(tier) ?? 0;
    this.turns.set(tier, turn + 1);
    return candidates[turn % candidates.length];
  }
}
