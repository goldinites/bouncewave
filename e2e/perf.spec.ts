import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { BenchResult } from './bench/bench';
import { FRAME_BUDGET } from './frameBudget';

/**
 * Every background with a match on it, timed on the frame bench (e2e/bench) and held to the
 * budget (e2e/frameBudget.ts). The times are written to test-results/frame-times.md (and a line
 * of them to frame-times.txt), which CI shows on the run's summary and as a notice, so a creeping
 * frame time shows long before it crosses the line.
 */
test('every background draws a frame within the budget', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('e2e/bench/index.html');
  await page.waitForFunction(() => window.benchResult !== undefined, null, { timeout: 200_000 });
  const result = (await page.evaluate(() => window.benchResult)) as BenchResult;

  const rows = Object.entries(result.scenes).map(
    ([scene, { render, simulation }]) =>
      `| ${scene} | ${render.p95.toFixed(1)} | ${render.mean.toFixed(1)} | ${simulation.mean.toFixed(3)} |`,
  );
  mkdirSync('test-results', { recursive: true });
  // One line for the run's notice, the table for its summary
  writeFileSync(
    'test-results/frame-times.txt',
    Object.entries(result.scenes)
      .map(([scene, { render }]) => `${scene} ${render.p95.toFixed(1)}`)
      .join(' · '),
  );
  writeFileSync(
    'test-results/frame-times.md',
    [
      `### Frame times (ms, pixel ratio ${result.pixelRatio})`,
      '',
      `Budget: drawing ${FRAME_BUDGET.RENDER_P95} at the 95th percentile, simulation ${FRAME_BUDGET.SIMULATION_MEAN} on average.`,
      '',
      '| Background | Drawing p95 | Drawing mean | Simulation mean |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
  );

  for (const [scene, { render, simulation }] of Object.entries(result.scenes)) {
    expect.soft(render.p95, `${scene}: drawing`).toBeLessThanOrEqual(FRAME_BUDGET.RENDER_P95);
    expect
      .soft(simulation.mean, `${scene}: simulation`)
      .toBeLessThanOrEqual(FRAME_BUDGET.SIMULATION_MEAN);
  }
});
