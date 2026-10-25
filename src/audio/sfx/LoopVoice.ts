/** Where a held sound is heading: how loud, its filter, where it is across the court. */
export interface LoopTarget {
  volume: number;
  /** Hz: the middle of the band it plays in. */
  frequency: number;
  /** The band's width: high is thin. */
  q?: number;
  pan: number;
}

// How quickly a held sound follows its target: fast enough for a ball crossing the court in under
// a second, slow enough that frame-to-frame steps never click
const FOLLOW = 0.03; // s, time constant
// A held sound gone quiet for this long stops its source, to start afresh when next heard
const IDLE_STOP = 1; // s

/**
 * A sound held for as long as something lasts (the ball's air in the dark, a skate's glide): one
 * source looping through a filter, a gain and a panner, steered to a new target every frame and
 * silent between. Built on first use; a new audio context builds it again.
 */
export class LoopVoice {
  private nodes: {
    ac: AudioContext;
    source: AudioScheduledSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    panner: StereoPannerNode;
  } | null = null;
  private quietSince: number | null = null;
  private readonly make: (ac: AudioContext) => AudioScheduledSourceNode;
  private readonly filterType: BiquadFilterType;

  /**
   * @param make builds the source, looping
   * @param filterType the filter it plays through
   */
  constructor(make: (ac: AudioContext) => AudioScheduledSourceNode, filterType: BiquadFilterType) {
    this.make = make;
    this.filterType = filterType;
  }

  /** Heads for `target` from now, or for silence with null. */
  public update(ac: AudioContext, output: AudioNode, target: LoopTarget | null): void {
    try {
      if (!target) {
        this.fade(ac);
        return;
      }
      const nodes = this.build(ac, output);
      const now = ac.currentTime;
      this.quietSince = null;
      nodes.gain.gain.setTargetAtTime(target.volume, now, FOLLOW);
      nodes.filter.frequency.setTargetAtTime(target.frequency, now, FOLLOW);
      if (target.q !== undefined) nodes.filter.Q.setTargetAtTime(target.q, now, FOLLOW);
      nodes.panner.pan.setTargetAtTime(target.pan, now, FOLLOW);
    } catch {
      // A held sound that fails stays silent rather than break audio
    }
  }

  /** Fades out, and once quiet for a while frees its source. */
  private fade(ac: AudioContext): void {
    const nodes = this.nodes;
    if (!nodes) return;
    const now = ac.currentTime;
    if (this.quietSince === null) {
      this.quietSince = now;
      nodes.gain.gain.setTargetAtTime(0, now, FOLLOW);
    } else if (now - this.quietSince > IDLE_STOP) {
      this.stop();
    }
  }

  private build(ac: AudioContext, output: AudioNode) {
    if (this.nodes?.ac === ac) return this.nodes;
    this.stop();
    const source = this.make(ac);
    const filter = ac.createBiquadFilter();
    filter.type = this.filterType;
    const gain = ac.createGain();
    gain.gain.value = 0;
    const panner = ac.createStereoPanner();
    source.connect(filter).connect(gain).connect(panner).connect(output);
    source.start();
    this.nodes = { ac, source, filter, gain, panner };
    return this.nodes;
  }

  /** Stops the source at once; the next update builds it again. */
  public stop(): void {
    try {
      this.nodes?.source.stop();
      this.nodes?.panner.disconnect();
    } catch {
      // Already stopped
    }
    this.nodes = null;
    this.quietSince = null;
  }
}
