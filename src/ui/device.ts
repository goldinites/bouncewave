/** Whether the device is played by touch first (a phone, a tablet), not with keys and a mouse. */
export const isTouchFirst = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** Whether the game runs installed, as an app of its own (full screen on a phone). */
export const isInstalled = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches);

/** Whether the court is turned for a portrait phone (as InputHandler.isRotated has it). */
export const isCourtTurned = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(orientation:portrait) and (max-width:900px)').matches;

/** Whether the player asked for less motion: examples stand still. */
export const isMotionReduced = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
