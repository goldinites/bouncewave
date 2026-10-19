import * as v from 'valibot';
import { CHALLENGE_IDS, ChallengeId } from '@/match/challenges';

/**
 * How far the player has got through the challenges: which they have passed. Every challenge is
 * open from the start; the later ones are hard enough to wait for the player's progression. Kept
 * as an object so what comes with a challenge later (its money reward, stage 6) can lie beside it.
 */
export interface ChallengeProgress {
  /** Every challenge passed at least once, in the order they open. */
  passed: ChallengeId[];
}

export function getEmptyChallengeProgress(): ChallengeProgress {
  return { passed: [] };
}

/** Known challenges only, each once, in the order they open: whatever else is dropped. */
const passedSchema = v.fallback(
  v.pipe(
    v.array(v.unknown()),
    v.transform((ids) => CHALLENGE_IDS.filter((id) => ids.includes(id))),
  ),
  () => [],
);

/** The progress as saved one is checked: a challenge it doesn't know is forgotten, not fatal. */
export const challengeProgressSchema = v.fallback(
  v.object({ passed: passedSchema }),
  getEmptyChallengeProgress,
) as unknown as v.GenericSchema<unknown, ChallengeProgress>;

/** Where a challenge stands for the player: passed, or still to pass (every one is open). */
export type ChallengeState = 'passed' | 'open';

export function challengeState(progress: ChallengeProgress, id: ChallengeId): ChallengeState {
  return progress.passed.includes(id) ? 'passed' : 'open';
}

/** Whether the player has passed every challenge there is. */
export const isEveryChallengePassed = (progress: ChallengeProgress): boolean =>
  progress.passed.length === CHALLENGE_IDS.length;

/** The challenge after `id` in the list, the one NEXT leads to; null after the last. */
export function nextChallenge(id: ChallengeId): ChallengeId | null {
  return CHALLENGE_IDS[CHALLENGE_IDS.indexOf(id) + 1] ?? null;
}

/** The progress with `id` passed too (as it was, if it already was). */
export function markPassed(progress: ChallengeProgress, id: ChallengeId): ChallengeProgress {
  if (progress.passed.includes(id)) return progress;
  return {
    ...progress,
    passed: CHALLENGE_IDS.filter((c) => c === id || progress.passed.includes(c)),
  };
}
