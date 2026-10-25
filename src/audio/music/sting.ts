import { BASS_LOW } from '@/audio/music/Arrangement';
import { MelodyNote, Section, Song, STEPS_PER_BAR } from '@/audio/music/score';
import { placeAbove } from '@/audio/music/theory';

/** How a match ends, as the music marks it (docs/AUDIO.md, "Финал"). */
export type FinaleSting = 'win' | 'loss' | 'allPassed';

// Bars of the hook each sting plays: a win its head, the last challenge passed all of it, a
// defeat its first bar, which the tape stop cuts off
const HOOK_BARS: Record<FinaleSting, number> = { win: 2, allPassed: 4, loss: 1 };

/**
 * The song's hook: its chorus, the first peak in its form with a melody; failing that, any part
 * with one, or its first part.
 */
export function hookOf(song: Song): Section {
  const inForm = song.form.map((i) => song.sections[i]);
  return (
    inForm.find((s) => s.tier === 'high' && s.lead) ??
    inForm.find((s) => s.lead) ??
    inForm[0] ??
    song.sections[0]
  );
}

/** The first `steps` of a line, its notes cut short where they would run past the end. */
function cut(line: (MelodyNote | null)[] | null, steps: number): (MelodyNote | null)[] | null {
  if (!line) return null;
  return Array.from({ length: steps }, (_, i) => {
    const note = line[i % line.length];
    return note && { ...note, steps: Math.min(note.steps, steps - i) };
  });
}

/**
 * The sections a finale's sting plays, in order (5.8): the hook's first bars at full voice, all
 * of its parts in from the first bar, and for a win a coda — the chord the hook opens on, held,
 * the melody's first note over it, so the hook comes home — with a fanfare when every challenge
 * is passed. A defeat plays the hook's first bar alone; the tape stop ends it.
 */
export function finaleSting(song: Song, kind: FinaleSting): Section[] {
  const hook = hookOf(song);
  const bars = HOOK_BARS[kind];
  const steps = bars * STEPS_PER_BAR;
  const isWin = kind !== 'loss';
  const head: Section = {
    ...hook,
    name: `${kind}-sting`,
    tier: 'high',
    bars,
    chords: Array.from({ length: bars * 2 }, (_, i) => hook.chords[i % hook.chords.length]),
    lead: cut(hook.lead, steps),
    counter: cut(hook.counter, steps),
    bassLine: cut(hook.bassLine, steps),
    arpLine: cut(hook.arpLine, steps),
    // Every part in at once, nothing the song does to its own peak
    layers: undefined,
    enter: undefined,
    silence: undefined,
    glitch: undefined,
    riser: undefined,
    sweep: undefined,
    drop: isWin,
    fill: isWin ? hook.fill : undefined,
  };
  if (!isWin) return [head];

  const home = hook.chords[0];
  const firstNote = hook.lead?.find((note) => note !== null);
  const held = (note: number): (MelodyNote | null)[] => [
    { note, steps: STEPS_PER_BAR },
    ...Array<null>(STEPS_PER_BAR - 1).fill(null),
  ];
  const coda: Section = {
    name: `${kind}-coda`,
    tier: 'high',
    bars: 1,
    chords: [home, home],
    lead: firstNote ? held(firstNote.note) : null,
    leadVoice: hook.leadVoice,
    counter: null,
    bassLine: held(placeAbove(home.root, BASS_LOW)),
    arpLine: null,
    drums: 'coda',
    pad: 'hold',
    stabs: kind === 'allPassed' ? 'fanfare' : undefined,
    stabsVoice: 'brass',
    level: hook.level,
    mix: hook.mix,
  };
  return [head, coda];
}
