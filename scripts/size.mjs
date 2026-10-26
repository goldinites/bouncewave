// Checks a build's size against its budget: what a player downloads before the first frame (the
// scripts and styles index.html loads, gzipped as a server sends them), and the whole build. Run
// after a build: `npm run size` checks dist/, `npm run size -- dist-portal` the portal's.
// Portals judge a game by how fast it starts, so a change that makes the first load much heavier
// should cross a line in its own pull request. The sizes go on a CI run's summary.
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Calibrated on 2026-10-26 (1.7.0): the first load is 150 KB gzipped (the game's script 144,
 * its styles 6), the whole build 2.0 MB. Raise a budget only for a reason, in the commit that
 * needs it.
 */
const SIZE_BUDGET = {
  FIRST_LOAD_GZIP: 200 * 1024, // bytes: index.html's scripts and styles, gzipped
  BUILD: 2.5 * 1024 * 1024, // bytes: every file of the build, as it lies on disk
};
const LARGEST_SHOWN = 5; // files listed, so what made the build heavy is seen at once

const dir = process.argv[2] ?? 'dist';

/** Every file under `path`, recursively. */
const files = (path) =>
  readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? files(child) : [child];
  });

const html = readFileSync(join(dir, 'index.html'), 'utf8');
const firstLoad = [...html.matchAll(/(?:src|href)="(?:\.\/|\/bouncewave\/)?([^"]+\.(?:js|css))"/g)]
  .map((match) => match[1])
  .filter((path, i, all) => all.indexOf(path) === i);
if (firstLoad.length === 0) throw new Error(`No scripts or styles in ${dir}/index.html`);
const firstLoadGzip = firstLoad.reduce(
  (sum, path) => sum + gzipSync(readFileSync(join(dir, path)), { level: 9 }).length,
  0,
);

const sizes = files(dir).map((path) => ({ path: relative(dir, path), bytes: statSync(path).size }));
const build = sizes.reduce((sum, { bytes }) => sum + bytes, 0);

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const rows = [
  ['First load, gzipped', firstLoadGzip, SIZE_BUDGET.FIRST_LOAD_GZIP],
  ['Whole build', build, SIZE_BUDGET.BUILD],
];
const report = [
  `| ${dir} | Size | Budget |`,
  '| --- | --- | --- |',
  ...rows.map(([name, bytes, budget]) => `| ${name} | ${kb(bytes)} | ${kb(budget)} |`),
  '',
  `Largest files: ${sizes
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, LARGEST_SHOWN)
    .map(({ path, bytes }) => `${path} ${kb(bytes)}`)
    .join(', ')}`,
].join('\n');
console.info(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);

const over = rows.filter(([, bytes, budget]) => bytes > budget);
for (const [name, bytes, budget] of over) {
  console.error(`${name}: ${kb(bytes)} is over its budget of ${kb(budget)}`);
}
if (over.length > 0) process.exit(1);
