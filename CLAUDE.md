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
```

All four checks (tests, types, lint, format) must pass before a commit; CI runs the same and
blocks the deploy otherwise. In the browser: `?debug` or F3 shows the FPS overlay and a menu of
backgrounds; `?bg=<scene>` pins a background (scene ids in `src/shared/scenes.ts`).

## Architecture

`src/app/Game.ts` is the composition root and the frame loop: it builds everything, routes match
events and builds the per-frame `RenderFrame` and `MusicState`.

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

Known hard-coded assumptions the roadmap's stage 0 removes: one ball, paddle 0 = player and
paddle 1 = AI, a global `WINNING_SCORE`, global `PADDLE` sizes, a variable simulation step.

## Extension points that exist today

- **Background:** a class implementing `Background` (`render/backgrounds/Background.ts`), listed
  in `createBackgrounds()` (`render/BackgroundRenderer.ts`) and its id in `SCENES`
  (`shared/scenes.ts`). Draw for both orientations; read `laserIntensity` through a floor so play
  stays lit; heat (`climax`/`celebration`) warms the palette.
- **Song:** an entry in `SONG_DEFS` (`audio/music/songs.ts`); `scene` ties it to a background.
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
