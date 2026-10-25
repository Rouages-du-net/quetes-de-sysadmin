// Le plan du réseau : chaque chapitre qui en a un y montre la machine de
// son histoire et ses machines internes ; le schéma ne superpose rien ; les
// repères (tu es ici, déjà connecté·e) suivent la partie.
import { describe, expect, it } from 'vitest';
import { HISTOIRES } from '../src/moteur/chapitres';
import { machineDeHistoire } from '../src/moteur/machines';
import { disposer, reperes, type ElementPlan } from '../src/moteur/plan';
import { Console } from '../src/moteur/console';
import { LANGUES, traducteur } from '../src/textes';

const tous = (e: ElementPlan): ElementPlan[] => [e, ...(e.enfants ?? []).flatMap(tous)];
const EFFACEUR = ['eveil', 'bourg', 'racine', 'sauvegarde'];

for (const langue of LANGUES)
  describe(`Plan du réseau en ${langue}`, () => {
    const t = traducteur(langue);

    it('les histoires à réseau ont un plan à chaque chapitre, avec leurs machines', () => {
      for (const id of ['maison', 'ruche']) {
        const h = HISTOIRES.find((x) => x.id === id)!;
        for (const c of h.chapitres) {
          expect(c.plan, c.id).toBeDefined();
          const elements = tous(c.plan!(t));
          const hotes = elements.map((e) => e.hote).filter(Boolean);
          expect(hotes, c.id).toContain('poste');
          expect(hotes, c.id).toContain(machineDeHistoire(id)!.nom);
          for (const interne of Object.keys(c.hotes ?? {})) expect(hotes, `${c.id} : ${interne}`).toContain(interne);
          // Rien de vide, et des adresses de documentation ou privées.
          for (const e of elements) {
            expect(e.nom, c.id).not.toBe('');
            if (e.adresse && /^\d/.test(e.adresse)) expect(e.adresse, `${c.id} : ${e.nom}`).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113|10)\./);
          }
        }
      }
    });

    it('le plan grandit au fil de La Ruche : télétravail, DMZ, Annexe, borne Wi-Fi', () => {
      const plan = (id: string) => tous(HISTOIRES.find((h) => h.id === 'ruche')!.chapitres.find((c) => c.id === id)!.plan!(t)).map((e) => e.nom);
      expect(plan('vlan')).not.toContain('web');
      expect(plan('dmz')).toContain('web');
      expect(plan('dmz')).not.toContain('borne-wifi');
      expect(plan('wifi')).toEqual(expect.arrayContaining(['web', 'borne-wifi', 'malik-laptop', t('plan-annexe')]));
    });

    it('le schéma ne superpose aucune boîte, et chaque parent est entre ses enfants', () => {
      for (const c of HISTOIRES.flatMap((h) => h.chapitres).filter((x) => x.plan)) {
        const { places } = disposer(c.plan!(t));
        const cles = places.map((p) => `${p.colonne}:${p.ligne}`);
        expect(new Set(cles).size, c.id).toBe(cles.length);
        for (const p of places.filter((x) => x.parent)) expect(p.colonne, c.id).toBe(p.parent!.colonne + 1);
      }
    });

    it('tu es ici, et les machines où l’on s’est connecté·e', () => {
      const c = new Console({ langue, termines: EFFACEUR });
      const plan = HISTOIRES.find((h) => h.id === 'ruche')!.chapitres[0].plan!(t);
      const ruche = tous(plan).find((e) => e.hote === 'ruche')!;
      expect(reperes(ruche, c.shell.hote, c.visitees)).toEqual({ ici: false, visite: false });
      c.connecter('ruche');
      expect(reperes(ruche, c.shell.hote, c.visitees)).toEqual({ ici: true, visite: true });
      c.executer('exit');
      expect(reperes(ruche, c.shell.hote, c.visitees)).toEqual({ ici: false, visite: true });
    });
  });
