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

## 1a. Review it as a game designer

Before building, review the step's requirements, and every new requirement the user adds along
the way, as a professional game designer would. Look at what the player will feel and do:

- **Clarity**: can the player tell what to do, why they won or lost, what a choice will cost?
  Rules the player can't see (a hidden clock, an unexplained condition) are unfair.
- **Difficulty and pacing**: the first minutes, the curve across modes and challenges, spikes,
  walls, attempts that take too long to retry.
- **Motivation**: rewards, progression, a reason to come back; nothing that feels like a grind
  or a trap.
- **Fairness and consistency**: with the agreed decisions in `docs/ROADMAP.md`, with the rest of
  the game's rules and words, and on a phone in either orientation.
- **Cost**: scope and risk against what the player gains.

**Every new decision is discussed before it is built**: give its pros and cons, how it fits the
game's direction, and a recommendation, then wait for the user's answer. Say plainly when a
requirement is objectively bad (it hurts the player experience by a recognised principle, not by
taste): what goes wrong for the player, why, and a better option. Keep taste apart from problems,
and keep it short; no remarks for the sake of remarks. If the user keeps the requirement, build it
as asked and record the decision where it lives (the roadmap's decisions or the topic's doc),
rewriting that place rather than appending history.

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

- In `docs/ROADMAP.md` set the step to ✅ with its PR number once known (🔄 while the PR is open).
  Decisions taken during the step go where they live (the roadmap's decisions, `AUDIO.md`,
  `CHALLENGES.md`…), rewritten into the current state; no "done" logs — git and the PR keep them.
- Commit in the repository's style (see `CLAUDE.md` → Git): one or a few commits that each make
  sense on their own.

## 6. Pull request

- `git push -u origin <branch>`. `gh` is not installed: give the user
  `https://github.com/goldinites/bouncewave/pull/new/<branch>` and a ready PR description —
  what changed and why, how it was verified, what is left for later.
- Say which roadmap step comes next and wait for the user's go-ahead before starting it.
