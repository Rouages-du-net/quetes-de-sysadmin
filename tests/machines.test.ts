// Machine names and the stories' passwords are translated
// (machines.ftl, passwords.ftl): valid, distinct names, and
// texts that use those of their language.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { MACHINES, machineName, WORKSTATION } from '../src/engine/machines';
import { password } from '../src/engine/world';
import { LANGUAGES, translator } from '../src/texts';

const IDS = [WORKSTATION, ...MACHINES].map((m) => m.name);
const PASSWORDS = [...readFileSync(new URL('../src/texts/fr/passwords.ftl', import.meta.url), 'utf8').matchAll(/^password-(\S+) =/gm)].map((m) => m[1]);
// The values of a language's messages (without comments or identifiers).
const values = (language: string) =>
  readdirSync(new URL(`../src/texts/${language}/`, import.meta.url))
    .filter((f) => f.endsWith('.ftl') && !['machines.ftl', 'passwords.ftl'].includes(f))
    .flatMap((f) =>
      readFileSync(new URL(`../src/texts/${language}/${f}`, import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .map((l) => [f, l.replace(/^[\w-]+(\.[\w-]+)?\s*=/, '')] as const),
    );

for (const language of LANGUAGES)
  describe(`Machines and passwords — ${language}`, () => {
    const t = translator(language);

    it('every machine has a valid host name (RFC 1123), distinct from the others', () => {
      const names = IDS.map((id) => machineName(t, id));
      for (const n of names) expect(n).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      expect(new Set(names).size).toBe(names.length);
    });

    it('the texts use the names and passwords of the language', () => {
      // The names other languages give the machines (and the French passwords), where this language's differ.
      const other = [...new Set(LANGUAGES.filter((l) => l !== language).flatMap((l) => IDS.map((id) => machineName(translator(l), id))))].filter((n) => !IDS.some((id) => machineName(t, id) === n));
      const machine = other.length ? new RegExp(`(?:\\bssh |@|\\bid_|\\bHost )(${other.join('|')})\\b|(?<![\\w-])(${other.join('|')})\\.internal\\b`) : null;
      const french = PASSWORDS.filter((m) => password(t, m) !== m);
      const mdp = french.length ? new RegExp(`(?<![\\w-])(${french.join('|')})(?![\\w-])`) : null;
      const mistakes = values(language).filter(([, v]) => machine?.test(v) || mdp?.test(v));
      expect(mistakes.map(([f, v]) => `${f}: ${v.trim()}`)).toEqual([]);
    });
  });
