// The names of places and objects, in each language: easy to type
// (unaccented letters, digits, dot, hyphen, underscores), no two identical
// names in the same directory, and Tab completion finds them.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { workstation } from '../src/engine/workstation';
import { name, path, translateNames, type Directory } from '../src/engine/world';
import { LANGUAGES, translator } from '../src/texts';

const other = LANGUAGES.map((l) => translator(l));
const translated = [...STORIES.flatMap((h) => h.chapters), workstation([])].filter((c) => c.names);

// All the names of a world, with their path.
const walk = (directory: Directory, here = ''): string[] =>
  Object.entries(directory.children).flatMap(([n, e]) => [`${here}/${n}`, ...(e.type === 'directory' ? walk(e, `${here}/${n}`) : [])]);

for (const language of LANGUAGES)
  describe(`Names in ${language}`, () => {
    const t = translator(language);

    it('each story that translates its names keeps all its places and objects, under names easy to type', () => {
      expect(translated.length).toBeGreaterThanOrEqual(5);
      for (const c of translated) {
        const s = new Shell(c, language);
        // The world as the chapter creates it, before what its initialise adds
        // (a restic repository…): two names that become identical once translated
        // would overwrite a place there.
        const french = walk(c.createWorld(t));
        expect(walk(translateNames(t, c.createWorld(t))).length, c.id).toBe(french.length);
        // The names a language translates (system names, lost+found included,
        // stay as they are).
        for (const ch of french) {
          const n = ch.split('/').at(-1)!;
          if (other.some((u) => name(u, n) !== n)) expect(name(t, n), `${c.id} : ${ch}`).toMatch(/^[A-Za-z0-9._-]+$/);
        }
        expect(s.find(s.home)?.type, c.id).toBe('directory');
        expect(s.exists(`${s.home}/${s.welcome}`), c.id).toBe(true);
      }
    });

    // The collision safeguard: a name added to names.ftl renames that name in
    // every chapter with names: true, including where nobody expected it (a
    // /srv/backup of another story). The list of all renamings is kept in
    // tests/names/: a new renaming makes this test fail; if it is intended,
    // reread the produced file and update it with
    // "npx vitest run -u tests/names.test.ts".
    it.runIf(language !== 'en')('the renamings are the expected ones (tests/names/)', async () => {
      // A story's internal machines are renamed like its main machine.
      const mondes = translated.flatMap((c) => [
        { id: c.id, createWorld: c.createWorld },
        ...Object.entries(c.hosts ?? {}).map(([h, def]) => ({ id: `${c.id}:${h}`, createWorld: def.createWorld })),
      ]);
      const lines = mondes.flatMap((c) => {
        const renamed = walk(c.createWorld(t))
          .filter((ch) => path(t, ch) !== ch)
          .map((ch) => `  ${ch} → ${path(t, ch)}`);
        return renamed.length ? [`${c.id}`, ...renamed, ''] : [];
      });
      await expect(lines.join('\n')).toMatchFileSnapshot(`./names/renamed.${language}.txt`);
    });

    it('Tab completes the translated names', () => {
      const s = new Shell(STORIES[0].chapters[0], language);
      const hill = name(t, 'Hill');
      expect(s.complete(`cd ${hill.slice(0, 2)}`)).toBe(`cd ${hill}/`);
      const school = name(t, 'SignalSchool');
      expect(s.complete(`cd ${hill}/${school.slice(0, 3)}`)).toBe(`cd ${hill}/${school}/`);
      expect(s.complete(`cat ${name(t, 'message.txt').slice(0, 3)}`)).toBe(`cat ${name(t, 'message.txt')} `);
    });
  });
