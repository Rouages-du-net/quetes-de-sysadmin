// Les noms des machines et les mots de passe des histoires se traduisent
// (machines.ftl, mots-de-passe.ftl) : des noms valides, distincts, et des
// textes qui emploient ceux de leur langue.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { MACHINES, nomMachine, POSTE } from '../src/moteur/machines';
import { motDePasse } from '../src/moteur/monde';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';

const IDS = [POSTE, ...MACHINES].map((m) => m.nom);
const MOTS_DE_PASSE = [...readFileSync(new URL('../src/textes/fr/mots-de-passe.ftl', import.meta.url), 'utf8').matchAll(/^mdp-(\S+) =/gm)].map((m) => m[1]);
// Les valeurs des messages d'une langue (sans les commentaires ni les identifiants).
const valeurs = (langue: string) =>
  readdirSync(new URL(`../src/textes/${langue}/`, import.meta.url))
    .filter((f) => f.endsWith('.ftl') && !['machines.ftl', 'mots-de-passe.ftl'].includes(f))
    .flatMap((f) =>
      readFileSync(new URL(`../src/textes/${langue}/${f}`, import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .map((l) => [f, l.replace(/^[\w-]+(\.[\w-]+)?\s*=/, '')] as const),
    );

for (const langue of LANGUES.filter((l) => l !== LANGUE_DE_REFERENCE))
  describe(`Machines et mots de passe — ${langue}`, () => {
    const t = traducteur(langue);

    it('chaque machine a un nom d’hôte valide (RFC 1123), distinct des autres', () => {
      const noms = IDS.map((id) => nomMachine(t, id));
      for (const n of noms) expect(n).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      expect(new Set(noms).size).toBe(noms.length);
    });

    it('les textes emploient les noms et les mots de passe de la langue', () => {
      const autres = IDS.filter((id) => nomMachine(t, id) !== id);
      const machine = new RegExp(`(?:\\bssh |@|\\bid_|\\bHost )(${autres.join('|')})\\b|(?<![\\w-])(${autres.join('|')})\\.internal\\b`);
      const mdp = new RegExp(`(?<![\\w-])(${MOTS_DE_PASSE.filter((m) => motDePasse(t, m) !== m).join('|')})(?![\\w-])`);
      const fautes = valeurs(langue).filter(([, v]) => machine.test(v) || mdp.test(v));
      expect(fautes.map(([f, v]) => `${f}: ${v.trim()}`)).toEqual([]);
    });
  });
