# BounceWave — guide for Claude

Synthwave Pong in TypeScript: Canvas 2D rendering, procedural Web Audio music, DOM menus, an
installable offline PWA. Played at https://goldinites.github.io/bouncewave/.

- The user writes in Russian: answer in Russian. Code, comments, commits and PRs are in English.
- **The development plan is [docs/ROADMAP.md](docs/ROADMAP.md).** Read it before any roadmap
  work; it holds the stages, each step's scope, its status and the agreed decisions.
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
backgrounds; `?bg=<scene>` pins a background (scene ids in `src/shared/scenes.ts`).

## Architecture

`src/app/Game.ts` is the composition root and the frame loop: it builds everything, connects the
listeners to the match's events and builds the per-frame `RenderFrame` and `MusicState`.

| Directory       | Owns                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/match/`    | Rules and simulation: `MatchFlow` (phases, serve, score, finale), `Physics`, `Paddle`, `Ball`, `AiController`/`AiForm`, `difficulty`, `Overdrive`, `config` (sizes) |
| `src/fx/`       | Presentation reacting to match events: `EffectsDirector` and its parts (drama, climax, paddle fx, particles, fireworks)                                             |
| `src/render/`   | `Renderer` (frame, camera, overlays), `BackgroundRenderer` + `backgrounds/`, court/entity/HUD/final-score renderers, `SpriteCache`, `AdaptiveResolution`            |
| `src/audio/`    | `AudioEngine` (owns the AudioContext), `music/` (engine, `Conductor`, `songs.ts`, instruments), `sfx/`                                                              |
| `src/ui/`       | DOM menus: `UIManager` (renders button lists), `MenuController` (which menu), `NowPlaying`, `BootScreen`                                                            |
| `src/input/`    | `InputHandler`: keyboard, pointer, touch, portrait rotation                                                                                                         |
| `src/settings/` | `SETTINGS` (declarative), `SettingsStore` (subscribe), storage                                                                                                      |
| `src/i18n/`     | `translations.ts` (typed schema, en + ru), `I18nManager`                                                                                                            |
| `src/shared/`   | palette, math, scene ids, fonts — imports nothing from the project                                                                                                  |

Rules that keep it clean:

- `match/` imports only `match/` and `shared/`: the rules never know about pixels, sound or DOM.
  The match reports what happened as `MatchEvent`s; `fx/` turns them into effects.
- Effects are presentation only and must never change the outcome; a failing effect is caught and
  reported, the match goes on.
- Randomness in the simulation is injected (`random` in `MatchFlow`, `AiController`,
  `Ball.serve`); presentation may use `Math.random`.
- Everything with listeners or timers has `dispose()`; listeners go through an `AbortController`.
- Every new string exists in both languages; every new screen effect honours
  `prefers-reduced-motion`; everything works on a phone in either orientation (`isRotated`: the
  stage is turned in CSS on a portrait phone).

- The match runs in fixed steps of 1/240 s (`app/FixedStep.ts`): `Game` feeds frame time in,
  `MatchFlow.update` runs once per step, and the same seed and inputs replay the same match.
  Renderers draw `ball.drawX/drawY` and `paddle.drawY` (set by `MatchFlow.interpolate` between
  the last two steps), never `x`/`y`; `fx/` may read the simulated positions.

- A match is played under `MatchRules` (`match/rules.ts`: winning score, Overdrive on or off),
  given to `MatchFlow.startMatch` and read back as `flow.rules`; `STANDARD_RULES` is the classic
  match. Read the winning score and the deciding point from the rules, never from
  `WINNING_SCORE`.

- The court has any number of paddles, each playing for a `side` (`match/side.ts`: 0 left,
  1 right; at least one a side). Points belong to the side and are kept by the match
  (`flow.scores`), never by a paddle. A `paddleIndex` is a paddle's place in the match's list.
- Who plays each paddle is the match's `Lineup` (`MatchFlow.ts`): a `PaddleController` per
  paddle (`match/PaddleController.ts`: `HumanController`, `AiPaddleController` for the demo
  or the CPU) and whether it has Overdrive. Never branch on "paddle 0 is the player" in the
  match; ask the lineup.

- The rules say how many balls are in play (`rules.balls`); the match keeps them
  (`flow.balls`, the first is `deps.ball`) and the first ball out ends the point for all of
  them. Draw every ball in `frame.balls`; the camera and the drama follow `flow.leadBall`.

- Every paddle carries a `PaddleSpec` (`match/PaddleSpec.ts`: size, perfect zone, power, spin,
  speed; `STANDARD_PADDLE` by default) as `paddle.spec`. Read a paddle's size and hitting from
  its spec, never from the global `PADDLE` (which only lays out the court).

- Match events go out on `Game`'s `matchEvents` (`shared/EventBus.ts`): to react to the match,
  give the class a `listenTo(events)` that subscribes (`subscribe`, or `on(type)`), and call it
  where `Game` wires the effects and the menus. A listener that throws is reported, the rest
  still hear the event.

Outside the match the left side is still taken to be the player (whose win the finale and
menus show, whose Overdrive meter is drawn).

## Extension points that exist today

- **Background:** a class implementing `Background` (`render/backgrounds/Background.ts`), listed
  in `createBackgrounds()` (`render/BackgroundRenderer.ts`) and its id in `SCENES`
  (`shared/scenes.ts`). Draw for both orientations; read `laserIntensity` through a floor so play
  stays lit; heat (`climax`/`celebration`) warms the palette.
- **Song:** an entry in `SONG_DEFS` (`audio/music/songs.ts`); `scene` ties it to a background.
- **Paddle kind:** a `PaddleSpec` (trade-offs as multipliers against `STANDARD_PADDLE`), given
  to `new Paddle(side, x, color, spec)`.
- **Setting:** a field in `UserSettings` plus an entry in `SETTINGS`, an entry in `SETTINGS_MENU`
  (`ui/MenuController.ts`) and its texts in `translations.ts`.

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
