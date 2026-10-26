/**
 * What this build of the game offers, beyond what every build has.
 */
export interface Features {
  /**
   * The classic look, the easter egg that turns the game into Pong as it was (`easterEgg/`). Off
   * for now (ROADMAP 8.2): it is Pong's own look, which the web portals take for a clone's, and
   * PONG is Atari's mark; the Steam edition brings it back as a homage.
   */
  readonly classicLook: boolean;
  /**
   * The story: its mode on the PLAY menu. Off for now (ROADMAP 8.2): the web edition has no
   * story, and until the story is made its button would only be a promise; the Steam edition
   * brings it.
   */
  readonly story: boolean;
}

export const FEATURES: Features = { classicLook: false, story: false };
