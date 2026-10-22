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

| Directory              | Owns                                                                     | May import                                          |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `shared/`              | palette, math, fonts, scene ids, `EventBus`                              | nothing in the project                              |
| `match/`               | rules, simulation, AI, paddles, balls, sides                             | `match/`, `shared/`                                 |
| `settings/`            | the player's settings and quick-match setup                              | `match/`, `i18n/` (language), `shared/`             |
| `profile/`             | everything saved between visits: versions, migrations, statistics        | `settings/`, `match/` (events), `shared/`           |
| `i18n/`                | texts in every language                                                  | `match/` (difficulty, modes)                        |
| `input/`               | keyboard, pointer, touch, portrait rotation                              | `match/`, `shared/`                                 |
| `audio/`               | the AudioContext, procedural music, sound effects                        | `match/`, `shared/`                                 |
| `render/`              | the canvas: backgrounds, court, paddles, balls, HUD, camera, overlays    | `match/`, `shared/`                                 |
| `fx/`                  | effects reacting to the match: shake, flash, particles, drama, climax    | `match/`, `render/`, `audio/`, `shared/`            |
| `ui/`                  | menus as Preact screens on a stack, challenge condition, boot screen     | `match/`, `audio/`, `settings/`, `i18n/`, `shared/` |
| `debug/`, `easterEgg/` | FPS overlay, developer menus, the sound stand; the classic look's switch | `audio/`, `shared/`                                 |
| `app/`                 | `Game` (composition root, frame loop), `FixedStep`                       | anything                                            |

The rules that matter most are checked by `tests/architecture.test.ts`: `match/` imports only
`match/` and `shared/`, and `shared/` imports nothing from the project.

`render/` never imports `fx/` (checked too): the effects drive the `Renderer` (shake, flash, stage
effects) and fill in the particles, whose types (`render/particles.ts`) belong to what draws them.

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
5. **Music** reads a `MusicState` snapshot; **the renderer** draws a `RenderFrame` snapshot
   (`render/scene.ts`), grouped by who reads it: `court` (what is on it), `hud` (what is written
   over it), `drama` (climax, vignette, zoom, glow). The `Renderer` keeps what lasts between frames
   (shake, flash, the final score, the dimming, the backdrop's mood in `BackdropMood`) and hands
   the frame to the look's `Scene`. The neon one (`NeonScene`) is an ordered list of layers, each
   drawn in its space: `backdrop` under the camera's zoom, `court` under the zoom and the shake,
   `screen` fixed over everything (dimming, vignette, flash).

Everything freezes while paused except the menu dimming. Because the steps are fixed and the
simulation's randomness is injected, the same seed and inputs replay the same match
(`tests/fixedStep.test.ts`).

## The match

`MatchFlow` runs a match; its pieces each answer one question:

| Question                             | Answer                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What wins it, which mechanics are on | `MatchRules` (`rules.ts`): winning score by side, clock, rally goal, CPU ramp, Overdrive, balls                                                                                     |
| Who stands where                     | the paddles: a list, each with a `side` (`side.ts`: 0 left, 1 right)                                                                                                                |
| What a paddle is like                | its `PaddleSpec` (`PaddleSpec.ts`): size, perfect zone, power, steer, speed                                                                                                         |
| Who plays a paddle                   | the `Lineup`: a controller, an Overdrive flag and a paddle per paddle                                                                                                               |
| How the ball moves and bounces       | `Physics.step`, one ball at a time; `forecastArrival` flies a copy ahead to where it will cross                                                                                     |
| What a paddle can do beyond the base | its participant's skills (`match/skills/`), played through hooks by the match's `SkillSet`                                                                                          |
| How the AI plays                     | `AiController` (reading each ball's shot through the physics, aiming, perfect swings, nerves), `AiForm` (form by score) and `fatigue` (worn by a long rally, `rules.rallyPressure`) |

Points belong to sides and are kept by the match (`flow.scores`). The first ball out wins the
point and ends it for every ball. The demo behind the menus is a match with its own lineup of two
AIs and one ball.

Phases: `attract` (the demo) → `serving` → `rally` → … → `finale` → back to `attract`; `paused`
can interrupt `serving` and `rally`.

### Events

The match reports through one stream of `MatchEvent`s (`matchStart`, `serve`, `wallBounce`,
`paddleHit`, `skill`, `score`, `finaleStart`, `gameOver`, `returnToMenu`). `Game` puts them on an
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
A mode's own background (the challenges', later the story's) is the same, but its id goes to its
mode's list in `EXCLUSIVE_SCENES`, not `SCENES`, and it needs no name: the quick match never
offers it, nor does random deal it. Whatever starts a match sets the scene it is played on
(`Game.matchScene`: a challenge's `scene`, `match/challenges.ts`), and the effects ask
`switchChannel` for it on `matchStart`.

**A song.** An entry in `SONG_DEFS` (`audio/music/songs.ts`); its `scene` ties it to a background,
which then plays it first. Its id is its title in lower case with dashes; listen to it, part by
part and layer by layer, on the debug overlay's sound stand (`debug/SoundStand.ts`,
`?song=night-drive&part=chorus&mute=drums`). Its `level` evens out its loudness against the others,
read off the stand's meter.

**A sound.** Everything heard goes through `audio/Mixer.ts`: music, action sounds and menu sounds
each on their bus, then the limiter. In the music, an instrument plays on its stem in `MusicGraph`
(`drums`, `bass`, `pads`, `melody`), which gives it its saturation, sidechain and sends; an action
sound plays on `sfx` (`menu` for menus), and a strong one dips the music (`Mixer.duckMusic`).

**An instrument.** A recipe in `audio/samples/` (a graph built in an offline context, rendered once
per variant into the `SampleBank` when the audio starts); its live synth in `Instruments` plays
until it is rendered. A drum is a role in a kit (`audio/music/kits.ts`): a song picks its `kit`,
the arrangement asks for roles. A pitched instrument is rendered at a few roots and played from
the nearest at the right speed, through a live envelope and filter; a sustained one loops, its
oscillators tuned to whole cycles of the loop (`tune`) so the join is seamless. A transition
(`audio/samples/transitions.ts`) marks the song's form: a swell is placed to end on the downbeat it
leads into (`Instruments.transition`), and the arrangement picks it from the section and the tier
the music came from (`Conductor.cameFrom`). Hear each on the sound stand; `e2e/samples.spec.ts`
renders them all in Chromium against the budgets.

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
`i18n/translations.ts`). The list is in the order they open. A new kind of goal is a case in
`ChallengeGoal` and in `ChallengeJudge` (`match/ChallengeJudge.ts`), which counts what goals need
from the match's events and gives a verdict on every finished attempt; it never changes the
match. The menus start one (`onStartChallenge`), `Game.start` plays it and its restarts
(`?challenge=<id>` makes every quick match one, for developers); the verdict goes to the profile
(`challenges.passed`, `profile/ChallengeProgress.ts`; every challenge is open from the start)
and to the result screen in place of the game-over menu. Challenges stay out of the statistics
(`StatsRecorder`'s `isCounted`).

**A tutorial step.** A name in `TUTORIAL_STEPS` (`match/tutorial.ts`) and, if it opens on a card, in
`TUTORIAL_CARDS` with its example (`ui/screens/TutorialCardScreen.tsx`); what counts for it in
`TutorialCoach` (from the match's events and the learner's paddle; it only watches), and its line
and hint in both languages (`tutorial` in `i18n/translations.ts`). The tutorial is a match of
`TUTORIAL_RULES` against `TrainerController`, started by `Game.start`; its line takes the
challenge condition's place (`ui/tutorialTexts.ts`). Whether it was gone through or turned down is
the profile's `tutorial`.

**A game mode.** An entry in `MODES` (`match/modes.ts`), its name in both languages (`modes`
in `i18n/translations.ts`) and its button color (`MODE_COLORS` in `ui/MenuController.ts`).
The PLAY menu lists it, switched off until `isPlayable`; `MenuController.pickMode` opens
its screen. The quick match is the model: a setup screen whose choices are settings, and
`Game.start` building its `MatchRules` from them (`quickMatchRules`).

**A screen.** A Preact component in `ui/screens/` (`.tsx`), taking its texts ready to show and
its actions as props. `MenuController` describes it as a `ScreenEntry` (`ui/ScreenStack.ts`): an
`id`, a `view()` building its title, subtitle and `h(Screen, props)`, and the backdrop it wants. A
button opens it over the screen on show (`stack.push`), its BACK and Esc step back down
(`stack.back`), and a way in from outside the menus resets the stack to the way down to it. The
screen on show is drawn in an effect: whatever signal `view()` reads (`settings.current`,
`profile.current`) draws it again when it changes, with nothing to call. The menu keys walk its
buttons (skipping the disabled ones and those with `tabIndex` -1) and any other element it marks
`data-menu-item` (a quick match choice). Lay its buttons out in a `.screen-buttons` column
(`MenuButton`, or `ButtonMenu` for a plain column).

**A different line-up.** `flow.startMatch(rules, lineup)` with a participant per paddle: two
`HumanController`s for two players, an `AiPaddleController` with a difficulty for each CPU.
A new kind of player (a replay, a remote player) is a new `PaddleController`.

**A look.** The whole game's presentation, a `Look` (`shared/look.ts`): neon, or the classic
look `ClassicSwitch` (`easterEgg/`) turns on and off from the main menu only. `Game` follows its
signal and hands the look to the `Renderer` (the classic one draws its own flat `ClassicScene` and
shows no effects: `renderer.showsEffects`), the `UIManager` (the menus' chrome, `classic.css`) and
the `AudioEngine` (which music `playMusic` plays), and plays its matches as Pong was: no Overdrive
and no skills for anyone (`Game.forLook`, `skillsOf`); the menus read it to offer only what the look can
play. The neon drawing code never asks which look is on. A new look is a value of `Look`, a scene
that draws it, and its chrome.

**Something that reacts to the match** (statistics, achievements). A class with
`listenTo(events: EventBus<MatchEvent>)` that subscribes, called where `Game` wires the effects and
the menus. It never changes the match.

**Something drawn on the court** (a modifier's darkness, a skill's hint). A `Layer` in
`NeonScene`'s list, in the space and place it belongs; what it reads goes into the `RenderFrame`
group it belongs to. The classic look draws its own `ClassicScene` and leaves out what it has no
place for.

**A skill** (docs/PROGRESSION.md). A class implementing `Skill` (`match/skills/Skill.ts`), its id
in `SKILL_IDS` (and `IMPLANTS` if it runs on energy: its owner's meter then has a core) and its
maker in `SKILLS` (`match/skills/SkillSet.ts`). It is built for the paddle whose participant
lists it (`Participant.skills`) and sees the match through its `SkillHost`: the paddles, the
balls, its owner's meter (`spend`), the ball's pace. Its hooks run inside the fixed step:
`beforeStep`, `afterHit`, `timeScale` (how fast a paddle or the balls move this step; Reflex
slows the world but its owner) and `onServe`; a skill that shows its owner something keeps it
in `read` (Analyzer's read shot, `flow.shotReads`). What changes the flight is the ball's own state,
moved by `Physics` (`ball.spin`, which Arc sets), so `forecastArrival` and the AI see it too; a
paddle's `perfectZoneScale` widens its perfect zone for a hit. It never changes the rules or the
score, and it reports what the player should notice with `host.report`, a `skill` event the
effects give its sound and burst. What lasts on court is drawn by layers (`SkillRenderer`): the
spin's streaks and trail, the slowed world's cast (`flow.timeWarp`), a read shot's wireframe and
sight; skills have no written labels, so each must look and sound like no other. For developers,
`?skills=arc,analyzer,reflex` gives the player those skills in every match against the CPU,
`?cpuSkills=` the CPU, and the debug overlay's skill menu (`debug/SkillMenu.ts`) switches both at
once (`flow.giveSkills`) and counts their uses in the match. A CPU plays its skills as a person
does: they go off from its play (its swings spin the ball, Reflex judges by its level's top
speed, `controller.topSpeed`), and what they tell their owner reaches it through
`controller.onSkillUse` (its Analyzer's read sharpens its eye; nothing of it is drawn). A
challenge's modifier (4.5) joins the same hooks.

**A modifier** (docs/CHALLENGES.md). A rule of the match in `rules.modifiers`: its id in
`MODIFIER_IDS` (`match/modifiers/Modifier.ts`) and its maker in `MODIFIERS`
(`match/modifiers/modifiers.ts`). The match's `ModifierSet` starts it with the match and ends it
when the match is left, so whatever it changed is put back; between, it plays through the same
hooks as a skill (`beforeStep`, `afterHit`, `onServe`). What the court does to the ball lives in
`CourtConditions` (`match/court.ts`: wind, turbo, posts), which every ball carries and `Physics`
applies, so a forecast and the AI fly through it too; a paddle's `grip` (it slides) and `confine`
(a stretch of the court) serve the others. A modifier that only changes what is drawn (Darkness,
the invisible band) needs no hooks: its layer reads `court.modifiers`. Two opponents is set up by
the match itself: a second paddle for the CPU while the match lasts (`withSecondOpponent`; the
shared paddle list grows and shrinks, as the balls do). Layers are in `ModifierRenderer`. For
developers, `?mods=wind,darkness` and the debug overlay's modifier menu play quick matches with
them.

**Planned, not there yet** (see the roadmap): story scenes as typed data, without Ink (9.1).

## Rules of thumb

- Randomness in the simulation is injected (`random` in `MatchFlow`, the AI, `Ball.serve`), so a
  match replays; presentation may use `Math.random`.
- Draw `ball.drawX/drawY` and `paddle.drawY`, never `x`/`y`: those are the simulated positions.
- Everything with listeners or timers has `dispose()`; DOM listeners go through an
  `AbortController`.
- Every new string exists in both languages; every new screen effect honours
  `prefers-reduced-motion`; everything works on a phone in either orientation.
- Every paddle that charges Overdrive draws its meter (`flow.overdriveCharges`): a person's, and
  a CPU's at a level that does where the rules let it (`rules.cpuOverdrive`, the quick match).
  A match of two (`flow.twoPlayers`) ends in a win, the winner named; otherwise, outside the
  match, the left side is still taken to be the player: whose win the finale and the menus show.
- If a feature needs `Game.ts`, `MatchFlow.ts`, `RenderFrame` and `EffectsDirector` changed all at
  once, a building block is missing: add it first, then the feature.
