# BounceWave — guide for Claude

Synthwave Pong in TypeScript: Canvas 2D rendering, procedural Web Audio music, DOM menus and
Preact screens, an installable offline PWA. Played at https://goldinites.github.io/bouncewave/.

- The user writes in Russian: answer in Russian. Code, comments, commits and PRs are in English.
- **The development plan is [docs/ROADMAP.md](docs/ROADMAP.md).** Read it before any roadmap
  work; it holds the stages, each step's scope, its status and the agreed decisions.
- Review every new requirement of the user's, and every step of the plan, as a professional game
  designer and point out objectively bad decisions before building them (how: `/roadmap-step`,
  step 1a).
- Skills for recurring jobs: `/roadmap-step` (carry out the next step of the plan), `/release`
  (ship a version to GitHub Pages).

## Commands

```sh
npm run dev           # http://localhost:3000/bouncewave/ (base path is /bouncewave/)
npm test              # vitest, happy-dom
npx tsc --noEmit -p . # types (npm run build also builds)
npm run lint
npm run format:check  # prettier, Markdown included; npm run format fixes
npm run test:e2e      # Playwright smoke: desktop, phone portrait and landscape (CI runs it too)
npm run test:visual   # every background vs its saved picture in e2e/__screenshots__ (local only)
```

All four checks (tests, types, lint, format) and the smoke must pass before a commit; CI runs
them and blocks the deploy otherwise. Run `test:visual` after anything that can change what a
background draws; its baselines are Windows renders of `e2e/stand` (seeded randomness, fixed
time). Update them with `npm run test:visual -- --update-snapshots` only for an intended change,
after showing the user the new pictures. In the browser: `?debug` or F3 shows the FPS overlay and a menu of
backgrounds; `?bg=<scene>` pins a background (scene ids in `src/shared/scenes.ts`);
`?challenge=<id>` makes every match that challenge (ids in `src/match/challenges.ts`), its last
verdict shown in the debug overlay.

## Architecture

**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** has the layers, what may import what, one frame
step by step, the match's building blocks and how to add each kind of thing (background, song,
setting, paddle, rules, lineup, a listener to the match). Read it before adding a feature.

`src/app/Game.ts` is the composition root and the frame loop. `src/match/` is the game itself
(rules, simulation, AI); `fx/`, `render/`, `audio/`, `ui/` present it; `input/` feeds it;
`settings/`, `i18n/` serve everything; `profile/` saves what outlasts a visit (versioned, with
migrations); `shared/` imports nothing from the project.

Rules that keep it clean (the first two are enforced by `tests/architecture.test.ts`):

- `match/` imports only `match/` and `shared/`; `shared/` imports nothing from the project.
- The match reports through `MatchEvent`s on `Game`'s `matchEvents` (`shared/EventBus.ts`);
  whatever reacts to it subscribes itself (`listenTo(events)`) and never changes the outcome. A
  listener that throws is reported; the rest still hear the event.
- The match runs in fixed steps of 1/240 s (`app/FixedStep.ts`) with injected randomness, so a
  seed and inputs replay it; presentation may use `Math.random`. Draw `ball.drawX/drawY` and
  `paddle.drawY` (between the last two steps), never `x`/`y`.
- A match is `MatchRules` (`flow.rules`: winning score, Overdrive, balls) played by a `Lineup`
  (a `PaddleController` and an Overdrive flag per paddle). Never read `WINNING_SCORE`, never
  branch on "paddle 0 is the player": ask the rules and the lineup.
- Paddles are a list, each with a `side` and a `PaddleSpec` (`paddle.spec`: size, perfect zone,
  power, spin, speed); read sizes from the spec, never the global `PADDLE`. Points belong to the
  side (`flow.scores`). Balls are a list (`flow.balls`); the first ball out ends the point; the
  camera and the drama follow `flow.leadBall`.
- Everything with listeners or timers has `dispose()`; DOM listeners go through an
  `AbortController`.
- Every new string exists in both languages; every new screen effect honours
  `prefers-reduced-motion`; everything works on a phone in either orientation (`isRotated`: the
  stage is turned in CSS on a portrait phone).
- Outside the match the left side is still taken to be the player (whose win the finale and
  menus show, whose Overdrive meter is drawn), until local multiplayer (3.2).

## Code style

- Comments say why, in full sentences, as densely as the surrounding code; tuning constants are
  grouped in `UPPER_SNAKE` objects with units in comments.
- `@/` alias for imports; `private readonly` where possible; no default exports.
- Tests live in `tests/*.test.ts`; canvas and audio fakes are in `tests/helpers/`.

## Git

- Work on a branch (`feature/…`, `fix/…`, `ci/…`, `chore/…`, `foundation/…`), never on `main`;
  `main` changes only through merged pull requests.
- Commit messages: an imperative subject line describing the change for a player or developer, a
  blank line, then a wrapped body on what was wrong and what changed. End with the
  `Co-Authored-By` line from the session's attribution.
- `gh` is not installed: push the branch and give the user the
  `https://github.com/goldinites/bouncewave/pull/new/<branch>` link with a PR description.
