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
 *
 * Implants come with a core (docs/PROGRESSION.md, "Energy"): the meter's charges are then also
 * the implants' energy, which they spend. Its owner's other hit costs one charge rather than
 * all of them, but breaks the streak; the power shot still takes OVERDRIVE.CHARGE perfect hits
 * in a row. Without a core the energy and the streak are always the same.
 */
export class Overdrive {
  private _charge = 0;
  private _streak = 0;
  private hasCore = false;

  /** Charges on the meter, up to OVERDRIVE.CHARGE: the energy implants spend. */
  public get charge(): number {
    return this._charge;
  }

  /** Perfect hits in a row on the meter, up to its charges. */
  public get streak(): number {
    return this._streak;
  }

  public get isCharged(): boolean {
    return this._streak >= OVERDRIVE.CHARGE;
  }

  /** Puts an implants' core in the meter, or takes it out (a match's participant brings it). */
  public useCore(hasCore: boolean): void {
    this.hasCore = hasCore;
  }

  /**
   * Call on every hit by the player.
   * @returns whether this hit is a power shot
   */
  public onHit(isPerfect: boolean): boolean {
    if (this.isCharged) {
      this.reset();
      return true;
    }
    if (isPerfect) {
      this._charge = Math.min(OVERDRIVE.CHARGE, this._charge + 1);
      this._streak = Math.min(this._charge, this._streak + 1);
    } else {
      this._charge = this.hasCore ? Math.max(0, this._charge - 1) : 0;
      this._streak = 0;
    }
    return false;
  }

  /**
   * Spends `charges` of energy, if the meter holds them; a streak can't outlast the charges it
   * lit, so spending from a full meter costs the power shot.
   * @returns whether they were spent
   */
  public spend(charges: number): boolean {
    if (this._charge < charges) return false;
    this._charge -= charges;
    this._streak = Math.min(this._streak, this._charge);
    return true;
  }

  public reset(): void {
    this._charge = 0;
    this._streak = 0;
  }
}
