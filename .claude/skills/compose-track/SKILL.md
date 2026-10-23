---
name: compose-track
description: Compose one BounceWave soundtrack track by ear with the user — process-built base sketches to choose from, melodies over the chosen base, lead sounds auditioned on the stand, then the full track built from the choices, levelled and checked. Use when the user asks for the next track or to redo one (e.g. "делай мемфис", "следующий трек", "переделай трек меню").
---

# Compose a track

The full method and its reasons are in `docs/AUDIO.md`, "Как делаем трек"; the track list
(backdrop, genre, tempo, references) is in its "Саундтрек" table. Read both first. The user
can't describe what's wrong in words: every step ends with something to listen to on the stand
and a choice, never with a finished track written blind.

## 1. Bases to choose from

- 3–4 sketches in `src/audio/music/songs.ts`, `sketch: true`, each with a `hook` (groove) and a
  `hot` (high, `drop: true`) section over the same 8-bar progression. No melody yet.
- Build each on a process, not a tune: `cycle`, `additive`, `euclid` from
  `src/audio/music/compose.ts`, written lines (`bassLine`, `arpLine`), a `sweep`. Make them
  contrast: key or mode, tempo, rhythm, the reference each follows.
- Keep the lines' notes in their instruments' ranges (`tests/songs.test.ts` checks it).
- Level them: `npm run loudness -- --parts=hook,hot <ids>`, set `level`, measure again.
- Tell the user what each is and its reference, and ask which one (or two) to keep.

## 2. Melodies over the chosen base

- Drop the unchosen bases. Write 3–4 melodies as constants over the chosen progression, each as
  its own sketch with the base: a motif with its own rhythm, a 4-bar question and its answer, an
  arch peaking in bar 5–6, strong-beat notes resolving by step. Give the track a melodic gesture
  and a register no other track has (`docs/AUDIO.md`, step 2) — not a pickup run climbing into a
  long note, which every 5.6a melody leaned on. Keep the melody clear of the arpeggio's
  register, above it or below it. Lead `brass`, no glide.
- `npm test` must pass: the strong-beat rule, the C4–D6 register, the ranges.
- Ask which melodies, and on which lead sound: give stand links with `&lead=<voice>` (voices in
  `src/audio/music/score.ts`, `LeadVoice`) to hear one melody on several.

## 3. The full track

- Build it from the choices (`docs/AUDIO.md`, step 4): a 14-step `form`, the base alone in the
  intro and breakdown, the melodies in the verses on their chosen leads, the main melody at the
  chorus with a harmony a third below and the drop, a bridge from another melody or from the
  motif developed. `transpose` moves material into one key.
- Replace the backdrop's previous track (same `scene`); remove the sketches and their unused
  constants.
- Level it to −25 dB with `npm run loudness -- <id>`; watch it on the stand walk its form and
  reach its chorus on a full climax.
- Run all checks (`CLAUDE.md`), note the track and the user's choices in `docs/ROADMAP.md` under
  the 5.6 step, commit (`CLAUDE.md` → Git), and ask for the next one.
