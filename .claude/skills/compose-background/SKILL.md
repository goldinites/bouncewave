---
name: compose-background
description: Make one BounceWave backdrop by eye with the user — an idea and proposals, canvas sketches in an Artifact to choose from, the chosen one developed there until it's done, then the code to the project's performance rules, then its track. Use when the user asks for the next background or to redo one (e.g. "делай сэнто", "следующий фон", "переделай город").
---

# Make a background

The method, the requirements and the table of backgrounds are in `docs/BACKGROUNDS.md`; which
backgrounds there are and will be is in `docs/ROADMAP.md`, "Фоны быстрого матча", and the step
(8.8, 8.8b…). Read them first, and look at the current backgrounds' pictures in
`e2e/__screenshots__/` so the new one stays apart from them. The user chooses by eye: every step
ends with something to look at and a choice, never with a background coded blind. **No code of
the background before the user has picked a sketch.**

## 1. Idea and proposals

- In words, before drawing: the place's story and its hero (one memorable thing), the palette
  (breaking the purple-magenta the others share), how it lives with the music and the match
  (beat, spectrum, climax, the win), what it does in portrait. Two or three directions.
- Check them against `docs/BACKGROUNDS.md` ("Каким должен быть фон"): a place, not a style; a
  hero, not a list of landmarks; the ball readable.

## 2. Sketches to choose from

- One Artifact page (load `artifact-design` per the Artifact tool), 3–4 variants side by side,
  each drawn on a canvas at 800×500 with a 500×800 portrait thumbnail. Make them really differ:
  composition, hero, palette — not shades of one picture.
- Every variant animated and switchable: the court on top (paddles, a ball in flight, the net,
  the score) to judge readability; menu / play / climax states; a beat pulse; a card-sized
  preview as a portal would show it. Respect `prefers-reduced-motion` on the page itself.
- Tell the user what each one is in a line, and ask which (or what to combine).

## 3. Develop the chosen one

- Republish the same Artifact file with each iteration: details, motion, the answer to the beat,
  climax and the win's burst, the portrait composition. Say what changed and ask; go on until
  the user says it's done.
- Keep the sketch's drawing close to how the game will draw it (Canvas 2D, no filters the game
  can't afford), so step 4 is a port, not a reinvention.

## 4. The code

- A class implementing `Background` (`docs/ARCHITECTURE.md`, "A background"); a reworked
  backdrop keeps its scene id (the profile stores it) and changes its name in both languages.
- Follow "Требования к коду" in `docs/BACKGROUNDS.md`: no `shadowBlur` per frame, gradients and
  heat colors cached by step, static layers cached, no allocations per frame, motion in
  `advance`, randomness only at creation.
- A test in `tests/` (both orientations, the win's burst dies away, particles stay in frame).
  `npm run test:perf` within `e2e/frameBudget.ts`. Pictures: `npm run test:visual` fails on the
  changed background — show the user the new pictures (stand and the game with the court) and
  update the baselines with `-- --update-snapshots` only after their yes.
- All checks (`CLAUDE.md`), the background's row in `docs/BACKGROUNDS.md` "Фоны сейчас", the
  step's status in `docs/ROADMAP.md`; reread the sections you changed and take out what the new
  background replaces. Commit (`CLAUDE.md` → Git).

## 5. Its track, then the next

- The background's track with `/compose-track` (its own, or the one it keeps — ask), then ask for
  the next background.
