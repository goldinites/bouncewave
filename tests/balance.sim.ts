import { it } from 'vitest';
import { CHALLENGE_IDS, CHALLENGES } from '@/match/challenges';
import { DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';
import { quickMatchRules } from '@/match/modes';
import { SKILL_IDS } from '@/match/skills/Skill';
import { PLAYERS, PlayerId, playerPointShare, SimReport, simulateMany } from './helpers/simulation';

/**
 * The balance report (npm run sim): AI against AI, the AI in the player's seat standing in for
 * players of four strengths (PLAYERS), and the tables the balancing steps decide by (4.7, 7.6–7.7,
 * 7.10). Seeded, so it reads the same every run until the game changes. SIM_MATCHES sets the
 * matches a cell (default 40: some 300 points, about ±6 points of share either way).
 */

const MATCHES = Number(process.env.SIM_MATCHES ?? 40);
const QUICK = quickMatchRules(5);
// A rally longer than this tires (the complaint 4.7 answers)
const LONG_RALLY = 30; // s

const LEVEL_NAMES: Record<DifficultyLevel, string> = {
  [DifficultyLevel.EASY]: 'Easy',
  [DifficultyLevel.NORMAL]: 'Normal',
  [DifficultyLevel.HARD]: 'Hard',
  [DifficultyLevel.INSANE]: 'Insane',
};

const PLAYER_IDS = Object.keys(PLAYERS) as PlayerId[];
const PLAYER_NAMES: Record<PlayerId, string> = {
  weak: 'Weak',
  average: 'Average',
  strong: 'Strong',
  expert: 'Expert',
};
// The level each player is a match for, as the levels were before step 4.7
const LEVEL_OF: Record<PlayerId, DifficultyLevel> = {
  weak: DifficultyLevel.EASY,
  average: DifficultyLevel.NORMAL,
  strong: DifficultyLevel.HARD,
  expert: DifficultyLevel.INSANE,
};

const write = (text = '') => process.stdout.write(`${text}\n`);
const percent = (share: number) => `${Math.round(share * 100)}%`;
const points = (delta: number) => `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}`;

/** A Markdown table, so the report can be pasted into the docs as it is. */
const table = (head: readonly string[], rows: readonly (readonly string[])[]) => {
  write(`| ${head.join(' | ')} |`);
  write(`| ${head.map(() => '---').join(' | ')} |`);
  for (const row of rows) write(`| ${row.join(' | ')} |`);
  write();
};

/** The value `share` of the way up the sorted `values`. */
const quantile = (values: readonly number[], share: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
};

it('reports the balance', () => {
  write(`\n# Balance report: ${MATCHES} matches a cell, quick matches to 5\n`);

  // Every player against every level: the steps between the levels (step 4.7 aims at some 15
  // points of share each for the average player), and the edge the player's Overdrive gives (the
  // CPU charges its own only at Hard and Insane)
  write("## Points the player wins: the player down, the CPU's level across\n");
  const shareAgainst = (player: PlayerId, playerOverdrive = true) =>
    DIFFICULTY_LEVELS.map((difficulty) =>
      percent(
        playerPointShare(
          simulateMany({ rules: QUICK, difficulty, player, playerOverdrive }, MATCHES),
        ),
      ),
    );
  table(
    ['player \\ CPU', ...DIFFICULTY_LEVELS.map((level) => LEVEL_NAMES[level])],
    [
      ...PLAYER_IDS.map((player) => [PLAYER_NAMES[player], ...shareAgainst(player)]),
      ['Average, no Overdrive', ...shareAgainst('average', false)],
    ],
  );

  // How long the rallies run, and how often the match is won, for each player at the level that
  // is a match for them: what a person playing at their own level sits through
  write('## Rallies, each player at their level\n');
  table(
    [
      'player at level',
      'matches won',
      'hits a point',
      'median, s',
      '90%, s',
      'longest, s',
      `over ${LONG_RALLY} s`,
    ],
    PLAYER_IDS.map((player) => {
      const difficulty = LEVEL_OF[player];
      const played = simulateMany({ rules: QUICK, difficulty, player }, MATCHES);
      const all = played.flatMap((report) => report.points);
      const seconds = all.map((point) => point.seconds);
      const hits = all.reduce((sum, point) => sum + point.hits, 0) / all.length;
      return [
        `${PLAYER_NAMES[player]} at ${LEVEL_NAMES[difficulty]}`,
        percent(played.filter((report) => report.winner === 0).length / played.length),
        hits.toFixed(0),
        quantile(seconds, 0.5).toFixed(0),
        quantile(seconds, 0.9).toFixed(0),
        Math.max(...seconds).toFixed(0),
        percent(seconds.filter((s) => s > LONG_RALLY).length / seconds.length),
      ];
    }),
  );

  // Each skill's worth: the player with it, and the CPU with it, against the share without.
  // The aim (docs/PROGRESSION.md): +3 to +5 points of share, never past +8
  write("## Skills: change in the player's share of points\n");
  const SKILL_PLAYERS: readonly PlayerId[] = ['average', 'strong'];
  const baseline = new Map(
    SKILL_PLAYERS.map((player) => [
      player,
      playerPointShare(
        simulateMany({ rules: QUICK, difficulty: LEVEL_OF[player], player }, MATCHES),
      ),
    ]),
  );
  table(
    [
      'skill',
      ...SKILL_PLAYERS.flatMap((player) => {
        const at = `${PLAYER_NAMES[player]} at ${LEVEL_NAMES[LEVEL_OF[player]]}`;
        return [`player's, ${at}`, `CPU's, ${at}`];
      }),
    ],
    SKILL_IDS.map((skill) => [
      skill,
      ...SKILL_PLAYERS.flatMap((player) => {
        const match = { rules: QUICK, difficulty: LEVEL_OF[player], player };
        const base = baseline.get(player)!;
        const mine = playerPointShare(simulateMany({ ...match, playerSkills: [skill] }, MATCHES));
        const theirs = playerPointShare(simulateMany({ ...match, cpuSkills: [skill] }, MATCHES));
        return [points(mine - base), points(theirs - base)];
      }),
    ]),
  );

  // Every challenge, by how often each player passes it: the list is the difficulty curve, so
  // the rates should fall down it. The dark and the invisible band hide nothing from the AI: the
  // challenges on them read easier here than they play
  write('## Challenges passed, by the player\n');
  const passes = (report: SimReport, id: (typeof CHALLENGE_IDS)[number]) =>
    CHALLENGES[id].goal.type === 'rally' ? report.reason === 'rally' : report.winner === 0;
  table(
    ['#', 'challenge', ...PLAYER_IDS.map((player) => PLAYER_NAMES[player])],
    CHALLENGE_IDS.map((id, i) => {
      const { rules, difficulty, paddles } = CHALLENGES[id];
      return [
        String(i + 1),
        id,
        ...PLAYER_IDS.map((player) => {
          const played = simulateMany({ rules, difficulty, player, paddles }, MATCHES);
          return percent(played.filter((report) => passes(report, id)).length / played.length);
        }),
      ];
    }),
  );
});
