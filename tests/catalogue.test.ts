// src/engine/catalogue.json: what the menu knows about every story without
// loading it, generated from chapters/index.ts. `npm run catalogue`
// (UPDATE_CATALOGUE=1) rewrites it; this test fails while it is out of date.
// It also checks the story modules (stories/<id>.ts) the game loads lazily.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STORIES } from '../src/engine/chapters';
import { CATALOGUE } from '../src/engine/catalogue';
import { loadStory, STORY_MODULES } from '../src/engine/story-registry';
import { FAMILIES, familyCommands, type Family } from '../src/engine/families';

const FILE = 'src/engine/catalogue.json';
const FAMILY_FILE = 'src/engine/families.json';
const TEXTS = 'src/texts/en';
const CHAPTERS = 'src/engine/chapters';

// The story text files (chapter-*.ftl, hints-*.ftl) and the keys they define.
const keyFile = new Map<string, string>();
for (const f of readdirSync(TEXTS).filter((f) => /^(chapter|hints)-.*\.ftl$/.test(f)))
  for (const line of readFileSync(join(TEXTS, f), 'utf8').split('\n')) {
    const m = /^([a-z][\w-]*)\s*=/.exec(line);
    if (m) keyFile.set(m[1], f);
  }
const keys = [...keyFile.keys()];

// The story text files a module's code names: a key written whole
// ('village-crier'), or the start of one before a ${…} (`village-notice-${x}`).
// `chapter-${id}` (every chapter's title) is in the catalogue's titles, loaded upfront.
function textsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  const out = new Set<string>();
  for (const m of code.matchAll(/['"`]([a-z][a-z0-9-]*[a-z0-9])(?:\.[a-z0-9-]+)?['"`]/g)) if (keyFile.has(m[1])) out.add(keyFile.get(m[1])!);
  for (const m of code.matchAll(/`([a-z][a-z0-9-]*-)\$\{/g))
    if (m[1].length >= 6 && m[1] !== 'chapter-') for (const k of keys) if (k.startsWith(m[1])) out.add(keyFile.get(k)!);
  return [...out];
}

// A story's text files: its chapters' and hints' files, and those its
// modules (and the chapter modules they import, of other stories too) name.
function storyTexts(id: string, chapters: string[]): string[] {
  const seen = new Set<string>();
  const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/from '\.\.?\/(?:chapters\/)?([\w-]+)'/g)].map((m) => join(CHAPTERS, `${m[1]}.ts`));
  const stack = imports(`src/engine/stories/${id}.ts`).filter(existsSync);
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...imports(f).filter(existsSync));
  }
  const files = new Set([...chapters.map((c) => `chapter-${c}.ftl`), `hints-${id}.ftl`, ...[...seen].flatMap(textsOf)]);
  return [...files].filter((f) => existsSync(join(TEXTS, f))).sort();
}

const generated = () => ({
  stories: STORIES.map((s) => ({
    id: s.id,
    ...(s.after ? { after: s.after } : {}),
    texts: storyTexts(
      s.id,
      s.chapters.map((c) => c.id),
    ),
    chapters: s.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      commands: c.commands,
      ...(c.withhold ? { withhold: c.withhold } : {}),
      events: c.events.length,
      ...(c.watchesWorkstation ? { watchesWorkstation: true } : {}),
      ...(c.playerKeys ? { playerKeys: true } : {}),
    })),
  })),
});

// families.json: each family command's family and entry, without its
// implementation (what the table of commands holds before the family loads).
const familyEntries = () => {
  const out: [string, [string, unknown]][] = [];
  for (const f of Object.keys(FAMILIES) as Family[])
    for (const [name, { launch: _, ...entry }] of Object.entries(familyCommands(f))) out.push([name, [f, entry]]);
  return Object.fromEntries(out.sort(([a], [b]) => (a < b ? -1 : 1)));
};

describe('The catalogue', () => {
  it('is up to date with chapters/index.ts (npm run catalogue)', () => {
    const json = `${JSON.stringify(generated(), null, 1)}\n`;
    if (process.env.UPDATE_CATALOGUE) writeFileSync(FILE, json);
    expect(readFileSync(FILE, 'utf8'), 'catalogue.json is out of date: run `npm run catalogue`').toBe(json);
  });

  it('knows each engine family\'s commands (families.json, npm run catalogue)', () => {
    const json = `${JSON.stringify(familyEntries(), null, 1)}\n`;
    if (process.env.UPDATE_CATALOGUE) writeFileSync(FAMILY_FILE, json);
    expect(readFileSync(FAMILY_FILE, 'utf8'), 'families.json is out of date: run `npm run catalogue`').toBe(json);
  });

  it('has a story module per story, with the same chapters', async () => {
    expect(Object.keys(STORY_MODULES).sort()).toEqual(STORIES.map((s) => `./stories/${s.id}.ts`).sort());
    for (const s of STORIES) {
      const loaded = await loadStory(s.id);
      // The registry hands the tests' stories back (tests/setup.ts registers them).
      expect(loaded).toBe(s);
      const module = await STORY_MODULES[`./stories/${s.id}.ts`]();
      expect(module.chapters).toBe(s.chapters);
    }
    expect(CATALOGUE.map((s) => s.id)).toEqual(STORIES.map((s) => s.id));
  });
});
