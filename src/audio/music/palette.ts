import { KITS, KitName } from '@/audio/music/kits';
import { BassVoice, LeadVoice, PadVoice, Song, StabVoice } from '@/audio/music/score';
import { EXTRA_PITCHED, ExtraPitchedId } from '@/audio/samples/extra';
import { EXTRA_LEAD_FOR, EXTRA_LEADS } from '@/audio/samples/leads';
import { EXTRA_DRUMS, FX_HITS } from '@/audio/samples/percussion';
import { PitchedSampleId } from '@/audio/samples/pitched';
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
  choir: 'padChoir',
  reverse: 'padReverse',
};

/** The rendered sound each stab voice plays. */
export const STAB_SOUND: Record<StabVoice, PitchedSampleId | ExtraPitchedId> = {
  brass: 'brass',
  rhodes: 'stabRhodes',
  guitar: 'stabGuitar',
  strings: 'stabStrings',
};

const isExtraPitched = (id: string): id is ExtraPitchedId => id in EXTRA_PITCHED;

/**
 * The sounds beyond the core palette a song plays, with the stand's swaps (docs/AUDIO.md): its
 * extra leads, bass, pad and stab voices, its kit's extra drums and the hits its parts strike —
 * rendered just before it plays, so a sound no song in play uses takes no memory.
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
    ...song.sections.flatMap((s) => [s.leadVoice, s.counterVoice]),
  ];
  for (const voice of leads) {
    const id = voice && EXTRA_LEAD_FOR[voice];
    if (id) pitched[id] = EXTRA_LEADS[id];
  }
  const tones = [
    overrides.bass ?? song.voices.bass,
    PAD_SOUND[overrides.pad ?? song.voices.pad ?? 'synth'],
    ...song.sections.map((s) => STAB_SOUND[s.stabsVoice ?? 'brass']),
  ];
  for (const id of tones) if (isExtraPitched(id)) pitched[id] = EXTRA_PITCHED[id];
  const kit = KITS[overrides.kit ?? song.kit ?? 'synthwave'];
  for (const id of Object.values(kit)) {
    if (id in EXTRA_DRUMS) oneShots[id] = EXTRA_DRUMS[id as keyof typeof EXTRA_DRUMS];
  }
  for (const section of song.sections) {
    for (const id of Object.keys(section.hits ?? {})) {
      oneShots[id] = FX_HITS[id as keyof typeof FX_HITS];
    }
  }
  return { pitched, oneShots };
}
