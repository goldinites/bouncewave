/*
 * The videos the video stand films (`npm run video -- <id>`, ROADMAP 7.3), as data: a song, a
 * format, and shots cut on the song's bar lines. Each shot is a scripted rally on the game's own
 * simulation, effects and renderer.
 */

/** How a paddle meets the ball: off its centre (an angle), in its perfect zone, or not at all. */
export type Stroke = 'plain' | 'perfect' | 'miss';

/** Words over the picture, from a beat of the shot for so many beats. */
export interface Title {
  text: string;
  beat: number;
  beats: number;
}

/** One take: a rally on a background, as many bars of the song long. */
export interface Shot {
  /** A background (scene ids in src/shared/scenes.ts). */
  scene: string;
  bars: number;
  /**
   * Each side's strokes, hit by hit; the last one goes on repeating. The left side is the
   * player's, with Overdrive (three perfect hits in a row charge it, the next hit is the shot).
   */
  left: Stroke[];
  right: Stroke[];
  /** The first point wins the match: its finale, and its replay if it is worth one. */
  win?: boolean;
  /** The left side's power shot goes past the right paddle, whatever its strokes say. */
  finish?: 'power';
  /** Stretches played slowed, seconds from the shot's start, at `scale` of the speed. */
  slow?: { from: number; to: number; scale: number }[];
  titles?: Title[];
  /** The match's level: how fast the ball gets. Hard if left out. */
  level?: 'easy' | 'normal' | 'hard' | 'insane';
}

export interface Video {
  id: string;
  /** Its song (an id: the title in kebab case), played as in a match from its first bar. */
  song: string;
  /** 9:16 for Shorts, TikTok, Telegram; 16:9 for Steam and the portals. */
  format: 'vertical' | 'wide';
  shots: Shot[];
}

/** A rally that builds up to a power shot: a plain hit, then perfect ones. */
const BUILD_UP: Stroke[] = ['plain', 'perfect'];

export const VIDEOS: Video[] = [
  {
    // The stand's own check, and the first short: a rally heating up, then Overdrive to win it
    id: 'overdrive',
    song: 'neon-cathedral',
    format: 'vertical',
    shots: [
      { scene: 'lasers', bars: 2, left: ['plain'], right: ['plain'] },
      {
        scene: 'neonCity',
        bars: 10,
        level: 'insane',
        left: BUILD_UP,
        right: ['plain'],
        win: true,
        finish: 'power',
        titles: [{ text: 'OVERDRIVE', beat: 24, beats: 6 }],
      },
    ],
  },
];

/** The same videos in the other format. */
export const wide = (video: Video): Video => ({ ...video, id: `${video.id}-wide`, format: 'wide' });
