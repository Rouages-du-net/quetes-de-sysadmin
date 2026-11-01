// Les noms des machines et les mots de passe des histoires se traduisent
// (machines.ftl, mots-de-passe.ftl) : des noms valides, distincts, et des
// textes qui emploient ceux de leur langue.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { MACHINES, machineName, WORKSTATION } from '../src/engine/machines';
import { password } from '../src/engine/world';
import { LANGUAGES, translator } from '../src/texts';

const IDS = [WORKSTATION, ...MACHINES].map((m) => m.name);
const PASSWORDS = [...readFileSync(new URL('../src/texts/fr/mots-de-passe.ftl', import.meta.url), 'utf8').matchAll(/^password-(\S+) =/gm)].map((m) => m[1]);
// Les valeurs des messages d'une langue (sans les commentaires ni les identifiants).
const values = (language: string) =>
  readdirSync(new URL(`../src/texts/${language}/`, import.meta.url))
    .filter((f) => f.endsWith('.ftl') && !['machines.ftl', 'mots-de-passe.ftl'].includes(f))
    .flatMap((f) =>
      readFileSync(new URL(`../src/texts/${language}/${f}`, import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .map((l) => [f, l.replace(/^[\w-]+(\.[\w-]+)?\s*=/, '')] as const),
    );

for (const language of LANGUAGES)
  describe(`Machines et mots de passe — ${language}`, () => {
    const t = translator(language);

    it('chaque machine a un nom d’hôte valide (RFC 1123), distinct des autres', () => {
      const names = IDS.map((id) => machineName(t, id));
      for (const n of names) expect(n).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      expect(new Set(names).size).toBe(names.length);
    });

    it('les textes emploient les noms et les mots de passe de la langue', () => {
      // The names other languages give the machines (and the French passwords), where this language's differ.
      const other = [...new Set(LANGUAGES.filter((l) => l !== language).flatMap((l) => IDS.map((id) => machineName(translator(l), id))))].filter((n) => !IDS.some((id) => machineName(t, id) === n));
      const machine = other.length ? new RegExp(`(?:\\bssh |@|\\bid_|\\bHost )(${other.join('|')})\\b|(?<![\\w-])(${other.join('|')})\\.internal\\b`) : null;
      const french = PASSWORDS.filter((m) => password(t, m) !== m);
      const mdp = french.length ? new RegExp(`(?<![\\w-])(${french.join('|')})(?![\\w-])`) : null;
      const mistakes = values(language).filter(([, v]) => machine?.test(v) || mdp?.test(v));
      expect(mistakes.map(([f, v]) => `${f}: ${v.trim()}`)).toEqual([]);
    });
  });
