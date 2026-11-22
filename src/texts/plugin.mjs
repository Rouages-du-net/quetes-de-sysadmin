// A Vite plugin that groups the game's texts (src/texts/<language>/*.ftl)
// into the pieces the game loads, each when it needs it (see index.ts):
//
//   <language>/core          every file but the stories' and the manual's pages,
//                            plus each chapter's title (`chapter-<id>` and its
//                            .summary, for the menu) and the manual's own
//                            messages (headers, option errors)
//   <language>/shared        machines.ftl, names.ftl, desk.ftl: loaded for
//                            every language with any language's core
//   <language>/manual        the manual's pages (man-*: man, --help, apropos)
//   <language>/story-<id>    a story's files (chapter-*.ftl, hints-*.ftl), listed
//                            in src/engine/catalogue.json (npm run catalogue)
//
// `virtual:qds-texts` lists the languages and, for each group, a loader
// (a dynamic import: Vite makes each group its own chunk, with a hashed name).
// Used by astro.config.mjs, vite.integration.config.ts and vitest.config.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXTS = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = join(TEXTS, '../engine/catalogue.json');
const INDEX = 'virtual:qds-texts';
const PREFIX = `${INDEX}/texts-`;

/** The entries of a Fluent file: each message or term with the comments just above it. */
export function entries(source) {
  const out = [];
  let comments = [];
  let current = null;
  for (const line of source.split('\n')) {
    if (line === '' || /^\s/.test(line)) {
      if (current) current.lines.push(line);
      else if (line !== '') comments.push(line);
      continue;
    }
    if (line.startsWith('#')) {
      current = null;
      comments.push(line);
      continue;
    }
    const id = /^-?([a-zA-Z][\w-]*)\s*=/.exec(line)?.[1] ?? '';
    current = { id, lines: [...comments, line] };
    comments = [];
    out.push(current);
  }
  return out.map((e) => ({ id: e.id, text: e.lines.join('\n').replace(/\n+$/, '') }));
}

const languages = () => readdirSync(TEXTS, { withFileTypes: true }).filter((d) => d.isDirectory() && readdirSync(join(TEXTS, d.name)).some((f) => f.endsWith('.ftl'))).map((d) => d.name).sort();
// Read in every language at once: a save made in another language (machine
// names, the player's account, the workstation's ssh config) is translated
// into the current one (console.ts).
const SHARED = ['desk.ftl', 'machines.ftl', 'names.ftl'];
const storyFile = (f) => /^(chapter|hints)-/.test(f);

// Groups computed once per language (until a text file changes).
const cache = new Map();

/** The groups of a language: name → [file label, Fluent source][]. */
export function groups(language) {
  if (!cache.has(language)) cache.set(language, computeGroups(language));
  return cache.get(language);
}

function computeGroups(language) {
  const dir = join(TEXTS, language);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ftl')).sort();
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  const stories = JSON.parse(readFileSync(CATALOGUE, 'utf8')).stories;
  const claimed = new Set(stories.flatMap((s) => s.texts));
  const core = [];
  const shared = [];
  const titles = [];
  const manualOwn = [];
  const pages = [];
  for (const f of files) {
    if (f === 'manual.ftl') {
      for (const e of entries(read(f))) (e.id.startsWith('man-') ? pages : manualOwn).push(e.text);
    } else if (storyFile(f) && claimed.has(f)) {
      const title = f.startsWith('chapter-') && entries(read(f)).find((e) => e.id === f.slice(0, -4));
      if (title) titles.push(title.text);
    } else (SHARED.includes(f) ? shared : core).push([f, read(f)]);
  }
  const result = {
    core: [...core, ['manual.ftl (own messages)', manualOwn.join('\n')], ['chapter titles', titles.join('\n')]],
    shared,
    manual: [['manual.ftl (pages)', pages.join('\n')]],
  };
  for (const s of stories) result[`story-${s.id}`] = s.texts.filter((f) => files.includes(f)).map((f) => [f, read(f)]);
  return result;
}

export function qdsTexts() {
  return {
    name: 'qds-texts',
    watchChange() {
      cache.clear();
    },
    resolveId(id) {
      if (id === INDEX || id.startsWith(PREFIX)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith('\0')) return;
      const name = id.slice(1);
      this.addWatchFile(CATALOGUE);
      if (name === INDEX) {
        const loaders = languages().flatMap((l) =>
          Object.keys(groups(l)).map((g) => `  ${JSON.stringify(`${l}/${g}`)}: () => import(${JSON.stringify(`${PREFIX}${l}--${g}`)}).then((m) => m.default),`),
        );
        return `export const LANGUAGES = ${JSON.stringify(languages())};\nexport const GROUPS = {\n${loaders.join('\n')}\n};\n`;
      }
      if (name.startsWith(PREFIX)) {
        const [language, group] = name.slice(PREFIX.length).split('--');
        for (const f of readdirSync(join(TEXTS, language))) if (f.endsWith('.ftl')) this.addWatchFile(join(TEXTS, language, f));
        return `export default ${JSON.stringify(groups(language)[group] ?? [])};\n`;
      }
    },
  };
}
