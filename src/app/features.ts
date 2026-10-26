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
}

export const FEATURES: Features = { classicLook: false };
