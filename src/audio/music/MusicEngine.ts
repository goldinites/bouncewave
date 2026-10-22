import { Arrangement, BASS_LOW, MusicLayer } from '@/audio/music/Arrangement';
import { Conductor } from '@/audio/music/Conductor';
import { Harmony, HarmonyTimeline } from '@/audio/music/HarmonyTimeline';
import { Instruments } from '@/audio/music/Instruments';
import {
  getTargetIntensity,
  getWantedTier,
  INITIAL_MUSIC_STATE,
  MusicState,
  followClimax,
  stepIntensity,
} from '@/audio/music/intensity';
import { MusicGraph } from '@/audio/music/MusicGraph';
import { chordAt, STEPS_PER_BAR, Tier } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { StepScheduler } from '@/audio/music/StepScheduler';
import { placeAbove } from '@/audio/music/theory';
import { GameState } from '@/match/GameState';
import { clamp } from '@/shared/math';
import { SceneId } from '@/shared/scenes';

const HARMONY_HISTORY = 8; // scheduled chord changes kept to find what is audible now
const TAPE_STOP_DURATION = 1.1; // s for the music to grind to a halt on defeat

const START_DELAY = 0.1; // s before the first step

// The conductor decides the next bar halfway through the current one, in time for a fill
const PLAN_STEP = 8;
const ECHO_STEPS = 3; // lead echo time, in steps
const TONE_FILTER: Record<GameState, number> = { paused: 450, menu: 2800, play: 16000 };

/** A song that plays behind any backdrop, at random: what the music opens with. */
function pickSharedSong(): number {
  const shared = SONGS.flatMap((song, i) => (song.scene === undefined ? [i] : []));
  return shared[Math.floor(Math.random() * shared.length)] ?? 0;
}

/** Where the music is, for the listening stand: the song, its section and bar (from 0). */
export interface MusicPosition {
  songId: string;
  part: string;
  bar: number;
}

/**
 * Procedural synthwave soundtrack. The game pushes its state in with `setState` every frame;
 * a look-ahead scheduler turns that into intensity, lets the conductor pick the section that
 * fits, and plays the arrangement step by step. Each song keeps its own tempo throughout.
 * Effect commands (drama, climax, duck, tape stop) are forwarded to the audio graph.
 */
export class MusicEngine {
  private graph: MusicGraph | null = null;
  private readonly harmony = new HarmonyTimeline(HARMONY_HISTORY);

  private state: MusicState = INITIAL_MUSIC_STATE;
  private intensity = 0.3;
  /** The game's climax build-up, as last pushed in. */
  private gameClimaxLevel = 0;
  /** The music's own climax level: follows the game's, but dies away more slowly. */
  private climaxLevel = 0;
  private isDropPending = false;
  private isTapeStopped = false;

  private currentStep = 0;
  private readonly conductor = new Conductor(SONGS, pickSharedSong());
  private scheduler: StepScheduler | null = null;
  // The listening stand's overrides (src/debug/SoundStand.ts); null lets the game lead
  private readonly mutedLayers = new Set<MusicLayer>();
  private pinnedIntensity: number | null = null;
  private pinnedClimax: number | null = null;

  /** Builds the audio graph and starts the scheduler; safe to call more than once. */
  public init(audioContext: AudioContext): void {
    if (this.graph) return;

    const graph = new MusicGraph(audioContext);
    const arrangement = new Arrangement(new Instruments(graph), graph, this.mutedLayers);
    this.graph = graph;

    this.scheduler = new StepScheduler(
      audioContext,
      {
        playStep: (time) => this.playStep(time, graph, arrangement),
        // During a tape stop no new notes are scheduled; the clock resyncs on recover
        canRun: () => audioContext.state === 'running' && !this.isTapeStopped,
      },
      START_DELAY,
    );
  }

  /** Latest game state; read by the scheduler on its next tick. */
  public setState(state: MusicState): void {
    this.state = state;
  }

  /** Muffle the music with a low-pass, level in [0, 1] (0 = fully open). */
  public setDramaLevel(level: number): void {
    this.graph?.setDramaLevel(level);
  }

  /**
   * Rally climax build-up in [0, 1], already eased by the game: extra layers fade in with it
   * and intensity rises toward full. The game moves it slowly, so this is the riser. When it
   * falls, the music lets the climax die away more slowly than the screen (followClimax).
   */
  public setClimaxLevel(level: number): void {
    this.gameClimaxLevel = clamp(level, 0, 1);
    if (this.gameClimaxLevel === 0) {
      this.isDropPending = false;
    }
  }

  /** Cuts the climax at once, with no fade (new match, back to the menu, end of a match). */
  public resetClimax(): void {
    this.gameClimaxLevel = 0;
    this.climaxLevel = 0;
    this.isDropPending = false;
  }

  /** The build-up has peaked: hit the drop on the next step. */
  public triggerDrop(): void {
    this.isDropPending = true;
  }

  /** The music sags like a held tape for `duration` seconds, then catches up (Reflex). */
  public holdTape(duration: number): void {
    this.graph?.holdTape(duration);
  }

  /** Dip the music so the victory sting sits on top; stays down until `recover`. */
  public duck(): void {
    this.graph?.duck();
  }

  /** Tape stop for a defeat; the sequencer halts until `recover`. */
  public tapeStop(duration = TAPE_STOP_DURATION): void {
    if (this.graph?.tapeStop(duration)) {
      this.isTapeStopped = true;
    }
  }

  /** Undo `duck` / `tapeStop` and resume the sequencer. */
  public recover(): void {
    this.graph?.recover();
    this.isTapeStopped = false;
  }

  /**
   * Another backdrop came up: move on to another song at the next phrase boundary, the
   * backdrop's own one first if it has one.
   */
  public enterScene(scene: SceneId): void {
    const isChanging = this.conductor.enterScene(scene);
    // Before the first step there is nothing to finish: start the backdrop's music right away
    if (isChanging && this.currentStep === 0) this.skipSong();
  }

  /**
   * The listening stand holds the music to a song and, if `part` names one of its sections, to
   * that section, from the next bar line; the music then sounds as in a match even behind the
   * menus. Null song lets the game lead again.
   * @returns false if there is no such song or section (nothing changes)
   */
  public audition(songId: string | null, part: string | null = null): boolean {
    const { conductor } = this;
    if (songId === null) {
      conductor.pinTo(null);
      return true;
    }
    const songIndex = SONGS.findIndex((song) => song.id === songId);
    if (songIndex < 0) return false;
    const sectionIndex =
      part === null ? null : SONGS[songIndex].sections.findIndex((s) => s.name === part);
    if (sectionIndex === -1) return false;
    conductor.pinTo(songIndex, sectionIndex, this.wantedTier());
    // Before the first step there is nothing to finish: start the song right away
    if (this.currentStep === 0) conductor.advance();
    return true;
  }

  /** The way into the auditioned section again, from the next bar line. */
  public replayTransition(): void {
    this.conductor.replayTransition();
  }

  /** The listening stand silences a part of the arrangement, or brings it back. */
  public setLayerMuted(layer: MusicLayer, isMuted: boolean): void {
    if (isMuted) this.mutedLayers.add(layer);
    else this.mutedLayers.delete(layer);
  }

  /** The listening stand holds intensity, in [0, 1], where it says; null lets the game move it. */
  public pinIntensity(level: number | null): void {
    this.pinnedIntensity = level === null ? null : clamp(level, 0, 1);
  }

  /** The listening stand holds the climax build-up, in [0, 1]; null lets the game move it. */
  public pinClimax(level: number | null): void {
    this.pinnedClimax = level === null ? null : clamp(level, 0, 1);
  }

  /** Where the music is now. */
  public getPosition(): MusicPosition {
    const { conductor } = this;
    return { songId: conductor.song.id, part: conductor.section.name, bar: conductor.bar };
  }

  /** Another song, at random, from the next bar line. */
  public skipSong(): void {
    // The listening stand holds the song; skipping away would undo it
    if (this.conductor.isPinned) return;
    const { conductor } = this;
    conductor.skip(this.wantedTier());
    // Before the first step there is nothing to finish: start the new song right away
    if (this.currentStep === 0) conductor.advance();
  }

  /** Title of the song playing, or of the one it is about to change into. */
  public getSongTitle(): string {
    return this.conductor.upcomingSong.title;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.graph?.analyser ?? null;
  }

  /** The chord that is sounding right now; null before the music has started. */
  public getHarmony(): Harmony | null {
    return this.graph ? this.harmony.at(this.graph.context.currentTime) : null;
  }

  public dispose(): void {
    this.scheduler?.dispose();
    this.scheduler = null;
  }

  /** The kind of section the game calls for now. */
  private wantedTier(): Tier {
    return getWantedTier(
      this.gameState,
      this.intensity,
      this.climaxLevel,
      this.conductor.section.tier,
    );
  }

  /** The game's state as the music hears it: an audition sounds as in a match behind the menus. */
  private get gameState(): GameState {
    const { gameState } = this.state;
    return this.conductor.isPinned && gameState === 'menu' ? 'play' : gameState;
  }

  /** Plays the step at `time`. @returns its length in seconds */
  private playStep(time: number, graph: MusicGraph, arrangement: Arrangement): number {
    const { isMuted } = this.state;
    const { gameState } = this;
    graph.setMuted(isMuted);

    const target = getTargetIntensity({ ...this.state, gameState }, this.intensity);
    this.intensity =
      this.pinnedIntensity ?? stepIntensity(this.intensity, target, this.climaxLevel, gameState);

    const { conductor } = this;
    const stepInBar = this.currentStep % STEPS_PER_BAR;
    if (stepInBar === 0 && this.currentStep > 0) conductor.advance();
    if (stepInBar === PLAN_STEP) {
      conductor.plan(this.wantedTier());
    }

    const { song, section, bar } = conductor;
    const stepDuration = 60 / song.bpm / 4;
    const chord = chordAt(section, bar * STEPS_PER_BAR + stepInBar);

    // Remember chord changes (even while muted) so hits can be tuned to the audible chord
    if (stepInBar % PLAN_STEP === 0 || this.harmony.isEmpty) {
      this.harmony.push(time, { root: placeAbove(chord.root, BASS_LOW), chord: chord.triad });
    }

    if (this.isDropPending) {
      this.isDropPending = false;
      if (!isMuted) {
        arrangement.playDrop(time, chord, stepDuration);
      }
    }

    graph.setToneFilter(TONE_FILTER[gameState], time);
    graph.setEchoTime(stepDuration * ECHO_STEPS, time);

    if (!isMuted) {
      arrangement.playStep({
        time,
        stepDuration,
        song,
        section,
        bar,
        stepInBar,
        isLastBar: conductor.isLastBar,
        nextBarChord: conductor.nextBarChord,
        intensity: this.intensity,
        climaxLevel: this.climaxLevel,
        difficulty: this.state.difficulty,
      });
    }

    this.climaxLevel =
      this.pinnedClimax ?? followClimax(this.climaxLevel, this.gameClimaxLevel, stepDuration);
    this.currentStep++;
    return stepDuration;
  }
}
