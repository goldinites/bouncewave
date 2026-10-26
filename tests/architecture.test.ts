import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every TypeScript file under `dir` (screens with JSX included), recursively. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });

/** The top-level directories of src/ that `file` imports from, e.g. ['match', 'shared'];
 * dynamic imports (`import('@/debug/…')`) and side-effect imports count too. */
const importedLayers = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from |import\(\s*|import )'@\/([^/']+)/g)].map(
    (match) => match[1],
  );

/** The files of `layer` that import a layer outside `allowed`, with what they import. */
const violations = (layer: string, allowed: readonly string[]) =>
  sourceFiles(join('src', layer)).flatMap((file) =>
    importedLayers(file)
      .filter((imported) => imported !== layer && !allowed.includes(imported))
      .map((imported) => `${file} imports @/${imported}`),
  );

/**
 * What each layer may import besides itself: the table in docs/ARCHITECTURE.md, "Layers and their
 * dependencies". `app/` is the composition root and may import anything; `styles/` holds no code.
 */
const LAYERS: Record<string, readonly string[]> = {
  shared: [],
  match: ['shared'],
  settings: ['match', 'i18n', 'shared'],
  profile: ['settings', 'match', 'shared'],
  i18n: ['match', 'shared'],
  input: ['match', 'shared'],
  audio: ['match', 'shared'],
  // The renderer only reads what fx/ leaves it: fx/ moves particles and calls the renderer
  render: ['match', 'shared'],
  fx: ['match', 'render', 'audio', 'shared'],
  ui: ['match', 'audio', 'settings', 'profile', 'i18n', 'shared'],
  debug: ['match', 'audio', 'shared'],
  easterEgg: ['audio', 'shared'],
};
const UNCHECKED = ['app', 'styles'];

/** The layering in docs/ARCHITECTURE.md that keeps the game apart from its presentation. */
describe('architecture', () => {
  it.each(Object.entries(LAYERS))(
    'keeps %s/ to the layers the table allows it',
    (layer, allowed) => {
      expect(violations(layer, allowed)).toEqual([]);
    },
  );

  it('gives every directory of src/ a row in the table', () => {
    const layers = readdirSync('src').filter((name) => statSync(join('src', name)).isDirectory());
    expect(layers.filter((name) => !(name in LAYERS) && !UNCHECKED.includes(name))).toEqual([]);
  });

  it('sees a dynamic import as an import', () => {
    // The developer tools reach the game only through Game's import() of them
    const fromGame = violations('app', []).filter((line) => line.includes('Game.ts'));
    expect(fromGame).toContainEqual(expect.stringMatching(/imports @\/debug$/));
  });
});
