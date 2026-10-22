import { chordAt, Section, Song, STEPS_PER_BAR, Tier } from '@/audio/music/score';
import { Chord } from '@/audio/music/theory';
import { SceneId } from '@/shared/scenes';

// A song plays at least this many bars before the conductor moves on, at the end of a
// section and never in the middle of a climax
export const SONG_BARS = 64;
// Bars a section plays before it may be left early for another tier; a build always finishes
const MIN_BARS: Record<Tier, number> = { calm: 2, groove: 2, rise: Infinity, high: 4 };
// Early exits land on a phrase boundary, so a melody is never cut off mid-phrase
const PHRASE_BARS = 2;
// A replayed transition starts this many bars before the part it leads into, or at the start
// of the section before it if that is shorter, so a build's riser is heard from its start
const REPLAY_BARS = 4;

interface Position {
  songIndex: number;
  sectionIndex: number;
  bar: number;
}

/** What the listening stand holds the music to: a song, and one of its sections or any. */
interface Pin {
  songIndex: number;
  sectionIndex: number | null;
}

/** Where to head next from `current` when the game wants `wanted`: a chorus is built up to. */
function route(current: Tier, wanted: Tier): Tier {
  if (wanted !== 'high') return wanted;
  return current === 'rise' || current === 'high' ? 'high' : 'rise';
}

/**
 * The song's form, decided bar by bar: which section plays, when the music moves to another
 * one as the game heats up or cools down, and when to move on to another song (picked at
 * random, never the one that just played).
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
  /** The tier of the section before this one, null before the first change. */
  private previousTier: Tier | null = null;
  private barsInSong = 0;
  private isSongChangeRequested = false;
  /** Where a skip goes; it overrides every plan until the bar line takes the music there. */
  private skipTarget: Position | null = null;
  /** The backdrop on screen; songs that belong to another one never play. */
  private scene: SceneId | null = null;
  /** The backdrop's own song, waiting to be the next one picked. */
  private queuedSong: number | null = null;
  private readonly random: () => number;
  /** How many times each tier was entered, to take turns between a song's sections of it. */
  private readonly turns = new Map<Tier, number>();
  /** The listening stand's hold on the music; null while the game leads it. */
  private pin: Pin | null = null;

  constructor(
    songs: readonly Song[],
    songIndex: number,
    tier: Tier = 'calm',
    random: () => number = Math.random,
  ) {
    this.songs = songs;
    this.random = random;
    const index = songIndex % songs.length;
    this.position = { songIndex: index, sectionIndex: this.pickSection(index, tier), bar: 0 };
  }

  public get song(): Song {
    return this.songs[this.position.songIndex];
  }

  public get section(): Section {
    return this.song.sections[this.position.sectionIndex];
  }

  /** The song the music is heading into: the next bar's, once a change is decided. */
  public get upcomingSong(): Song {
    return this.songs[(this.planned ?? this.position).songIndex];
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

  /** The tier the music came from into this section, for the transition that marks it. */
  public get cameFrom(): Tier | null {
    return this.previousTier;
  }

  /** Whether the listening stand holds the music to a song. */
  public get isPinned(): boolean {
    return this.pin !== null;
  }

  /**
   * The listening stand: from the next bar line, play this song and nothing else — only this
   * section, looping, if one is given, or otherwise its sections as the game calls for them.
   * Null lets the game lead the music again.
   */
  public pinTo(
    songIndex: number | null,
    sectionIndex: number | null = null,
    wanted: Tier = 'groove',
  ): void {
    if (songIndex === null) {
      this.pin = null;
      // Back to the backdrop's music, at the next phrase boundary
      if (this.scene) this.enterScene(this.scene);
      return;
    }
    this.pin = { songIndex, sectionIndex };
    this.skipTarget = {
      songIndex,
      sectionIndex: sectionIndex ?? this.pickSection(songIndex, wanted),
      bar: 0,
    };
    this.planned = this.skipTarget;
  }

  /**
   * Plays the way into the pinned section again from the next bar line: the last bars of the
   * section before it in the song, its fill included, then the pinned section.
   */
  public replayTransition(): void {
    if (this.pin?.sectionIndex == null) return;
    const { songIndex, sectionIndex } = this.pin;
    const sections = this.songs[songIndex].sections;
    const before = (sectionIndex - 1 + sections.length) % sections.length;
    const bars = sections[before].bars;
    this.skipTarget = {
      songIndex,
      sectionIndex: before,
      bar: bars <= REPLAY_BARS ? 0 : bars - REPLAY_BARS,
    };
    this.planned = this.skipTarget;
  }

  /** Move on to another song at the next phrase boundary. */
  public requestNewSong(): void {
    this.isSongChangeRequested = true;
  }

  /**
   * Another backdrop came up: move on to another song at the next phrase boundary — the
   * backdrop's own one if it has one — unless that song is already playing.
   * @returns whether the song is going to change
   */
  public enterScene(scene: SceneId): boolean {
    this.scene = scene;
    const own = this.songs.findIndex((song) => song.scene === scene);
    if (own >= 0 && own === this.position.songIndex) {
      this.queuedSong = null;
      return false;
    }
    this.queuedSong = own >= 0 ? own : null;
    this.requestNewSong();
    return true;
  }

  /**
   * Jump to another song, picked at random, at the very next bar line (the player asked for
   * it), into a section of the tier the game wants right now.
   */
  public skip(wanted: Tier): void {
    const songIndex = this.pickOtherSong();
    const tier = wanted === 'rise' ? 'high' : wanted;
    this.skipTarget = { songIndex, sectionIndex: this.pickSection(songIndex, tier), bar: 0 };
    this.planned = this.skipTarget;
  }

  /** Decides where the next bar goes, given the tier the game wants right now. */
  public plan(wanted: Tier): void {
    if (this.skipTarget) {
      this.planned = this.skipTarget;
      return;
    }

    const { section, bar, position } = this;
    // The stand's section loops; the way into it (a replayed transition) runs on into it
    const pinned = this.pin?.sectionIndex;
    if (pinned != null) {
      const isIn = position.sectionIndex === pinned;
      const isEnd = bar >= section.bars - 1;
      this.planned =
        isIn || !isEnd ? this.continuation() : { ...position, sectionIndex: pinned, bar: 0 };
      return;
    }

    const isEnd = bar >= section.bars - 1;
    const tier = route(section.tier, wanted);
    const canLeave =
      isEnd || (this.barsInSection + 1 >= MIN_BARS[section.tier] && (bar + 1) % PHRASE_BARS === 0);
    const isQuiet = tier === 'calm' || tier === 'groove';

    if (
      isQuiet &&
      !this.pin &&
      ((this.isSongChangeRequested && canLeave) || (isEnd && this.barsInSong + 1 >= SONG_BARS))
    ) {
      const songIndex = this.pickOtherSong();
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
    if (isNewSection) this.previousTier = this.section.tier;

    this.position = next;
    this.planned = null;
    this.skipTarget = null;
  }

  /** The next bar of the current section, looping. */
  private continuation(): Position {
    const { position, section } = this;
    return { ...position, bar: (position.bar + 1) % section.bars };
  }

  /**
   * The backdrop's own song if it is waiting; otherwise any song but the one playing, at random
   * — and, when a skip is already on its way, not that one either, so every press of skip
   * brings a new title. Songs that belong to another backdrop are left out.
   */
  private pickOtherSong(): number {
    if (this.queuedSong !== null) {
      const queued = this.queuedSong;
      this.queuedSong = null;
      return queued;
    }

    const excluded = new Set([this.position.songIndex, this.skipTarget?.songIndex]);
    const candidates = this.songs.flatMap((song, i) =>
      excluded.has(i) || (song.scene !== undefined && song.scene !== this.scene) ? [] : [i],
    );
    if (candidates.length === 0) return this.position.songIndex;
    return candidates[Math.floor(this.random() * candidates.length)];
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
