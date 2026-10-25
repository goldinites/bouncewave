import { describe, expect, it } from 'vitest';
import { LeadVoice, MelodyNote, SongDef, STEPS_PER_BAR } from '@/audio/music/score';
import { SONGS } from '@/audio/music/songs';
import { PAD_SOUND } from '@/audio/music/palette';
import { DRUM_PATTERNS } from '@/audio/music/patterns';
import {
  EXTRA_LEAD_FOR,
  EXTRA_LEADS,
  ExtraLeadId,
  LEAD_SAMPLE_FOR,
  LOW_TWINS,
} from '@/audio/samples/leads';
import { PITCHED_SAMPLES, PitchedSampleId } from '@/audio/samples/pitched';
import { isSceneId } from '@/shared/scenes';

// The lead voices played from rendered instruments, and how far a note may sit from a root
/** The roots a lead voice is rendered at: its sound's own, from the core palette or the extra leads, and its low twin's. */
const rootsOf = (voice: LeadVoice): number[] | null => {
  const id = LEAD_SAMPLE_FOR[voice];
  if (!id) return null;
  const own =
    id in EXTRA_LEADS
      ? EXTRA_LEADS[id as ExtraLeadId].roots
      : PITCHED_SAMPLES[id as PitchedSampleId].roots;
  return [...LOW_TWINS[id].recipe.roots, ...own];
};
const STRETCH = 3; // semitones: further, a note played from its root starts to sound stretched

describe('the soundtrack', () => {
  it('keeps every melody note where its rendered instrument sounds natural', () => {
    for (const song of SONGS) {
      for (const section of song.sections) {
        const lines: [LeadVoice, typeof section.lead][] = [
          [section.leadVoice ?? song.voices.lead, section.lead],
          [section.counterVoice ?? song.voices.counter, section.counter],
        ];
        for (const [voice, line] of lines) {
          const roots = rootsOf(voice);
          if (!roots || !line) continue;
          for (const note of line) {
            if (!note) continue;
            expect(note.note, `${song.title} ${section.name} ${voice}`).toBeGreaterThanOrEqual(
              roots[0] - STRETCH,
            );
            expect(note.note, `${song.title} ${section.name} ${voice}`).toBeLessThanOrEqual(
              roots[roots.length - 1] + STRETCH,
            );
          }
        }
      }
    }
  });

  it('keeps every written bass and arpeggio note where its rendered instrument sounds natural', () => {
    for (const song of SONGS) {
      for (const section of song.sections) {
        const lines: [string, typeof section.bassLine][] = [
          [song.voices.bass, section.bassLine],
          [song.voices.arp, section.arpLine],
        ];
        for (const [voice, line] of lines) {
          if (!line || !(voice in PITCHED_SAMPLES)) continue;
          const { roots } = PITCHED_SAMPLES[voice as PitchedSampleId];
          for (const note of line) {
            if (!note) continue;
            const where = `${song.title} ${section.name} ${voice}`;
            expect(note.note, where).toBeGreaterThanOrEqual(roots[0] - STRETCH);
            expect(note.note, where).toBeLessThanOrEqual(roots[roots.length - 1] + STRETCH);
          }
        }
      }
    }
  });

  // What the ear hears as a melody's rhythm: where its notes start. Over eight bars one bar's
  // rhythm may come back (a, a'), but not in most bars, and a two-bar phrase at most twice: a
  // line that repeats one rhythm is a loop, the "ту ту туру" heard in every part of a song
  it('never loops one rhythm through a melody', () => {
    const onsets = (line: readonly (unknown | null)[], from: number, bars: number) =>
      line
        .slice(from, from + bars * STEPS_PER_BAR)
        .map((note) => (note ? 'x' : '.'))
        .join('');
    const most = (rhythms: string[]) =>
      Math.max(...rhythms.map((r) => rhythms.filter((other) => other === r).length));
    for (const song of SONGS) {
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        for (let from = 0; from + 8 * STEPS_PER_BAR <= lead.length; from += 8 * STEPS_PER_BAR) {
          const bars = [0, 1, 2, 3, 4, 5, 6, 7]
            .map((bar) => onsets(lead, from + bar * STEPS_PER_BAR, 1))
            .filter((rhythm) => rhythm.includes('x'));
          const phrases = [0, 2, 4, 6].map((bar) => onsets(lead, from + bar * STEPS_PER_BAR, 2));
          expect(most(bars), `${song.title} ${name}: one bar's rhythm`).toBeLessThanOrEqual(3);
          expect(most(phrases), `${song.title} ${name}: one phrase's rhythm`).toBeLessThanOrEqual(
            2,
          );
        }
      }
    }
  });

  /** A melody's notes in order, each with its length. */
  const notesOf = (line: readonly (MelodyNote | null)[]) =>
    line.filter((note): note is MelodyNote => note !== null);

  // A melody all held notes drags, one all quick notes tires (the user, 23.10.2026): the verse's
  // and the chorus's melodies each have a quick, restless moment — three notes of an eighth or
  // shorter in a row — and a long, held one, half a bar or more
  it('gives the verse and chorus melodies quick moments and held ones', () => {
    for (const song of SONGS.filter((s) => !s.sketch)) {
      for (const tier of ['groove', 'high'] as const) {
        const { name, lead } = song.sections.find((s) => s.tier === tier && s.lead)!;
        const notes = notesOf(lead!);
        const quick = notes.some(
          (_, i) => notes.slice(i, i + 3).filter((n) => n.steps <= 2).length === 3,
        );
        const held = notes.some((note) => note.steps >= STEPS_PER_BAR / 2);
        expect({ quick, held }, `${song.title} ${name}`).toEqual({ quick: true, held: true });
      }
    }
  });

  // Every 5.6a melody climbed into a long note by a pickup run, and the tracks sounded like one
  // tune on different sounds: a song may climb that way once in eight bars, no more
  it('climbs into a long note by a pickup run at most once in eight bars', () => {
    for (const song of SONGS) {
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        const notes = notesOf(lead);
        let runs = 0;
        for (let i = 0; i + 3 < notes.length; i++) {
          const [a, b, c, target] = notes.slice(i, i + 4);
          const climbs = [b.note - a.note, c.note - b.note, target.note - c.note].every(
            (step) => step >= 1 && step <= 4,
          );
          const isPickup = [a, b, c].every((note) => note.steps <= 2);
          if (climbs && isPickup && target.steps > c.steps) runs++;
        }
        const eights = Math.max(1, lead.length / (8 * STEPS_PER_BAR));
        expect(runs, `${song.title} ${name}`).toBeLessThanOrEqual(eights);
      }
    }
  });

  // Tracks must not share a melody: a figure of five notes — its four intervals and five
  // lengths — belongs to one song (its versions aside)
  it('gives no two songs the same five-note figure', () => {
    const owner = new Map<string, string>();
    for (const song of SONGS) {
      const track = song.title.replace(/ v\d+$/, '');
      for (const { name, lead } of song.sections) {
        if (!lead) continue;
        const notes = notesOf(lead);
        for (let i = 0; i + 4 < notes.length; i++) {
          const five = notes.slice(i, i + 5);
          const figure = five
            .map((note, j) => `${j ? note.note - five[j - 1].note : ''}:${note.steps}`)
            .join(' ');
          const other = owner.get(figure);
          expect(other === undefined || other === track, `${track} ${name} and ${other}`).toBe(
            true,
          );
          owner.set(figure, track);
        }
      }
    }
  });

  // A track on one four-chord loop, its bridge the same chords from another one, never goes
  // anywhere (docs/AUDIO.md, "Чего не делать"): some part played over the verse's chords leads
  // the harmony to chords the verse never plays
  it('takes the harmony somewhere the verse doesn’t go', () => {
    const chordsOf = (section: (typeof SONGS)[number]['sections'][number]) =>
      new Set(section.chords.map((chord) => chord.symbol));
    for (const song of SONGS.filter((song) => !song.sketch)) {
      const verse = chordsOf(song.sections.find((section) => section.tier === 'groove')!);
      const elsewhere = song.sections
        .filter((section) => section.tier !== 'rise')
        .some((section) => [...chordsOf(section)].filter((c) => !verse.has(c)).length >= 2);
      expect(elsewhere, song.title).toBe(true);
    }
  });

  // The game has no voices (docs/AUDIO.md, decided 22.10.2026): no vocals, no choirs, no human
  // sounds, by synthesis or by recording
  it('sings with no voice: no choir or vocal in the palette', () => {
    const sounds = [
      ...Object.keys(EXTRA_LEADS),
      ...Object.values(EXTRA_LEAD_FOR),
      ...Object.keys(PAD_SOUND),
    ];
    expect(sounds.filter((id) => /choir|vocal|voice|vox|ooh/i.test(id))).toEqual([]);
  });

  it('plays every song in a room of its own', () => {
    const rooms = SONGS.filter((song) => !song.sketch).map((song) => song.room);
    expect(rooms.every(Boolean)).toBe(true);
    expect(new Set(rooms).size).toBe(rooms.length);
  });

  it('gives each backdrop one song of its own at most', () => {
    const scenes = SONGS.flatMap((song) => (song.scene ? [song.scene] : []));
    expect(new Set(scenes).size).toBe(scenes.length);
    expect(scenes.every(isSceneId)).toBe(true);
  });

  it('gives every song a calm part for the menus and a peak to earn (sketches: a hook)', () => {
    for (const song of SONGS.filter((s) => !s.sketch)) {
      const tiers = new Set(song.form.map((i) => song.sections[i].tier));
      expect(tiers.has('calm'), song.title).toBe(true);
      expect(tiers.has('high'), song.title).toBe(true);
    }
  });
});

// Tracks heard one after another must not sound like one tune (with the user, 25.10.2026): Above
// the Clouds and Sunset Strip blurred into one by their melodies and the sound of their choruses.
// One shared thing — a voice, a frame, a tempo — is fine; a track is too like another when most of
// what the ear hears coincides at once, the melody and the chorus weighing most
// (docs/AUDIO.md, "Разнообразие")
describe('the tracks stay apart', () => {
  type Track = (typeof SONGS)[number];
  const notesOf = (line: readonly (MelodyNote | null)[]) =>
    line.filter((note): note is MelodyNote => note !== null);
  const tracks = SONGS.filter((song) => !song.sketch);
  const pairs = tracks.flatMap((a, i) => tracks.slice(i + 1).map((b) => [a, b] as const));
  const partsOf = (song: Track) => [...new Set(song.form.map((i) => song.sections[i]))];
  const part = (song: Track, tier: 'groove' | 'high') =>
    partsOf(song).find((section) => section.tier === tier)!;
  const melodies = (song: Track) =>
    partsOf(song).filter((s) => (s.tier === 'groove' || s.tier === 'high') && s.lead);
  const cosine = (a: number[], b: number[]) =>
    a.reduce((sum, x, i) => sum + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b));
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

  /** Where in the bar the melodies' notes start. */
  const onsets = (song: Track) => {
    const counts = Array<number>(STEPS_PER_BAR).fill(0);
    for (const section of melodies(song)) {
      section.lead!.forEach((note, step) => {
        if (note) counts[step % STEPS_PER_BAR]++;
      });
    }
    return counts;
  };
  /** How the melodies move: leaps and steps down, repeats, steps and leaps up. */
  const intervals = (song: Track) => {
    const counts = Array<number>(7).fill(0);
    for (const section of melodies(song)) {
      const notes = notesOf(section.lead!);
      for (let i = 1; i < notes.length; i++) {
        const d = notes[i].note - notes[i - 1].note;
        counts[d <= -5 ? 0 : d <= -3 ? 1 : d < 0 ? 2 : d === 0 ? 3 : d <= 2 ? 4 : d <= 4 ? 5 : 6]++;
      }
    }
    return counts;
  };
  /** The melodies' notes by pitch class, weighted by length: the key and mode they sing in. */
  const keyOf = (song: Track) => {
    const weights = Array<number>(12).fill(0);
    for (const section of melodies(song)) {
      for (const note of notesOf(section.lead!)) weights[note.note % 12] += note.steps;
    }
    return weights;
  };
  const register = (song: Track, tier: 'groove' | 'high') =>
    median(notesOf(part(song, tier).lead ?? []).map((note) => note.note));
  const beatOf = (song: Track) => {
    const peak = part(song, 'high');
    const beat = DRUM_PATTERNS[peak.drums] as { kick?: string; snare?: string; clap?: string };
    return `${beat.kick ?? ''}/${beat.snare ?? beat.clap ?? ''}/${peak.feel ?? ''}`;
  };
  const isMinor = (song: Track) => part(song, 'groove').chords[0].triad[1] === 3;
  const frameOf = (song: Track) =>
    song.form.map((i) => `${song.sections[i].tier}:${song.sections[i].bars}`).join(' ');

  // What the ear takes two tracks to share, and how much each counts: the melody (its rhythm, its
  // moves, its register) and the chorus's sound (its voice, its beat) the most
  const SHARED: { name: string; weight: number; isShared: (a: Track, b: Track) => boolean }[] = [
    { name: 'melodic rhythm', weight: 2, isShared: (a, b) => cosine(onsets(a), onsets(b)) >= 0.9 },
    {
      name: 'melodic moves',
      weight: 1,
      isShared: (a, b) => cosine(intervals(a), intervals(b)) >= 0.95,
    },
    {
      name: 'register',
      weight: 1,
      isShared: (a, b) =>
        Math.abs(register(a, 'groove') - register(b, 'groove')) < 3 &&
        Math.abs(register(a, 'high') - register(b, 'high')) < 3,
    },
    {
      name: 'chorus voice',
      weight: 2,
      isShared: (a, b) =>
        (part(a, 'high').leadVoice ?? a.voices.lead) ===
        (part(b, 'high').leadVoice ?? b.voices.lead),
    },
    { name: 'peak beat', weight: 1.5, isShared: (a, b) => beatOf(a) === beatOf(b) },
    { name: 'key', weight: 1, isShared: (a, b) => cosine(keyOf(a), keyOf(b)) >= 0.9 },
    { name: 'mood', weight: 1, isShared: (a, b) => isMinor(a) === isMinor(b) },
    { name: 'tempo', weight: 1.5, isShared: (a, b) => Math.abs(a.bpm - b.bpm) < 8 },
    { name: 'frame', weight: 0.5, isShared: (a, b) => frameOf(a) === frameOf(b) },
  ];
  // Of the 11.5 the weights add up to, two tracks sharing this much sound like one. Set by the
  // ear: Above the Clouds and Sunset Strip as the user heard them blur (25.10.2026: one melodic
  // rhythm and moves, both major, 96 and 100 BPM) came to 5.5; Neon Cathedral and Kabukicho Rain,
  // heard apart, share 5 (rhythm, moves, register, both minor, 16 BPM between them)
  const TOO_ALIKE = 5.5;

  it('never lets two sound like one: the melody, the chorus and the rest at once', () => {
    for (const [a, b] of pairs) {
      const shared = SHARED.filter((thing) => thing.isShared(a, b));
      const score = shared.reduce((sum, thing) => sum + thing.weight, 0);
      expect(
        score,
        `${a.title} and ${b.title}: ${shared.map((t) => t.name).join(', ')}`,
      ).toBeLessThan(TOO_ALIKE);
    }
  });
});

describe('sketches', () => {
  it('are never played by the game: never picked as the next song', async () => {
    const { Conductor } = await import('@/audio/music/Conductor');
    const { compileSong } = await import('@/audio/music/score');
    const sketch = compileSong({
      ...SONG_DEFS_FOR_TEST,
      title: 'A Sketch',
      sketch: true,
    });
    const songs = [...SONGS.filter((song) => !song.sketch), sketch];
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      const conductor = new Conductor(songs, 0, 'groove', () => roll);
      conductor.enterScene('lasers');
      for (let i = 0; i < 6; i++) {
        conductor.skip('groove');
        conductor.advance();
        expect(conductor.song.sketch, conductor.song.title).toBeFalsy();
      }
    }
  });
});

/** A song of one section, enough for the sketch above. */
const SONG_DEFS_FOR_TEST: Omit<SongDef, 'title'> = {
  bpm: 120,
  swing: 0,
  voices: { lead: 'saw', counter: 'bell', arp: 'square', bass: 'sawtooth' },
  sections: [
    { name: 'hook', tier: 'groove', chords: 'Am', bass: 'long', drums: 'four', pad: 'hold' },
  ],
};
