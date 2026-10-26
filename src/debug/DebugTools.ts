import { AudioEngine } from '@/audio/AudioEngine';
import { BackgroundMenu } from '@/debug/BackgroundMenu';
import { DebugDock, DockPanel } from '@/debug/DebugDock';
import { ModifierMenu } from '@/debug/ModifierMenu';
import { SkillMenu, SkillOwner } from '@/debug/SkillMenu';
import { SoundStand } from '@/debug/SoundStand';
import { SceneId } from '@/shared/scenes';

/** What the developer tools are given by the game, and tell it back. */
export interface DebugToolsDeps {
  /** The FPS line that heads the dock. */
  readonly header: HTMLElement;
  readonly audio: AudioEngine;
  /** Every background a developer can pin. */
  readonly scenes: readonly SceneId[];
  /** A background was pinned. */
  pickBackground(scene: SceneId): void;
  readonly skills: readonly string[];
  /** The skills each side has to begin with (?skills=, ?cpuSkills=). */
  readonly pinnedSkills: Record<SkillOwner, readonly string[]>;
  chooseSkills(owner: SkillOwner, skills: string[]): void;
  readonly modifiers: readonly string[];
  /** The modifiers the quick matches have to begin with (?mods=). */
  readonly pinnedModifiers: readonly string[];
  chooseModifiers(modifiers: string[]): void;
}

/**
 * The developer tools under the FPS line: a dock with a tab each for the backgrounds, the
 * skills, the modifiers and the sound stand. Loaded on their own, only when a developer asks for
 * them (`?debug`, F3, or a link to the sound stand), so a player never downloads them.
 */
export class DebugTools {
  private readonly backgroundMenu: BackgroundMenu;
  private readonly skillMenu: SkillMenu;
  private readonly modifierMenu: ModifierMenu;
  private readonly soundStand: SoundStand;
  private readonly dock: DebugDock;

  constructor(deps: DebugToolsDeps) {
    this.backgroundMenu = new BackgroundMenu((scene) => deps.pickBackground(scene), deps.scenes);
    this.skillMenu = new SkillMenu(deps.skills, deps.pinnedSkills, (owner, skills) =>
      deps.chooseSkills(owner, skills),
    );
    this.modifierMenu = new ModifierMenu(deps.modifiers, deps.pinnedModifiers, (modifiers) =>
      deps.chooseModifiers(modifiers),
    );
    // ?song=neon-cathedral&part=chorus&mute=drums holds the music there (the listening stand)
    this.soundStand = new SoundStand(deps.audio);
    // The FPS meter heads one dock of the tools, a tab each, so none crowds another or the court
    this.dock = new DebugDock(deps.header, [
      panel('bg', this.backgroundMenu),
      panel('skills', this.skillMenu),
      panel('mods', this.modifierMenu),
      panel('sound', this.soundStand),
    ]);
  }

  public setVisible(isVisible: boolean): void {
    this.dock.setVisible(isVisible);
  }

  /** The background on show, marked in its menu. */
  public setScene(scene: SceneId): void {
    this.backgroundMenu.setCurrent(scene);
  }

  /** Each skill's uses in the match on court, the player's and the CPU's. */
  public setSkillCounts(uses: ReadonlyMap<string, [number, number]>): void {
    this.skillMenu.setCounts(uses);
  }

  public dispose(): void {
    this.backgroundMenu.dispose();
    this.skillMenu.dispose();
    this.modifierMenu.dispose();
    this.soundStand.dispose();
    this.dock.dispose();
  }
}

/** A debug tool as a tab of the dock. */
function panel(
  name: string,
  tool: { element: HTMLElement; setVisible(isVisible: boolean): void },
): DockPanel {
  return { name, element: tool.element, setVisible: (isVisible) => tool.setVisible(isVisible) };
}
