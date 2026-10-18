import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every TypeScript file under `dir`, recursively. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });

/** The top-level directories of src/ that `file` imports from, e.g. ['match', 'shared']. */
const importedLayers = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/from '@\/([^/']+)/g)].map((match) => match[1]);

/** The files of `layer` that import a layer outside `allowed`, with what they import. */
const violations = (layer: string, allowed: string[]) =>
  sourceFiles(join('src', layer)).flatMap((file) =>
    importedLayers(file)
      .filter((imported) => !allowed.includes(imported))
      .map((imported) => `${file} imports @/${imported}`),
  );

/** The layering in docs/ARCHITECTURE.md that keeps the game apart from its presentation. */
describe('architecture', () => {
  it('keeps the match free of pixels, sound and the DOM', () => {
    expect(violations('match', ['match', 'shared'])).toEqual([]);
  });

  it('keeps shared/ free of the rest of the project', () => {
    expect(violations('shared', ['shared'])).toEqual([]);
  });
});
