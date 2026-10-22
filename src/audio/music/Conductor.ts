import { chordAt, Section, Song, STEPS_PER_BAR, Tier } from '@/audio/music/score';
import { Chord } from '@/audio/music/theory';
import { SceneId } from '@/shared/scenes';

// A song plays at least this many bars before the conductor moves on, when its form comes round
// again, and never in the middle of a climax
export const SONG_BARS = 64;
// Bars a section plays before it may be left early; a build always finishes
const MIN_BARS: Record<Tier, number> = { calm: 2, groove: 2, rise: Infinity, high: 4 };
// Early exits land on a phrase boundary, so a melody is never cut off mid-phrase
const PHRASE_BARS = 2;
// A replayed transition starts this many bars before the part it leads into, or at the start
// of the section before it if that is shorter, so a build's riser is heard from its start
const REPLAY_BARS = 4;
// Bars after a peak before a hot rally may take the music to one again: the chorus is a reward,
// and one heard on every rally would stop being one
export const PEAK_COOLDOWN_BARS = 16;

interface Position {
  songIndex: number;
  /** The step of the song's form, or -1 for a section the form doesn't list (the stand's). */
  step: number;
  sectionIndex: number;
  bar: number;
}

/** What the listening stand holds the music to: a song, and one of its sections or any. */
interface Pin {
  songIndex: number;
  sectionIndex: number | null;
}

const isPeak = (tier: Tier) => tier === 'rise' || tier === 'high';

/**
 * The song's form, walked bar by bar (docs/AUDIO.md, "Саундтрек"; 5.5a). A song goes through
 * its form in order — intro, verse, break and so on — so it doesn't repeat for minutes. Its
 * peaks (a build and the chorus it builds to) are earned: the walk passes them by until a rally
 * gets hot, when the music jumps to the next peak at a phrase boundary, through its build, and
 * afterwards comes back to the form where it left; then the peaks rest for a while. In the
 * menus only the calm parts play. When the form comes round again, after a while, the music
 * moves on to another song (picked at random, never the one that just played). How full each
 * part sounds is the arrangement's: its layers come and go with the heat.
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
  /** How many times each section has started in this song, to vary it every time it comes back. */
  private readonly passes = new Map<number, number>();
  /** Bars since the music last left a peak. */
  private barsSincePeak = Infinity;
  /** Where the form goes on after a peak it jumped to. */
  private returnStep: number | null = null;
  /** Whether the section playing was entered for the menus, to leave it early once play starts. */
  private isForMenu = false;
  /** The tier wanted when the next bar was planned, to know a menu's part from the form's. */
  private plannedFor: Tier | null = null;
  private isSongChangeRequested = false;
  /** Where a skip goes; it overrides every plan until the bar line takes the music there. */
  private skipTarget: Position | null = null;
  /** The backdrop on screen; songs that belong to another one never play. */
  private scene: SceneId | null = null;
  /** The backdrop's own song, waiting to be the next one picked. */
  private queuedSong: number | null = null;
  private readonly random: () => number;
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
    this.position = this.entry(songIndex % songs.length, tier);
    // The section it starts on is its first pass
    this.passes.set(this.position.sectionIndex, 1);
    this.isForMenu = tier === 'calm';
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

  /** How many times the section has played before in this song: 0 the first time. */
  public get pass(): number {
    return (this.passes.get(this.position.sectionIndex) ?? 1) - 1;
  }

  /** Where in its form the song is: the step (from 0, -1 off the form) and how many there are. */
  public get formStep(): { step: number; steps: number } {
    return { step: this.position.step, steps: this.song.form.length };
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
   * section, looping, if one is given, or otherwise its form as the game calls for it.
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
    this.skipTarget =
      sectionIndex === null
        ? this.entry(songIndex, wanted)
        : this.atSection(songIndex, sectionIndex);
    this.planned = this.skipTarget;
  }

  /**
   * Plays the way into the pinned section again from the next bar line: the last bars of the
   * section before it in the form, its fill included, then the pinned section.
   */
  public replayTransition(): void {
    if (this.pin?.sectionIndex == null) return;
    const { songIndex, sectionIndex } = this.pin;
    const song = this.songs[songIndex];
    const step = song.form.indexOf(sectionIndex);
    const before =
      step > 0
        ? song.form[step - 1]
        : (sectionIndex - 1 + song.sections.length) % song.sections.length;
    const bars = song.sections[before].bars;
    this.skipTarget = {
      ...this.atSection(songIndex, before),
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
   * it), into a part of the tier the game wants right now.
   */
  public skip(wanted: Tier): void {
    this.skipTarget = this.entry(this.pickOtherSong(), wanted);
    this.planned = this.skipTarget;
  }

  /** Decides where the next bar goes, given the tier the game wants right now. */
  public plan(wanted: Tier): void {
    if (this.skipTarget) {
      this.planned = this.skipTarget;
      return;
    }

    const { section, bar, position } = this;
    const isEnd = bar >= section.bars - 1;
    // The stand's section loops; the way into it (a replayed transition) runs on into it
    const pinned = this.pin?.sectionIndex;
    if (pinned != null) {
      const isIn = position.sectionIndex === pinned;
      this.planned =
        isIn || !isEnd ? this.continuation() : this.atSection(position.songIndex, pinned);
      return;
    }

    const canLeave =
      isEnd || (this.barsInSection + 1 >= MIN_BARS[section.tier] && (bar + 1) % PHRASE_BARS === 0);
    const walk = () => this.at(position.songIndex, this.nextWalkStep(position.step, wanted));
    const willWrap = isEnd && this.nextWalkStep(position.step, wanted) <= position.step;

    if (
      wanted !== 'high' &&
      !this.pin &&
      section.tier !== 'rise' &&
      ((this.isSongChangeRequested && canLeave) || (willWrap && this.barsInSong + 1 >= SONG_BARS))
    ) {
      this.planned = this.entry(this.pickOtherSong(), wanted);
    } else if (section.tier === 'rise') {
      // A build always runs into what it builds to
      this.planned = isEnd
        ? this.at(position.songIndex, this.nextFormStep(position.step))
        : this.continuation();
    } else if (section.tier === 'high') {
      const next = this.nextFormStep(position.step);
      const nextIsPeak = this.song.sections[this.song.form[next]]?.tier === 'high';
      if (isEnd && wanted === 'high' && nextIsPeak) {
        this.planned = this.at(position.songIndex, next);
      } else if (isEnd || (wanted !== 'high' && canLeave)) {
        this.planned = this.at(
          position.songIndex,
          this.returnStep ?? this.nextWalkStep(position.step, wanted),
        );
        this.returnStep = null;
      } else {
        this.planned = this.continuation();
      }
    } else if (wanted === 'high' && canLeave && this.barsSincePeak >= PEAK_COOLDOWN_BARS) {
      const peak = this.nextPeakStep(position.songIndex, position.step);
      if (peak === null) {
        this.planned = isEnd ? walk() : this.continuation();
      } else {
        // Back to the form where it was going, after the peak
        this.returnStep = isEnd ? this.nextWalkStep(position.step, wanted) : position.step;
        this.planned = this.at(position.songIndex, peak);
      }
    } else if (canLeave && this.isForMenu && wanted !== 'calm') {
      // The menu's calm part gives way to the groove soon after play starts
      this.planned = walk();
    } else if (canLeave && wanted === 'calm' && section.tier !== 'calm') {
      // Back to the menus: to a calm part soon
      this.planned = walk();
    } else {
      this.planned = isEnd ? walk() : this.continuation();
    }
    this.plannedFor = wanted;
  }

  /** Moves to the bar `plan` decided on (or simply the next one) at the bar line. */
  public advance(): void {
    const next = this.planned ?? this.continuation();
    const isNewSong = next.songIndex !== this.position.songIndex;

    if (isNewSong) {
      this.passes.clear();
      this.barsInSong = 0;
      this.isSongChangeRequested = false;
      this.returnStep = null;
    } else {
      this.barsInSong++;
    }
    const isNewSection =
      isNewSong ||
      next.sectionIndex !== this.position.sectionIndex ||
      next.step !== this.position.step;
    this.barsInSection = isNewSection ? 0 : this.barsInSection + 1;
    const wasPeak = isPeak(this.section.tier);
    if (isNewSection) {
      this.previousTier = this.section.tier;
      this.isForMenu = this.plannedFor === 'calm';
    }

    this.position = next;
    // A section starting — anew, or again after looping — is one more pass of it
    if (next.bar === 0)
      this.passes.set(next.sectionIndex, (this.passes.get(next.sectionIndex) ?? 0) + 1);
    this.planned = null;
    this.plannedFor = null;
    this.skipTarget = null;
    if (isPeak(this.section.tier)) this.barsSincePeak = 0;
    else this.barsSincePeak = wasPeak ? 0 : this.barsSincePeak + 1;
  }

  /** The position at the start of `step` of the song's form. */
  private at(songIndex: number, step: number): Position {
    const form = this.songs[songIndex].form;
    return { songIndex, step, sectionIndex: form[step] ?? 0, bar: 0 };
  }

  /** The position at the start of a section: its first step in the form, or off the form. */
  private atSection(songIndex: number, sectionIndex: number): Position {
    return {
      songIndex,
      step: this.songs[songIndex].form.indexOf(sectionIndex),
      sectionIndex,
      bar: 0,
    };
  }

  /**
   * Where a song starts when the game wants `wanted`: its chorus on a hot rally, otherwise its
   * first part the game allows.
   */
  private entry(songIndex: number, wanted: Tier): Position {
    if (wanted === 'high' || wanted === 'rise') {
      const form = this.songs[songIndex].form;
      const chorus = form.findIndex((i) => this.songs[songIndex].sections[i].tier === 'high');
      if (chorus >= 0) return this.at(songIndex, chorus);
    }
    return this.at(songIndex, this.nextWalkStep(-1, wanted, songIndex));
  }

  /**
   * The next step of the form after `from` the walk plays: in the menus a calm part, in play any
   * but a peak (peaks are jumped to). Past the end the form comes round again.
   */
  private nextWalkStep(from: number, wanted: Tier, songIndex = this.position.songIndex): number {
    const song = this.songs[songIndex];
    const { form } = song;
    const tierAt = (step: number) => song.sections[form[step]].tier;
    const allowed: ((tier: Tier) => boolean)[] = [
      wanted === 'calm' ? (tier) => tier === 'calm' : (tier) => !isPeak(tier),
      (tier) => !isPeak(tier),
      () => true,
    ];
    for (const allows of allowed) {
      for (let k = 1; k <= form.length; k++) {
        const step = (from + k + form.length) % form.length;
        if (allows(tierAt(step))) return step;
      }
    }
    return 0;
  }

  /** The step after `from` in the form, whatever it is: a build runs into its chorus. */
  private nextFormStep(from: number): number {
    return (from + 1) % this.song.form.length;
  }

  /**
   * The next peak after `from`, coming round the form: a build that leads into a chorus if
   * there is one, otherwise a chorus on its own; null if the song has no peak.
   */
  private nextPeakStep(songIndex: number, from: number): number | null {
    const song = this.songs[songIndex];
    const { form } = song;
    const tierAt = (step: number) => song.sections[form[step % form.length]].tier;
    let chorus: number | null = null;
    for (let k = 1; k <= form.length; k++) {
      const step = (from + k + form.length) % form.length;
      if (tierAt(step) === 'rise' && tierAt(step + 1) === 'high') return step;
      if (tierAt(step) === 'high') chorus ??= step;
    }
    return chorus;
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
}
