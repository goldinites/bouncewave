import { KITS, KitName } from '@/audio/music/kits';
import { BassVoice, LeadVoice, PadVoice, Song, StabVoice } from '@/audio/music/score';
import { EXTRA_PITCHED, ExtraPitchedId } from '@/audio/samples/extra';
import { EXTRA_LEADS, LEAD_SAMPLE_FOR, LOW_TWINS } from '@/audio/samples/leads';
import { DRUM_SAMPLES } from '@/audio/samples/drums';
import { EXTRA_DRUMS, FX_HITS } from '@/audio/samples/percussion';
import { PITCHED_SAMPLES, PitchedSampleId } from '@/audio/samples/pitched';
import { PitchedRecipe, SampleRecipe } from '@/audio/samples/SampleBank';

/** The listening stand's swaps, heard on any song: another lead, bass, pad or kit. */
export interface VoiceOverrides {
  lead?: LeadVoice;
  bass?: BassVoice;
  pad?: PadVoice;
  kit?: KitName;
}

/** The rendered sound each pad voice plays. */
export const PAD_SOUND: Record<PadVoice, PitchedSampleId | ExtraPitchedId> = {
  synth: 'pad',
  strings: 'padStrings',
  reverse: 'padReverse',
};

/** The rendered sound each stab voice plays. */
export const STAB_SOUND: Record<StabVoice, PitchedSampleId | ExtraPitchedId> = {
  brass: 'brass',
  rhodes: 'stabRhodes',
  guitar: 'stabGuitar',
  strings: 'stabStrings',
};

/** A pitched instrument's recipe, from the core or the wider palette; undefined for a live voice. */
const pitchedRecipe = (id: string): PitchedRecipe | undefined =>
  (PITCHED_SAMPLES as Record<string, PitchedRecipe>)[id] ??
  (EXTRA_LEADS as Record<string, PitchedRecipe>)[id] ??
  (EXTRA_PITCHED as Record<string, PitchedRecipe>)[id];

/** A drum's recipe, from the core kits or the wider palette's. */
const drumRecipe = (id: string): SampleRecipe | undefined =>
  (DRUM_SAMPLES as Record<string, SampleRecipe>)[id] ??
  (EXTRA_DRUMS as Record<string, SampleRecipe>)[id];

/**
 * Every sound the songs play but the transitions: rendered on demand for the song playing and
 * the one coming up, and so the ones freed (docs/AUDIO.md, "Палитра инструментов"). The action
 * sounds and the transitions stay rendered all along.
 */
export const LAZY_SOUND_IDS: readonly string[] = [
  ...Object.keys(DRUM_SAMPLES),
  ...Object.keys(PITCHED_SAMPLES),
  ...Object.keys(EXTRA_LEADS),
  ...Object.values(LOW_TWINS).map((twin) => twin.id),
  ...Object.keys(EXTRA_PITCHED),
  ...Object.keys(EXTRA_DRUMS),
  ...Object.keys(FX_HITS),
];

/**
 * The songs' sounds none of `songs` plays — the song playing and the one coming up —
 * free to release: without it, every song of a long session would leave its sounds behind and
 * the rendered sounds would outgrow their memory budget (docs/AUDIO.md, "Бюджеты").
 */
export function unneeded(songs: readonly Song[], overrides: VoiceOverrides = {}): string[] {
  const keep = new Set(
    songs.flatMap((song) => {
      const { pitched, oneShots } = soundsFor(song, overrides);
      return [...Object.keys(pitched), ...Object.keys(oneShots)];
    }),
  );
  return LAZY_SOUND_IDS.filter((id) => !keep.has(id));
}

/**
 * The sounds a song plays, with the stand's swaps (docs/AUDIO.md): its leads, arpeggio, bass, pad
 * and stab voices, its kit's drums and the hits its parts strike — rendered just before it
 * plays, so a sound no song in play uses takes no memory. Its finale's fanfare is brass, whatever
 * its stabs.
 */
export function soundsFor(
  song: Song,
  overrides: VoiceOverrides = {},
): { pitched: Record<string, PitchedRecipe>; oneShots: Record<string, SampleRecipe> } {
  const pitched: Record<string, PitchedRecipe> = {};
  const oneShots: Record<string, SampleRecipe> = {};
  const leads = [
    song.voices.lead,
    song.voices.counter,
    overrides.lead,
    ...song.sections.flatMap((s) => [s.leadVoice, s.counterVoice, s.arpVoice]),
  ];
  // A song whose melodies go under a lead's roots gets the lead's low twin too
  const lowest = Math.min(
    ...song.sections.flatMap((s) =>
      [...(s.lead ?? []), ...(s.counter ?? [])].flatMap((note) => (note ? [note.note] : [])),
    ),
  );
  for (const voice of leads) {
    const id = voice && LEAD_SAMPLE_FOR[voice];
    if (!id) continue;
    pitched[id] = pitchedRecipe(id)!;
    const twin = LOW_TWINS[id];
    if (twin && lowest < twin.below) pitched[twin.id] = twin.recipe;
  }
  const tones: string[] = [
    song.voices.arp,
    overrides.bass ?? song.voices.bass,
    PAD_SOUND[overrides.pad ?? song.voices.pad ?? 'synth'],
    STAB_SOUND.brass,
    ...song.sections.map((s) => STAB_SOUND[s.stabsVoice ?? 'brass']),
  ];
  for (const id of tones) {
    const recipe = pitchedRecipe(id);
    if (recipe) pitched[id] = recipe;
  }
  const kit = KITS[overrides.kit ?? song.kit ?? 'synthwave'];
  for (const id of Object.values(kit)) {
    const recipe = drumRecipe(id);
    if (recipe) oneShots[id] = recipe;
  }
  for (const section of song.sections) {
    for (const id of Object.keys(section.hits ?? {})) {
      oneShots[id] = FX_HITS[id as keyof typeof FX_HITS];
    }
  }
  return { pitched, oneShots };
}
