import { describe, expect, it, vi } from 'vitest';
import { CHALLENGE_IDS, CHALLENGES } from '@/match/challenges';
import { Background } from '@/render/backgrounds/Background';
import { BackgroundRenderer } from '@/render/BackgroundRenderer';
import {
  ALL_SCENES,
  BACKGROUND_CHOICES,
  EXCLUSIVE_SCENES,
  isPickableScene,
  isSceneId,
  SceneId,
} from '@/shared/scenes';

const fakeBackground = (scene: SceneId): Background => ({ scene, overlayTint: 0, render: vi.fn() });

describe("the challenges' own scenes", () => {
  it('are scenes, but never the player’s to pick, like any mode’s own', () => {
    const own = Object.values(EXCLUSIVE_SCENES).flat();
    expect(EXCLUSIVE_SCENES.challenges).toEqual(['warehouse', 'dojo', 'brokenNet']);
    expect(ALL_SCENES).toEqual(expect.arrayContaining(own));
    expect(new Set(ALL_SCENES).size).toBe(ALL_SCENES.length);
    for (const scene of own) {
      expect(isSceneId(scene)).toBe(true);
      expect(isPickableScene(scene)).toBe(false);
      expect(BACKGROUND_CHOICES).not.toContain(scene);
    }
    expect(isPickableScene('fuji')).toBe(true);
  });

  it('go one to a tier: three challenges each, in the order of the list', () => {
    expect(CHALLENGE_IDS.map((id) => CHALLENGES[id].scene)).toEqual([
      ...Array(3).fill('warehouse'),
      ...Array(3).fill('dojo'),
      ...Array(3).fill('brokenNet'),
    ]);
  });
});

describe('a match asking for its own scene', () => {
  const backgrounds = () => [
    fakeBackground('lasers'),
    fakeBackground('fuji'),
    fakeBackground('warehouse'),
  ];

  it('is played on it, and the next match on the player’s again', () => {
    const renderer = new BackgroundRenderer(backgrounds(), () => 0.5);
    renderer.choose('fuji');

    expect(renderer.switchChannel(false, 'warehouse')).toBe('warehouse');
    expect(renderer.switchChannel(false, 'warehouse')).toBe('warehouse'); // stays
    expect(renderer.switchChannel(false)).toBe('fuji');
  });

  it('gets the player’s when its scene has no background yet', () => {
    const renderer = new BackgroundRenderer([fakeBackground('lasers'), fakeBackground('fuji')]);
    renderer.choose('fuji');
    expect(renderer.switchChannel(false, 'dojo')).toBe('fuji');
  });

  it('never has a challenge’s scene dealt for a quick match, nor opens on one', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 20; i++) {
      const renderer = new BackgroundRenderer(backgrounds(), random);
      expect(renderer.scene).not.toBe('warehouse');
      for (let k = 0; k < 10; k++) expect(renderer.switchChannel(true)).not.toBe('warehouse');
    }
  });
});
