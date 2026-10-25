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
- Level them: `npm run render -- <ids>`, set `level` as its report says, render again.
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

- Build it from the choices (`docs/AUDIO.md`, step 4): first the track's story with its
  backdrop, then a frame of its own — form and part lengths, tempo, intro, beat, kit, the way up
  to its peak, `transitions` — that no other track shares (a test checks). Instruments enter one
  by one (`enter`) and answer each other; the melodies in the verses on their chosen leads, the
  hook saved for the chorus, a bridge from another melody or the motif developed. `transpose`
  moves material into one key.
- Replace the backdrop's previous track (same `scene`); remove the sketches and their unused
  constants.
- Keep it from sounding like another track (`docs/AUDIO.md`, "Разнообразие"): one shared thing —
  a voice, a frame, a tempo, a kit — is fine; what blurs two tracks is the melody and the
  chorus's sound together with the rest. The test "the tracks stay apart" adds up what a pair
  shares; the chorus's whole sound only the ear hears, so compare the sketches with the other
  tracks on the stand from the bases and melodies on, not only once the track is built.
- Render it (`npm run render -- <id>`, `docs/AUDIO.md` "Рендер") and look before the user
  listens: level it to −25 dB as the report says; fix what the pictures and numbers show — mud
  or an empty band in the spectrogram, the melody and the arpeggio sharing a register (white on
  `lead-arp.png`), a paddle hit not heard over the loudest part, a phone losing the bass, a
  stretch of more than 16 bars without a change of texture. Tell the user what you fixed; taste
  stays theirs. Then watch it on the stand walk its form and reach its chorus on a full climax.
- Write the track into `docs/AUDIO.md` as it now is: its row in the soundtrack table and in
  "Треки сейчас" (key, melodic gesture and register, beat and kit, room, `pump`, `grit`), so the
  next track can avoid them; the track's state in `docs/ROADMAP.md`'s "Где сейчас", not a log of
  how it was chosen.
- Before committing, reread the doc sections you changed and take out what the new track
  replaces (the previous track of the backdrop, a rule it overturned, sketches named as pending).
- Run all checks (`CLAUDE.md`), commit (`CLAUDE.md` → Git), and ask for the next one.
