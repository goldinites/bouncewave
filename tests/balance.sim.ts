import { it } from 'vitest';
import { CHALLENGE_IDS, CHALLENGES } from '@/match/challenges';
import { DIFFICULTY_LEVELS, DifficultyLevel } from '@/match/difficulty';
import { quickMatchRules } from '@/match/modes';
import { SKILL_IDS } from '@/match/skills/Skill';
import { playerPointShare, SimReport, simulateMany } from './helpers/simulation';

/**
 * The balance report (npm run sim): AI against AI, the AI in the player's seat playing at each
 * level in turn, and the tables the balancing steps decide by (4.7, 6.6–6.7, 6.10). Seeded, so it
 * reads the same every run until the game changes. SIM_MATCHES sets the matches a cell
 * (default 40: some 300 points, about ±6 points of share either way).
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

  // Every level against every level: the steps between them, and the edge the player's Overdrive
  // gives (the CPU charges its own only at Hard and Insane)
  write("## Points the player wins: the player's level down, the CPU's across\n");
  table(
    ['player \\ CPU', ...DIFFICULTY_LEVELS.map((level) => LEVEL_NAMES[level])],
    [
      ...DIFFICULTY_LEVELS.map((player) => [
        LEVEL_NAMES[player],
        ...DIFFICULTY_LEVELS.map((difficulty) =>
          percent(playerPointShare(simulateMany({ rules: QUICK, difficulty, player }, MATCHES))),
        ),
      ]),
      [
        'same, no Overdrive',
        ...DIFFICULTY_LEVELS.map((level) =>
          percent(
            playerPointShare(
              simulateMany(
                { rules: QUICK, difficulty: level, player: level, playerOverdrive: false },
                MATCHES,
              ),
            ),
          ),
        ),
      ],
    ],
  );

  // How long the rallies run between equals
  write('## Rallies between equals\n');
  table(
    ['level', 'hits a point', 'median, s', '90%, s', 'longest, s', `over ${LONG_RALLY} s`],
    DIFFICULTY_LEVELS.map((level) => {
      const played = simulateMany({ rules: QUICK, difficulty: level, player: level }, MATCHES);
      const all = played.flatMap((report) => report.points);
      const seconds = all.map((point) => point.seconds);
      const hits = all.reduce((sum, point) => sum + point.hits, 0) / all.length;
      return [
        LEVEL_NAMES[level],
        hits.toFixed(0),
        quantile(seconds, 0.5).toFixed(0),
        quantile(seconds, 0.9).toFixed(0),
        Math.max(...seconds).toFixed(0),
        percent(seconds.filter((s) => s > LONG_RALLY).length / seconds.length),
      ];
    }),
  );

  // Each skill's worth, against an equal opponent: the player with it, and the CPU with it.
  // The aim (docs/PROGRESSION.md): +3 to +5 points of share, never past +8
  write("## Skills: change in the player's share of points, between equals\n");
  const SKILL_LEVELS = [DifficultyLevel.NORMAL, DifficultyLevel.HARD];
  const baseline = new Map(
    SKILL_LEVELS.map((level) => [
      level,
      playerPointShare(simulateMany({ rules: QUICK, difficulty: level, player: level }, MATCHES)),
    ]),
  );
  table(
    [
      'skill',
      ...SKILL_LEVELS.flatMap((level) => [
        `player's, ${LEVEL_NAMES[level]}`,
        `CPU's, ${LEVEL_NAMES[level]}`,
      ]),
    ],
    SKILL_IDS.map((skill) => [
      skill,
      ...SKILL_LEVELS.flatMap((level) => {
        const match = { rules: QUICK, difficulty: level, player: level };
        const base = baseline.get(level)!;
        const mine = playerPointShare(simulateMany({ ...match, playerSkills: [skill] }, MATCHES));
        const theirs = playerPointShare(simulateMany({ ...match, cpuSkills: [skill] }, MATCHES));
        return [points(mine - base), points(theirs - base)];
      }),
    ]),
  );

  // Every challenge, by how often the AI in the player's seat passes it at each level: the list
  // is the difficulty curve, so the rates should fall down it. The dark and the invisible band
  // hide nothing from the AI: the challenges on them read easier here than they play
  write("## Challenges passed, by the player's level\n");
  const passes = (report: SimReport, id: (typeof CHALLENGE_IDS)[number]) =>
    CHALLENGES[id].goal.type === 'rally' ? report.reason === 'rally' : report.winner === 0;
  table(
    ['#', 'challenge', ...DIFFICULTY_LEVELS.map((level) => LEVEL_NAMES[level])],
    CHALLENGE_IDS.map((id, i) => {
      const { rules, difficulty, paddles } = CHALLENGES[id];
      return [
        String(i + 1),
        id,
        ...DIFFICULTY_LEVELS.map((player) => {
          const played = simulateMany({ rules, difficulty, player, paddles }, MATCHES);
          return percent(played.filter((report) => passes(report, id)).length / played.length);
        }),
      ];
    }),
  );
});
