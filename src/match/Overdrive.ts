/** Overdrive: perfect hits in a row charge the player's next hit into a power shot. */
export const OVERDRIVE = {
  CHARGE: 3, // perfect hits in a row to charge it
  BOOST: 0.6, // extra speed share of the power shot, fading out...
  BOOST_DURATION: 1.4, // ...over this many seconds
} as const;

/**
 * The player's Overdrive meter. Every perfect hit adds a charge and any other hit by the player
 * empties it; points in between don't, so a streak can carry over. Once full, the player's very
 * next hit, perfect or not, is a power shot and the meter starts over.
 */
export class Overdrive {
  private _charge = 0;

  /** Perfect hits in the current streak, up to OVERDRIVE.CHARGE. */
  public get charge(): number {
    return this._charge;
  }

  public get isCharged(): boolean {
    return this._charge >= OVERDRIVE.CHARGE;
  }

  /**
   * Call on every hit by the player.
   * @returns whether this hit is a power shot
   */
  public onHit(isPerfect: boolean): boolean {
    if (this.isCharged) {
      this._charge = 0;
      return true;
    }
    this._charge = isPerfect ? this._charge + 1 : 0;
    return false;
  }

  public reset(): void {
    this._charge = 0;
  }
}
