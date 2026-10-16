// Generates the iOS launch screens (pwa-assets.splash.config.ts) and writes their <link> tags
// into index.html, between <!-- splash:start --> and <!-- splash:end -->.
// The generator prints those tags with a "-light" in the file names that the files it writes
// don't have; they are fixed here, and any tag still pointing at a missing file stops the script.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CONFIG = 'pwa-assets.splash.config.ts';
const HTML = 'index.html';
const START = '<!-- splash:start -->';
const END = '<!-- splash:end -->';

const run = (bin, args) =>
  execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8', stdio: 'pipe' });

const output = run('node_modules/@vite-pwa/assets-generator/bin/pwa-assets-generator.mjs', [
  '--config',
  CONFIG,
]);

const links = output
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('<link rel="apple-touch-startup-image"'))
  .map((line) => line.replace(/-light-/, '-').replace(/">$/, '" />'));

if (links.length === 0) {
  throw new Error(`No launch screen links in the output of ${CONFIG}:\n${output}`);
}

for (const link of links) {
  const href = /href="\/([^"]+)"/.exec(link)?.[1];
  if (!href || !existsSync(`public/${href}`)) {
    throw new Error(`Launch screen link points at a missing file: ${link}`);
  }
}

const html = readFileSync(HTML, 'utf8');
const start = html.indexOf(START);
const end = html.indexOf(END);
if (start < 0 || end < start) throw new Error(`${HTML} has no ${START} … ${END} block`);

const block = links.map((link) => `    ${link}`).join('\n');
writeFileSync(HTML, `${html.slice(0, start + START.length)}\n${block}\n    ${html.slice(end)}`);
run('node_modules/prettier/bin/prettier.cjs', ['--write', HTML]);

console.info(`${links.length} launch screens written to ${HTML}`);
