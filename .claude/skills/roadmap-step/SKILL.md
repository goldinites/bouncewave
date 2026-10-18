---
name: roadmap-step
description: Carry out one step of the BounceWave development plan (docs/ROADMAP.md) end to end — branch, implementation, checks, roadmap status, commit and pull request. Use when the user asks to start, continue or do the next roadmap step (e.g. "начинай 0.1", "следующий шаг").
---

# Carry out a roadmap step

## 1. Pick the step

- Read `docs/ROADMAP.md`. The step is the one the user named, otherwise the first ⬜ or 🔄
  step in order. Read its paragraph and the stage's notes; the decisions and the stack section
  there are binding.
- If the step's scope is unclear or conflicts with the code as it is now, ask before writing code.

## 2. Branch

From an up-to-date `main` (`git fetch origin && git switch main && git merge --ff-only
origin/main`), unless the user asked to stack on another branch:

- stage 0 → `foundation/<number>-<slug>` (e.g. `foundation/0.1-fixed-step`)
- later stages → `feature/<number>-<slug>`

Never commit to `main`.

## 3. Implement

- Read the code the step touches before changing it; follow `CLAUDE.md` (layer rules, style,
  both languages, reduced motion, both orientations).
- **Stage 0 steps change no behavior.** Existing tests must pass unchanged. If one has to change,
  stop and explain why to the user first — it usually means behavior changed.
- Add tests for what the step introduces.
- Keep the step's scope: note anything else you find for the user instead of fixing it on the
  side.

## 4. Verify

```sh
npm test && npx tsc --noEmit -p . && npm run lint && npm run format:check
```

Plus the end-to-end checks once step 0.0 exists: `npm run test:e2e` (smoke) and, for anything
that can change what is drawn, `npm run test:visual`. Report failures with their output; never
update visual baselines to make a check pass without showing the user the difference and getting
a yes.

## 5. Roadmap and commit

- In `docs/ROADMAP.md` set the step to ✅ with its PR number once known (🔄 while the PR is open),
  and note any decision taken during the step in its paragraph.
- Commit in the repository's style (see `CLAUDE.md` → Git): one or a few commits that each make
  sense on their own.

## 6. Pull request

- `git push -u origin <branch>`. `gh` is not installed: give the user
  `https://github.com/goldinites/bouncewave/pull/new/<branch>` and a ready PR description —
  what changed and why, how it was verified, what is left for later.
- Say which roadmap step comes next and wait for the user's go-ahead before starting it.
