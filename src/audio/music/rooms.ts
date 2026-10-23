/**
 * The space a song plays in (docs/AUDIO.md, "Микс"): its own reverb rather than one shared room,
 * so each track has a place of its own instead of the same haze on all of them. Each room is an
 * impulse generated in code (`createReverbImpulse`), how much of each stem goes into it, and how
 * dark its return is.
 */
export interface Room {
  /** s to -60 dB. */
  decay: number;
  /** s before the room answers: the larger the space, the later its first reflection. */
  preDelay: number;
  /** Hz, high-pass on the send: no kick or bass in the room, or it turns to mud. */
  lowCut: number;
  /** Hz, low-pass on the return: a dark room swallows its highs. */
  highCut: number;
  /** Level of the room in the mix. */
  return: number;
  /** Share of each stem sent into the room. */
  sends: { pads: number; melody: number; drums: number };
}

export const ROOMS = {
  // The room every song had before 5.6b: a middling plate, for songs that don't name one
  plate: {
    decay: 1.8,
    preDelay: 0.015,
    lowCut: 300,
    highCut: 12000,
    return: 0.35,
    sends: { pads: 0.5, melody: 0.35, drums: 0.12 },
  },
  // Stone and height: a long, bright tail on the choir and the arpeggios, the drums kept dry
  // so the four-on-the-floor stays a machine rather than a wash
  cathedral: {
    decay: 3.2,
    preDelay: 0.03,
    lowCut: 350,
    highCut: 9000,
    return: 0.38,
    sends: { pads: 0.6, melody: 0.4, drums: 0.08 },
  },
  // A night drive: a short plate that gives the gated snare its burst, the leads close
  night: {
    decay: 1.5,
    preDelay: 0.012,
    lowCut: 300,
    highCut: 10000,
    return: 0.35,
    sends: { pads: 0.45, melody: 0.3, drums: 0.18 },
  },
  // A band in a small studio: short and nearly dry, so the slap and the cutting guitar stay tight
  studio: {
    decay: 0.7,
    preDelay: 0.006,
    lowCut: 250,
    highCut: 11000,
    return: 0.3,
    sends: { pads: 0.35, melody: 0.22, drums: 0.12 },
  },
  // Rain on a narrow street: a long, dark fog the choir and the music box sink into
  fog: {
    decay: 3.4,
    preDelay: 0.04,
    lowCut: 400,
    highCut: 3500,
    return: 0.42,
    sends: { pads: 0.7, melody: 0.5, drums: 0.1 },
  },
  // Open air above the clouds: a late first reflection off far slopes, the flute and the drums
  // carried out into the distance alike
  valley: {
    decay: 2.6,
    preDelay: 0.07,
    lowCut: 300,
    highCut: 7000,
    return: 0.36,
    sends: { pads: 0.45, melody: 0.45, drums: 0.2 },
  },
  // An old stone temple: a short, bright answer that hand drums and mallets ring in
  stone: {
    decay: 1.2,
    preDelay: 0.02,
    lowCut: 250,
    highCut: 12000,
    return: 0.36,
    sends: { pads: 0.4, melody: 0.32, drums: 0.26 },
  },
} satisfies Record<string, Room>;

export type RoomName = keyof typeof ROOMS;

/** The room of a song that doesn't name one. */
export const DEFAULT_ROOM: RoomName = 'plate';
