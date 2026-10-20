import { describe, expect, it } from 'vitest';
import { ChallengeJudge, ChallengeVerdict } from '@/match/ChallengeJudge';
import { ChallengeId, CHALLENGES } from '@/match/challenges';
import { DifficultyLevel } from '@/match/difficulty';
import { MatchEvent } from '@/match/MatchFlow';
import { Side } from '@/match/side';
import { ProfileStore } from '@/profile/ProfileStore';
import { StatsRecorder } from '@/profile/StatsRecorder';
import { EventBus } from '@/shared/EventBus';

/** A judge listening to a match the test plays by hand, the player on the left. */
const setup = (challenge: ChallengeId | null) => {
  const events = new EventBus<MatchEvent>();
  const verdicts: ChallengeVerdict[] = [];
  const judge = new ChallengeJudge({
    match: {
      isPlayerPaddle: (i) => i === 0,
      playerSide: 0,
      rules: challenge ? CHALLENGES[challenge].rules : { winningScores: [5, 5] },
    },
    onVerdict: (verdict) => verdicts.push(verdict),
  });
  judge.listenTo(events);
  judge.judge(challenge);

  const start = () => events.emit({ type: 'matchStart' });
  const hit = (paddleIndex: number, rally: number, isPowerShot = false) =>
    events.emit({
      type: 'paddleHit',
      paddleIndex,
      isPerfect: isPowerShot,
      x: 0,
      y: 0,
      speed: 400,
      rally,
      isPowerShot,
      chargedOverdrive: false,
    });
  const score = (side: Side, times = 1) => {
    for (let i = 0; i < times; i++) {
      events.emit({ type: 'score', scoringPlayerIndex: side, y: 0, isDemo: false });
    }
  };
  const gameOver = (winnerIndex: Side, scores: [number, number]) =>
    events.emit({ type: 'gameOver', winnerIndex, scores });

  return { events, judge, verdicts, start, hit, score, gameOver };
};

describe('judging a challenge', () => {
  it('passes a goal of winning on a win, and not on a loss', () => {
    const { verdicts, start, score, gameOver } = setup('warmUp');
    start();
    score(0, 3);
    gameOver(0, [3, 0]);
    start();
    score(0, 2);
    score(1, 3);
    gameOver(1, [2, 3]);

    expect(verdicts).toEqual([
      { challenge: 'warmUp', isPassed: true, progress: 3, target: 3 },
      { challenge: 'warmUp', isPassed: false, progress: 2, target: 3 },
    ]);
  });

  it('tells the verdict ahead of the match’s end, for the finale, and none outside an attempt', () => {
    const { judge, verdicts, start, score, gameOver } = setup('warmUp');
    expect(judge.verdictFor(0)).toBeNull();
    start();
    score(0, 2);
    score(1, 3);

    expect(judge.verdictFor(1)).toEqual({
      challenge: 'warmUp',
      isPassed: false,
      progress: 2,
      target: 3,
    });
    gameOver(1, [2, 3]);
    expect(verdicts).toHaveLength(1);
    expect(judge.verdictFor(1)).toBeNull();
  });

  it('fails a shutout won with a point lost', () => {
    const { verdicts, start, score, gameOver } = setup('shutout');
    start();
    score(1);
    score(0, 3);
    gameOver(0, [3, 1]);
    start();
    score(0, 3);
    gameOver(0, [3, 0]);

    expect(verdicts.map((v) => v.isPassed)).toEqual([false, true]);
  });

  it('measures a rally goal by the longest rally, both paddles’ hits counting', () => {
    const { verdicts, start, hit, gameOver } = setup('longRally');
    start();
    for (let rally = 1; rally <= 18; rally++) hit(rally % 2, rally);
    gameOver(1, [0, 0]);
    start();
    for (let rally = 1; rally <= 20; rally++) hit(rally % 2, rally);
    gameOver(0, [0, 0]);

    expect(verdicts).toMatchObject([
      { isPassed: false, progress: 18, target: 20 },
      { isPassed: true, progress: 20, target: 20 },
    ]);
  });

  it('counts only the player’s Overdrive shots, and wants the win too', () => {
    const { verdicts, start, hit, score, gameOver } = setup('overload');
    start();
    for (let i = 0; i < 5; i++) hit(0, 1, true);
    hit(1, 2, true);
    score(1, 7);
    gameOver(1, [0, 7]);
    start();
    for (let i = 0; i < 4; i++) hit(0, 1, true);
    for (let i = 0; i < 3; i++) hit(1, 2, true);
    score(0, 7);
    gameOver(0, [7, 0]);
    start();
    for (let i = 0; i < 5; i++) hit(0, 1, true);
    score(0, 7);
    gameOver(0, [7, 0]);

    expect(verdicts).toMatchObject([
      { isPassed: false, progress: 5 },
      { isPassed: false, progress: 4 },
      { isPassed: true, progress: 5, target: 5 },
    ]);
  });

  it('shows the attempt’s progress while it is played', () => {
    const { judge, start, hit, gameOver } = setup('longRally');
    expect(judge.progress).toBeNull();
    start();
    hit(0, 1);
    hit(1, 2);
    expect(judge.progress).toBe(2);
    gameOver(1, [0, 0]);
    expect(judge.progress).toBeNull();
  });

  it('judges nothing of a match left for the menu, or restarted halfway', () => {
    const { events, verdicts, start, score, gameOver } = setup('warmUp');
    start();
    score(0, 2);
    events.emit({ type: 'returnToMenu' });
    start();
    score(0, 2);
    start();
    score(0);
    gameOver(0, [1, 0]);

    // Only the last match was played to the end, from its own start
    expect(verdicts).toEqual([{ challenge: 'warmUp', isPassed: true, progress: 1, target: 3 }]);
  });

  it('judges no match that is not a challenge', () => {
    const { judge, verdicts, start, score, gameOver } = setup('warmUp');
    judge.judge(null);
    start();
    score(0, 5);
    gameOver(0, [5, 0]);

    expect(verdicts).toEqual([]);
  });
});

describe('the statistics and challenges', () => {
  it('leave a match out that is not counted', () => {
    const profile = new ProfileStore(null);
    const events = new EventBus<MatchEvent>();
    let isCounted = false;
    new StatsRecorder({
      profile,
      match: { isPlayerPaddle: (i) => i === 0, playerSide: 0 },
      getDifficulty: () => DifficultyLevel.NORMAL,
      isCounted: () => isCounted,
    }).listenTo(events);

    events.emit({ type: 'matchStart' });
    events.emit({ type: 'gameOver', winnerIndex: 0, scores: [3, 0] });
    expect(profile.current.stats.played).toBe(0);

    isCounted = true;
    events.emit({ type: 'matchStart' });
    events.emit({ type: 'gameOver', winnerIndex: 0, scores: [3, 0] });
    expect(profile.current.stats.played).toBe(1);
  });
});
