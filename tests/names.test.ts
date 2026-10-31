// Les noms des lieux et des objets, dans chaque langue : faciles à taper
// (lettres sans accent, chiffres, point, tiret, soulignés), sans deux noms
// pareils dans un même dossier, et la complétion par Tab les trouve.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { HISTOIRES } from '../src/engine/chapters';
import { poste } from '../src/engine/workstation';
import { nom, traduireNoms, type Dossier } from '../src/engine/world';
import { LANGUES, traducteur } from '../src/texts';

const autres = LANGUES.map((l) => traducteur(l));
const traduits = [...HISTOIRES.flatMap((h) => h.chapitres), poste([])].filter((c) => c.noms);

// Tous les noms d'un monde, avec leur chemin.
const parcourir = (dossier: Dossier, ici = ''): string[] =>
  Object.entries(dossier.enfants).flatMap(([n, e]) => [`${ici}/${n}`, ...(e.type === 'dossier' ? parcourir(e, `${ici}/${n}`) : [])]);

for (const langue of LANGUES)
  describe(`Noms en ${langue}`, () => {
    const t = traducteur(langue);

    it('chaque histoire qui traduit ses noms garde tous ses lieux et objets, sous des noms faciles à taper', () => {
      expect(traduits.length).toBeGreaterThanOrEqual(5);
      for (const c of traduits) {
        const s = new Shell(c, langue);
        // Le monde tel que le chapitre le crée, avant ce qu'y ajoute son
        // initialiser (un dépôt restic…) : deux noms français devenus
        // pareils y écraseraient un lieu.
        const francais = parcourir(c.creerMonde(t));
        expect(parcourir(traduireNoms(t, c.creerMonde(t))).length, c.id).toBe(francais.length);
        // Les noms qu'une langue traduit (les noms du système, lost+found
        // compris, restent tels quels).
        for (const ch of francais) {
          const n = ch.split('/').at(-1)!;
          if (autres.some((u) => nom(u, n) !== n)) expect(nom(t, n), `${c.id} : ${ch}`).toMatch(/^[A-Za-z0-9._-]+$/);
        }
        expect(s.trouver(s.maison)?.type, c.id).toBe('dossier');
        expect(s.existe(`${s.maison}/${s.accueil}`), c.id).toBe(true);
      }
    });

    // Le garde-fou des collisions : un nom ajouté à noms.ftl renomme ce
    // nom dans tous les chapitres à noms: true, y compris là où personne ne
    // l'attendait (un /srv/sauvegarde d'une autre histoire). La liste de
    // tous les renommages est gardée dans tests/names/ : un renommage
    // nouveau fait échouer ce test ; s'il est voulu, relire le fichier
    // produit et le mettre à jour avec « npx vitest run -u tests/names.test.ts ».
    it.runIf(langue !== 'fr')('les renommages sont ceux attendus (tests/names/)', async () => {
      // Les machines internes d'une histoire sont renommées comme sa machine principale.
      const mondes = traduits.flatMap((c) => [
        { id: c.id, creerMonde: c.creerMonde },
        ...Object.entries(c.hotes ?? {}).map(([h, def]) => ({ id: `${c.id}:${h}`, creerMonde: def.creerMonde })),
      ]);
      const lignes = mondes.flatMap((c) => {
        const renommes = parcourir(c.creerMonde(t))
          .filter((ch) => ch.split('/').some((m) => m && nom(t, m) !== m))
          .map((ch) => `  ${ch} → ${ch.split('/').map((m) => (m ? nom(t, m) : m)).join('/')}`);
        return renommes.length ? [`${c.id}`, ...renommes, ''] : [];
      });
      await expect(lignes.join('\n')).toMatchFileSnapshot(`./names/renamed.${langue}.txt`);
    });

    it('Tab complète les noms traduits', () => {
      const s = new Shell(HISTOIRES[0].chapitres[0], langue);
      const colline = nom(t, 'Colline');
      expect(s.completer(`cd ${colline.slice(0, 2)}`)).toBe(`cd ${colline}/`);
      const ecole = nom(t, 'EcoleDesSignaux');
      expect(s.completer(`cd ${colline}/${ecole.slice(0, 3)}`)).toBe(`cd ${colline}/${ecole}/`);
      expect(s.completer(`cat ${nom(t, 'message.txt').slice(0, 3)}`)).toBe(`cat ${nom(t, 'message.txt')} `);
    });
  });
