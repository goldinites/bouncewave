# BounceWave architecture

How the game is put together, which part may depend on which, and how to add things without
editing the code that is already there. `CLAUDE.md` keeps a short summary; the plan for what
comes next is in [ROADMAP.md](ROADMAP.md).

## The big picture

```
            input ──► ┌──────────────┐  events (EventBus)  ┌───────────────┐
                      │  match/      │ ──────────────────► │ fx/  ui/      │
 Game (app/) ──────►  │  rules +     │                     │ (effects,     │
  frame loop          │  simulation  │ ◄── state, read ─── │  menus)       │
                      └──────────────┘    every frame      └───────────────┘
                             │                                     │
                             ▼                                     ▼
                      render/ (canvas)  ◄── RenderFrame ──  audio/ (music, sfx)
```

- **`match/` is the game itself**: rules, simulation, AI. It knows nothing about pixels, sound or
  the DOM. It tells the world what happened through events and lets everyone read its state.
- **Everything else is presentation or plumbing**: it reacts to the match's events (`fx/`,
  `ui/`), draws its state (`render/`), plays it (`audio/`), or feeds it input (`input/`).
- **`app/Game.ts` is the composition root**: it builds every part, connects the listeners to the
  match's events, and runs the frame loop.

## Layers and their dependencies

| Directory              | Owns                                                                  | May import                                          |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `shared/`              | palette, math, fonts, scene ids, `EventBus`                           | nothing in the project                              |
| `match/`               | rules, simulation, AI, paddles, balls, sides                          | `match/`, `shared/`                                 |
| `settings/`            | the player's settings and quick-match setup                           | `match/`, `i18n/` (language), `shared/`             |
| `profile/`             | everything saved between visits: versions, migrations, statistics     | `settings/`, `match/` (events), `shared/`           |
| `i18n/`                | texts in every language                                               | `match/` (difficulty, modes)                        |
| `input/`               | keyboard, pointer, touch, portrait rotation                           | `match/`, `shared/`                                 |
| `audio/`               | the AudioContext, procedural music, sound effects                     | `match/`, `shared/`                                 |
| `render/`              | the canvas: backgrounds, court, paddles, balls, HUD, camera, overlays | `match/`, `fx/` (particle types), `shared/`         |
| `fx/`                  | effects reacting to the match: shake, flash, particles, drama, climax | `match/`, `render/`, `audio/`, `shared/`            |
| `ui/`                  | DOM menus, Preact screens, now-playing chip, boot screen              | `match/`, `audio/`, `settings/`, `i18n/`, `shared/` |
| `debug/`, `easterEgg/` | FPS overlay and background menu; Konami code, title taps              | `shared/`                                           |
| `app/`                 | `Game` (composition root, frame loop), `FixedStep`                    | anything                                            |

The rules that matter most are checked by `tests/architecture.test.ts`: `match/` imports only
`match/` and `shared/`, and `shared/` imports nothing from the project.

Known coupling to undo: `fx/` drives the `Renderer` directly (shake, flash, stage effects) and
`render/` reads the particle types from `fx/`. Roadmap step 4.2 (rendering in layers) removes the
loop.

## One frame

`Game.runFrame`, every animation frame:

1. **Effects before the simulation** (`effects.beforeSimulation`), on wall-clock time: the
   deciding point's drama and the rally climax, which may slow the simulation down.
2. **The simulation** (`FixedStep.advance`): frame time, scaled by any slow motion, is cut into
   steps of exactly 1/240 s; `MatchFlow.update` runs once per step and emits events as things
   happen. Leftover time carries over to the next frame.
3. **Effects after the simulation** (`effects.afterSimulation`), on the frame's smooth time:
   particles, paddle sparks, embers, fireworks.
4. **Interpolation** (`flow.interpolate`): balls and paddles get a draw position between the last
   two steps, so motion stays smooth at any refresh rate.
5. **Music** reads a `MusicState` snapshot; **the renderer** draws a `RenderFrame` snapshot.

Everything freezes while paused except the menu dimming. Because the steps are fixed and the
simulation's randomness is injected, the same seed and inputs replay the same match
(`tests/fixedStep.test.ts`).

## The match

`MatchFlow` runs a match; its pieces each answer one question:

| Question                             | Answer                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| What wins it, which mechanics are on | `MatchRules` (`rules.ts`): winning score by side, clock, Overdrive, balls  |
| Who stands where                     | the paddles: a list, each with a `side` (`side.ts`: 0 left, 1 right)       |
| What a paddle is like                | its `PaddleSpec` (`PaddleSpec.ts`): size, perfect zone, power, spin, speed |
| Who plays a paddle                   | the `Lineup`: a controller, an Overdrive flag and a paddle per paddle      |
| How the ball moves and bounces       | `Physics.step`, one ball at a time                                         |
| How the AI plays                     | `AiController` (reading, aiming, nerves) and `AiForm` (form by score)      |

Points belong to sides and are kept by the match (`flow.scores`). The first ball out wins the
point and ends it for every ball. The demo behind the menus is a match with its own lineup of two
AIs and one ball.

Phases: `attract` (the demo) → `serving` → `rally` → … → `finale` → back to `attract`; `paused`
can interrupt `serving` and `rally`.

### Events

The match reports through one stream of `MatchEvent`s (`matchStart`, `serve`, `wallBounce`,
`paddleHit`, `score`, `finaleStart`, `gameOver`, `returnToMenu`). `Game` puts them on an
`EventBus` (`matchEvents`); listeners subscribe to everything or to one type. A listener that
throws is reported in the debug overlay and the others still hear the event, so presentation can
never stop the match.

## How to add things

Each of these works without editing the code that is already there, beyond one registration line.

**A background.** A class implementing `Background` (`render/backgrounds/Background.ts`), added to
`createBackgrounds()` (`render/BackgroundRenderer.ts`), its id added to `SCENES`
(`shared/scenes.ts`) and its name in both languages (`backgrounds` in `i18n/translations.ts`);
the quick match's setup offers it from then on. Draw for both orientations (`isRotated`); read
`laserIntensity` through a floor so play stays lit; warm the palette with the heat (`climax`,
`celebration`). Run
`npm run test:visual -- --update-snapshots` for its new baselines, and look at them.

**A song.** An entry in `SONG_DEFS` (`audio/music/songs.ts`); its `scene` ties it to a background,
which then plays it first.

**A setting.** A field in `UserSettings` and its entry in `SETTINGS`
(`settings/UserSettings.ts`), an entry in `SETTINGS_MENU` (`ui/MenuController.ts`), or in
`QUICK_MATCH_SETUP` if it sets up the match rather than the game (a `toggle` for on/off, a
`choice` stepped by arrows for one from a list), and its texts in both
languages (`i18n/translations.ts`). The compiler insists on all of them; the profile checks
and saves it with no change there. Saved settings
from before it get its default.

**Something else to save** (statistics, unlocks). A field in `profileSchema`
(`profile/Profile.ts`) with a fallback, so a bad or missing value never costs the rest; raise
`PROFILE_VERSION` and add the step from the version before to `MIGRATIONS`
(`profile/migrations.ts`), with a test that a profile of that version loads. Write it with
`profile.update`.

**A kind of paddle.** A `PaddleSpec`: trade-offs as multipliers against `STANDARD_PADDLE` (one
strength, one weakness), brought to a match by its participant in the `Lineup` (`paddle`, or
`flow.playerVsCpu([left, right])`); the paddle takes it on (`useSpec`) for that match.

**A set of rules (the core of a mode).** A `MatchRules` value, started with
`flow.startMatch(rules, lineup, difficulty)`; read the winning scores (each side its own), the
clock (`flow.timeLeft`) and the deciding point from the match (`flow.rules`,
`flow.isDecidingPoint`), never from `WINNING_SCORE`, and its level from `flow.difficulty`, not
the settings.

**A challenge.** An entry in `CHALLENGES` (`match/challenges.ts`): rules, difficulty, both
paddles and a goal; its name and goal in both languages (`challenges` in
`i18n/translations.ts`). The list is in the order they open.

**A game mode.** An entry in `MODES` (`match/modes.ts`), its name in both languages (`modes`
in `i18n/translations.ts`) and its button color (`MODE_COLORS` in `ui/MenuController.ts`).
The PLAY menu lists it, switched off until `isPlayable`; `MenuController.pickMode` opens
its screen. The quick match is the model: a setup screen whose choices are settings, and
`Game.start` building its `MatchRules` from them (`quickMatchRules`).

**A screen.** A Preact component in `ui/screens/` (`.tsx`), taking its texts ready to show and
its actions as props, shown with `uiManager.showScreen(title, subtitle, h(Screen, props))`. The
menu keys walk its buttons like a menu's (skipping the disabled ones and those with
`tabIndex` -1), and any other element it marks `data-menu-item` (a quick match choice); `MenuController.open(back,
redraw)` gives Esc its way back and redraws the screen when a setting changes. Lay its buttons
out in a `.screen-buttons` column (`MenuButton`), as a menu's are.

**A different line-up.** `flow.startMatch(rules, lineup)` with a participant per paddle: two
`HumanController`s for two players, an `AiPaddleController` with a difficulty for each CPU.
A new kind of player (a replay, a remote player) is a new `PaddleController`.

**Something that reacts to the match** (statistics, achievements). A class with
`listenTo(events: EventBus<MatchEvent>)` that subscribes, called where `Game` wires the effects and
the menus. It never changes the match.

**Planned, not there yet** (see the roadmap): modifiers that hook into the simulation and add a
drawing layer (4.3), a back stack for the screens and the old menus moved onto Preact (4.1), a versioned player profile
(1.4), dialogue through Ink (7.1).

## Rules of thumb

- Randomness in the simulation is injected (`random` in `MatchFlow`, the AI, `Ball.serve`), so a
  match replays; presentation may use `Math.random`.
- Draw `ball.drawX/drawY` and `paddle.drawY`, never `x`/`y`: those are the simulated positions.
- Everything with listeners or timers has `dispose()`; DOM listeners go through an
  `AbortController`.
- Every new string exists in both languages; every new screen effect honours
  `prefers-reduced-motion`; everything works on a phone in either orientation.
- Outside the match the left side is still taken to be the player: whose win the finale and the
  menus show, whose Overdrive meter is drawn. Local multiplayer (3.2) changes that.
- If a feature needs `Game.ts`, `MatchFlow.ts`, `RenderFrame` and `EffectsDirector` changed all at
  once, a building block is missing: add it first, then the feature.
