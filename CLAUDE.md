# BounceWave — guide for Claude

Synthwave Pong in TypeScript: Canvas 2D rendering, procedural Web Audio music, menus as Preact
screens, an installable offline PWA. Played at https://goldinites.github.io/bouncewave/.

- The user writes in Russian: answer in Russian. Code, comments, commits and PRs are in English.
- **The development plan is [docs/ROADMAP.md](docs/ROADMAP.md).** Read it before any roadmap
  work; it holds the stages, each step's scope, its status and the agreed decisions.
- Review every new requirement of the user's, and every step of the plan, as a professional game
  designer and point out objectively bad decisions before building them (how: `/roadmap-step`,
  step 1a).
- Skills for recurring jobs: `/roadmap-step` (carry out the next step of the plan), `/release`
  (ship a version to GitHub Pages), `/compose-track` (write a soundtrack track by ear with the
  user, as `docs/AUDIO.md` "Как делаем трек" describes).

## Commands

```sh
npm run dev           # http://localhost:3000/bouncewave/ (base path is /bouncewave/)
npm test              # vitest, happy-dom
npx tsc --noEmit -p . # types (npm run build also builds)
npm run lint
npm run format:check  # prettier, Markdown included; npm run format fixes
npm run test:e2e      # Playwright smoke: desktop, phone portrait and landscape (CI runs it too)
npm run test:perf     # every background's frame time vs e2e/frameBudget.ts (CI runs it too)
npm run test:visual   # every background vs its saved picture in e2e/__screenshots__ (local only)
npm run sim           # balance report, AI against AI: levels, rallies, skills, challenges (local only)
npm run loudness -- <song-id> ...  # each part's loudness and the `level` change to -25 dB (local only)
```

All four checks (tests, types, lint, format), the smoke and the frame budget must pass before a
commit; CI runs them and blocks the deploy otherwise. Run `test:perf` after anything that can make
a frame heavier (a background, a layer, an effect, the simulation); raise a budget only for a
reason, in the commit that needs it. Run `npm run sim` (a few minutes; `SIM_MATCHES=120` for finer numbers) after anything that
changes the balance — a level, a skill, a challenge — and quote its tables. Run `test:visual` after anything that can change what a
background draws; its baselines are Windows renders of `e2e/stand` (seeded randomness, fixed
time). Update them with `npm run test:visual -- --update-snapshots` only for an intended change,
after showing the user the new pictures. In the browser: `?debug` or F3 shows the debug dock (the FPS line,
then a tab each for backgrounds, skills, modifiers and the sound stand); `?bg=<scene>` pins a background (scene ids in `src/shared/scenes.ts`);
`?challenge=<id>` makes every match that challenge (ids in `src/match/challenges.ts`), its last
verdict shown in the debug overlay; `?skills=arc,analyzer,reflex` gives the player those skills in every
match against the CPU, `?cpuSkills=` the CPU (ids in `src/match/skills/Skill.ts`); the debug
overlay has switches for both and counts their uses; `?mods=wind,darkness` plays quick matches with
those modifiers (ids in `src/match/modifiers/Modifier.ts`), also switched in the debug overlay;
`?song=neon-cathedral&part=chorus&mute=drums` holds the music to a song, its part and layers
(`part=whole-form` plays the whole form in order, peaks included; `&lead=sax`, `&bass=bassSlap`,
`&pad=choir`, `&kit=japan` swap the lead, bass, pad and kit on any song (the wider palette,
`src/audio/music/palette.ts`); the debug overlay's sound stand, which also plays every action sound; song ids are titles in kebab case);
`?tutorial=perfect` starts the tutorial at that step (ids in `src/match/tutorial.ts`).

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
  power, steer, speed); read sizes from the spec, never the global `PADDLE`. Points belong to the
  side (`flow.scores`). Balls are a list (`flow.balls`); the first ball out ends the point; the
  camera and the drama follow `flow.leadBall`.
- Everything with listeners or timers has `dispose()`; DOM listeners go through an
  `AbortController`.
- Every new string exists in both languages; every new screen effect honours
  `prefers-reduced-motion`; everything works on a phone in either orientation (`isRotated`: the
  stage is turned in CSS on a portrait phone).
- Every paddle that charges Overdrive draws its meter (`flow.overdriveCharges`): a person's,
  and in a quick match the CPU's at Hard and Insane (`rules.cpuOverdrive`); the classic look has
  no Overdrive and no skills at all. In a match of two
  (`Game`'s `isTwoPlayers`, `flow.isTwoPlayer`) the end names the winner and is always a win;
  otherwise outside the match the left side is still taken to be the player (whose win the
  finale and menus show).

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
