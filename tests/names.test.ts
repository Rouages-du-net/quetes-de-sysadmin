// Les noms des lieux et des objets, dans chaque langue : faciles à taper
// (lettres sans accent, chiffres, point, tiret, soulignés), sans deux noms
// pareils dans un même dossier, et la complétion par Tab les trouve.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { workstation } from '../src/engine/workstation';
import { name, translateNames, type Directory } from '../src/engine/world';
import { LANGUAGES, translator } from '../src/texts';

const other = LANGUAGES.map((l) => translator(l));
const translated = [...STORIES.flatMap((h) => h.chapters), workstation([])].filter((c) => c.names);

// Tous les noms d'un monde, avec leur chemin.
const walk = (directory: Directory, here = ''): string[] =>
  Object.entries(directory.children).flatMap(([n, e]) => [`${here}/${n}`, ...(e.type === 'dossier' ? walk(e, `${here}/${n}`) : [])]);

for (const language of LANGUAGES)
  describe(`Noms en ${language}`, () => {
    const t = translator(language);

    it('chaque histoire qui traduit ses noms garde tous ses lieux et objets, sous des noms faciles à taper', () => {
      expect(translated.length).toBeGreaterThanOrEqual(5);
      for (const c of translated) {
        const s = new Shell(c, language);
        // Le monde tel que le chapitre le crée, avant ce qu'y ajoute son
        // initialiser (un dépôt restic…) : deux noms français devenus
        // pareils y écraseraient un lieu.
        const french = walk(c.createWorld(t));
        expect(walk(translateNames(t, c.createWorld(t))).length, c.id).toBe(french.length);
        // Les noms qu'une langue traduit (les noms du système, lost+found
        // compris, restent tels quels).
        for (const ch of french) {
          const n = ch.split('/').at(-1)!;
          if (other.some((u) => name(u, n) !== n)) expect(name(t, n), `${c.id} : ${ch}`).toMatch(/^[A-Za-z0-9._-]+$/);
        }
        expect(s.find(s.home)?.type, c.id).toBe('dossier');
        expect(s.exists(`${s.home}/${s.welcome}`), c.id).toBe(true);
      }
    });

    // Le garde-fou des collisions : un nom ajouté à noms.ftl renomme ce
    // nom dans tous les chapitres à noms: true, y compris là où personne ne
    // l'attendait (un /srv/sauvegarde d'une autre histoire). La liste de
    // tous les renommages est gardée dans tests/names/ : un renommage
    // nouveau fait échouer ce test ; s'il est voulu, relire le fichier
    // produit et le mettre à jour avec « npx vitest run -u tests/names.test.ts ».
    it.runIf(language !== 'fr')('les renommages sont ceux attendus (tests/names/)', async () => {
      // Les machines internes d'une histoire sont renommées comme sa machine principale.
      const mondes = translated.flatMap((c) => [
        { id: c.id, createWorld: c.createWorld },
        ...Object.entries(c.hosts ?? {}).map(([h, def]) => ({ id: `${c.id}:${h}`, createWorld: def.createWorld })),
      ]);
      const lines = mondes.flatMap((c) => {
        const renamed = walk(c.createWorld(t))
          .filter((ch) => ch.split('/').some((m) => m && name(t, m) !== m))
          .map((ch) => `  ${ch} → ${ch.split('/').map((m) => (m ? name(t, m) : m)).join('/')}`);
        return renamed.length ? [`${c.id}`, ...renamed, ''] : [];
      });
      await expect(lines.join('\n')).toMatchFileSnapshot(`./names/renamed.${language}.txt`);
    });

    it('Tab complète les noms traduits', () => {
      const s = new Shell(STORIES[0].chapters[0], language);
      const hill = name(t, 'Colline');
      expect(s.complete(`cd ${hill.slice(0, 2)}`)).toBe(`cd ${hill}/`);
      const school = name(t, 'EcoleDesSignaux');
      expect(s.complete(`cd ${hill}/${school.slice(0, 3)}`)).toBe(`cd ${hill}/${school}/`);
      expect(s.complete(`cat ${name(t, 'message.txt').slice(0, 3)}`)).toBe(`cat ${name(t, 'message.txt')} `);
    });
  });
