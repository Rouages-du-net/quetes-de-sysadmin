// Les outils d'OpenLDAP (ldap-utils et slapd) sur l'annuaire simulé
// (../ldap.ts) : ldapsearch, ldapadd, ldapmodify, ldapdelete, ldappasswd,
// ldapwhoami, slappasswd, slapcat. Sorties en anglais, comme les vrais outils.
// Sources : https://manpages.debian.org/trixie/ldap-utils/ldapsearch.1.en.html,
// https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html,
// https://manpages.debian.org/trixie/ldap-utils/ldappasswd.1.en.html,
// https://manpages.debian.org/trixie/slapd/slappasswd.8.en.html

import type { Shell } from '../shell';
import {
  directory,
  apply,
  correspond,
  hash,
  readFilter,
  readLdif,
  attributeName,
  normalise,
  under,
  find,
  check,
  type Directory,
  type Change,
  type Input,
  type LdapError,
} from '../ldap';
import { systemd } from '../systemd';
import type { Command } from './index';

const EXTERNAL_ROOT = 'gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth';

interface Options {
  simple: boolean;
  uri: string | null;
  dn: string | null;
  mdp: string | null;
  askMdp: boolean;
  mechanism: string | null;
  base: string | null;
  scope: string;
  ldif: number;
  file: string | null;
  silence: boolean;
  resume: boolean;
  addition: boolean;
  fresh: string | null;
  askNew: boolean;
  rest: string[];
}

function readOptions(args: string[], withS: 'portee' | 'nouveau'): Options | string {
  const o: Options = {
    simple: false,
    uri: null,
    dn: null,
    mdp: null,
    askMdp: false,
    mechanism: null,
    base: null,
    scope: 'sub',
    ldif: 0,
    file: null,
    silence: false,
    resume: false,
    addition: false,
    fresh: null,
    askNew: false,
    rest: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') {
      o.rest.push(a);
      continue;
    }
    const letters = a.slice(1);
    for (let k = 0; k < letters.length; k++) {
      const l = letters[k];
      const value = () => (k < letters.length - 1 ? letters.slice(k + 1) : args[++i]) ?? '';
      if (l === 'x') o.simple = true;
      else if (l === 'W') o.askMdp = true;
      else if (l === 'L') o.ldif++;
      else if (l === 'Q') o.silence = true;
      else if (l === 'c') o.resume = true;
      else if (l === 'a') o.addition = true;
      else if (l === 'S') o.askNew = true;
      else if (l === 'v' || l === 'n' || l === 'N' || l === 'r') continue;
      else if ('HDwYbfs'.includes(l)) {
        const v = value();
        if (l === 'H') o.uri = v;
        else if (l === 'D') o.dn = v;
        else if (l === 'w') o.mdp = v;
        else if (l === 'Y') o.mechanism = v.toUpperCase();
        else if (l === 'b') o.base = v;
        else if (l === 'f') o.file = v;
        else if (l === 's' && withS === 'portee') o.scope = v;
        else if (l === 's') o.fresh = v;
        k = letters.length;
      } else return l;
    }
  }
  return o;
}

// /etc/ldap/ldap.conf : BASE et URI par défaut.
function defaults(game: Shell): { base: string | null; uri: string } {
  const text = game.read('/etc/ldap/ldap.conf') ?? '';
  const value = (key: string) =>
    text
      .split('\n')
      .find((l) => new RegExp(`^${key}\\s`, 'i').test(l.trim()))
      ?.trim()
      .split(/\s+/)[1] ?? null;
  return { base: value('BASE'), uri: value('URI') ?? 'ldap://localhost' };
}

type Identity = { who: 'anonyme' } | { who: 'admin' } | { who: 'racine' } | { who: 'personne'; dn: string } | { who: 'local'; uid: number };

/** Se présenter à slapd (bind) ; renvoie l'identité, ou l'erreur à afficher (avec son code de retour). */
function bindSelf(game: Shell, o: Options, mdp: string | null): { id: Identity; log: string[] } | { error: string; code: number } {
  const a = directory(game);
  const uri = o.uri ?? defaults(game).uri;
  const inWorks = systemd(game)?.services.slapd?.state === 'active';
  const sasl = !o.simple;
  if (!inWorks) return { error: `${sasl ? 'ldap_sasl_interactive_bind' : 'ldap_sasl_bind(SIMPLE)'}: Can't contact LDAP server (-1)`, code: 255 };
  if (!a) return { error: 'ldap_bind: No such object (32)', code: 32 };
  if (sasl) {
    if (o.mechanism !== 'EXTERNAL' || !uri.startsWith('ldapi:'))
      return {
        error:
          'ldap_sasl_interactive_bind: Unknown authentication method (-6)\n\tadditional info: SASL(-4): no mechanism available: No worthy mechs found',
        code: 255,
      };
    const log = o.silence
      ? []
      : [
          'SASL/EXTERNAL authentication started',
          `SASL username: ${game.who === 'root' ? EXTERNAL_ROOT : `gidNumber=1000+uidNumber=1000,cn=peercred,cn=external,cn=auth`}`,
          'SASL SSF: 0',
        ];
    return { id: game.who === 'root' ? { who: 'racine' } : { who: 'local', uid: 1000 }, log };
  }
  if (!o.dn) return { id: { who: 'anonyme' }, log: [] };
  if (normalise(o.dn) === normalise(a.admin)) {
    if (mdp !== null && check(adminMdp(game), mdp)) return { id: { who: 'admin' }, log: [] };
    return { error: 'ldap_bind: Invalid credentials (49)', code: 49 };
  }
  const e = find(a, o.dn);
  if (!e || mdp === null || !(e.attrs.userpassword ?? []).some((v) => check(v, mdp)))
    return { error: 'ldap_bind: Invalid credentials (49)', code: 49 };
  return { id: { who: 'personne', dn: e.dn }, log: [] };
}

const adminMdp = (game: Shell): string => game.state.ldapAdmin ?? '';
const written = (id: Identity) => id.who === 'admin' || id.who === 'racine';

/** Lance `faire` une fois le mot de passe connu : donné (-w), demandé (-W), ou sans (anonyme, SASL). */
function withMdp(game: Shell, o: Options, run: (mdp: string | null) => string): string {
  if (!o.askMdp || o.mdp !== null) return run(o.mdp);
  const who = game.who;
  game.ask(
    'Enter LDAP Password: ',
    (response) => {
      const before = game.who;
      game.who = who;
      try {
        const output = run(response);
        return [...game.recoverErrors(), output].filter(Boolean).join('\n');
      } finally {
        game.who = before;
      }
    },
    true,
  );
  return '';
}

// « # sami, people, thehive.example » : le commentaire de ldapsearch devant chaque entrée.
function title(dn: string): string {
  const rdns = dn.split(',').map((r) => r.split('=').map((x) => x.trim()));
  const dcs = rdns.filter(([a]) => a.toLowerCase() === 'dc').map(([, v]) => v);
  const other = rdns.filter(([a]) => a.toLowerCase() !== 'dc').map(([, v]) => v);
  return [...other, ...(dcs.length ? [dcs.join('.')] : [])].join(', ');
}

function inputLines(e: Input, id: Identity, requests: string[]): string[] {
  const lines = [`dn: ${e.dn}`];
  for (const [a, values] of Object.entries(e.attrs)) {
    if (requests.length && !requests.includes('*') && !requests.some((d) => d.toLowerCase() === a)) continue;
    // userPassword : seulement pour l'administrateur, root, ou la personne elle-même.
    if (a === 'userpassword' && !(written(id) || (id.who === 'personne' && normalise(id.dn) === normalise(e.dn)))) continue;
    for (const v of values) lines.push(`${attributeName(a)}: ${v}`);
  }
  return lines;
}

function ldapsearch(game: Shell, args: string[]): string {
  const o = readOptions(args, 'portee');
  if (typeof o === 'string') return game.error(`ldapsearch: invalid option -- '${o}'\nldapsearch: unrecognized option -${o}`, 1);
  const [textFilter = '(objectclass=*)', ...requests] = o.rest;
  const filter = readFilter(textFilter);
  return withMdp(game, o, (mdp) => {
    const link = bindSelf(game, o, mdp);
    if ('error' in link) return game.error(link.error, link.code);
    link.log.forEach((l) => game.error(l, 0));
    if (!filter) return game.error('ldap_search_ext: Bad search filter (-7)', 255);
    const a = directory(game)!;
    const base = o.base ?? defaults(game).base ?? '';
    const inHead =
      o.ldif >= 1
        ? []
        : [
            '# extended LDIF',
            '#',
            '# LDAPv3',
            `# base <${base}>${o.base ? '' : ' (default)'} with scope ${o.scope === 'sub' ? 'subtree' : o.scope === 'one' ? 'oneLevel' : 'baseObject'}`,
            `# filter: ${textFilter}`,
            `# requesting: ${requests.length ? requests.join(' ') : 'ALL'}`,
            '#',
            '',
          ];
    const root = find(a, base);
    if (!root) {
      game.status = 32;
      return [
        ...inHead,
        ...(o.ldif >= 1 ? ['No such object (32)'] : ['# search result', 'search: 2', 'result: 32 No such object', '', '# numResponses: 1']),
      ].join('\n');
    }
    const found = a.inputs.filter((e) => {
      if (!under(e.dn, base)) return false;
      const depth = normalise(e.dn).split(',').length - normalise(base).split(',').length;
      if (o.scope === 'base' && depth !== 0) return false;
      if (o.scope === 'one' && depth !== 1) return false;
      return correspond(filter, e);
    });
    const body = found.flatMap((e) => [...(o.ldif >= 2 ? [] : [`# ${title(e.dn)}`]), ...inputLines(e, link.id, requests), '']);
    if (o.ldif >= 1) return body.join('\n').trimEnd();
    return [
      ...inHead,
      ...body,
      '# search result',
      'search: 2',
      'result: 0 Success',
      '',
      `# numResponses: ${found.length + 1}`,
      ...(found.length ? [`# numEntries: ${found.length}`] : []),
    ].join('\n');
  });
}

// ldapadd, ldapmodify, ldapdelete : écrire dans l'annuaire.
function writeIn(game: Shell, name: 'ldapadd' | 'ldapmodify' | 'ldapdelete', args: string[], input: string | null): string {
  const o = readOptions(args, 'portee');
  if (typeof o === 'string') return game.error(`${name}: invalid option -- '${o}'`, 1);
  let changes: Change[];
  if (name === 'ldapdelete') {
    const dns = o.rest.length ? o.rest : (o.file ? (game.read(o.file) ?? '') : (input ?? '')).split('\n').filter((l) => l.trim());
    if (!dns.length) return game.error(game.t('ldap-nothing-a-do', { command: name }), 1);
    changes = dns.map((dn, i) => ({ what: 'delete', dn, line: i + 1 }));
  } else {
    const text = o.file !== null ? game.read(o.file) : input;
    if (o.file !== null && text === null) return game.error(`${name}: ${o.file}: No such file or directory`, 1);
    if (text === null) return game.error(game.t('ldap-nothing-a-do', { command: name }), 1);
    try {
      changes = readLdif(text, name === 'ldapadd' || o.addition);
    } catch (e) {
      return game.error((e as Error).message.replace(/^ldapmodify/, name), 1);
    }
  }
  return withMdp(game, o, (mdp) => {
    const link = bindSelf(game, o, mdp);
    if ('error' in link) return game.error(link.error, link.code);
    link.log.forEach((l) => game.error(l, 0));
    const a = directory(game)!;
    const outputs: string[] = [];
    for (const c of changes) {
      const dn = c.what === 'add' ? c.input.dn : c.dn;
      const verb = c.what === 'add' ? 'adding new entry' : c.what === 'delete' ? 'deleting entry' : 'modifying entry';
      if (name !== 'ldapdelete') outputs.push(`${verb} "${dn}"`);
      const op = c.what === 'add' ? 'ldap_add' : c.what === 'delete' ? 'ldap_delete' : 'ldap_modify';
      let e: LdapError | null;
      if (link.id.who === 'anonyme') e = { code: 8, text: 'Strong(er) authentication required', info: 'modifications require authentication' };
      else if (!written(link.id) && !mine(link.id, c)) e = { code: 50, text: 'Insufficient access', info: `no write access to parent` };
      else e = apply(a, c);
      if (e) {
        outputs.push(`${op}: ${e.text} (${e.code})${e.info ? `\n\tadditional info: ${e.info}` : ''}`);
        game.status = e.code;
        if (!o.resume) break;
      } else if (name !== 'ldapdelete') outputs.push('');
    }
    return outputs.join('\n').trimEnd();
  });
}

// Une personne peut changer son propre mot de passe (et rien d'autre).
const mine = (id: Identity, c: Change) =>
  id.who === 'personne' &&
  c.what === 'modify' &&
  normalise(c.dn) === normalise(id.dn) &&
  c.ops.every((o) => o.attr.toLowerCase() === 'userpassword');

function ldappasswd(game: Shell, args: string[]): string {
  const o = readOptions(args, 'nouveau');
  if (typeof o === 'string') return game.error(`ldappasswd: invalid option -- '${o}'`, 1);
  const who = game.who;
  const resume = (run: () => string) => {
    const before = game.who;
    game.who = who;
    try {
      const output = run();
      return [...game.recoverErrors(), output].filter(Boolean).join('\n');
    } finally {
      game.who = before;
    }
  };
  const change = (fresh: string | null) =>
    withMdp(game, o, (mdp) => {
      const link = bindSelf(game, o, mdp);
      if ('error' in link) return game.error(link.error, link.code);
      link.log.forEach((l) => game.error(l, 0));
      const a = directory(game)!;
      const target = o.rest[0] ?? (link.id.who === 'personne' ? link.id.dn : null);
      if (!target) return game.error('Result: Unwilling to perform (53)\nAdditional info: password modify extended operation requires a user', 53);
      const e = find(a, target);
      if (!e) return game.error('Result: No such object (32)', 32);
      if (!written(link.id) && !(link.id.who === 'personne' && normalise(link.id.dn) === normalise(e.dn)))
        return game.error(
          link.id.who === 'anonyme' ? 'Result: Strong(er) authentication required (8)' : 'Result: Insufficient access (50)',
          link.id.who === 'anonyme' ? 8 : 50,
        );
      const word = fresh ?? generated(game);
      e.attrs.userpassword = [hash(game, word)];
      return fresh === null ? `New password: ${word}` : '';
    });
  if (o.fresh !== null) return change(o.fresh);
  if (!o.askNew) return change(null);
  game.ask(
    'New password: ',
    (first) =>
      resume(() => {
        game.ask(
          'Re-enter new password: ',
          (second) => resume(() => (first === second ? change(first) : game.error('passwords do not match', 1))),
          true,
        );
        return '';
      }),
    true,
  );
  return '';
}

// Le mot de passe que choisit ldappasswd quand on ne lui en donne pas.
const generated = (game: Shell) => {
  const n = (game.state.ldapGenerated = (game.state.ldapGenerated ?? 0) + 1);
  return ['aB3dEf9h', 'Qw7rTy2u', 'Zx5cVb8n'][(n - 1) % 3];
};

function ldapwhoami(game: Shell, args: string[]): string {
  const o = readOptions(args, 'portee');
  if (typeof o === 'string') return game.error(`ldapwhoami: invalid option -- '${o}'`, 1);
  return withMdp(game, o, (mdp) => {
    const link = bindSelf(game, o, mdp);
    if ('error' in link) return game.error(link.error, link.code);
    link.log.forEach((l) => game.error(l, 0));
    const id = link.id;
    const a = directory(game)!;
    if (id.who === 'anonyme') return 'anonymous';
    if (id.who === 'admin') return `dn:${a.admin}`;
    if (id.who === 'racine') return `dn:${EXTERNAL_ROOT}`;
    if (id.who === 'local') return `dn:gidNumber=${id.uid}+uidNumber=${id.uid},cn=peercred,cn=external,cn=auth`;
    return `dn:${id.dn}`;
  });
}

function slappasswd(game: Shell, args: string[]): string {
  const k = args.indexOf('-s');
  if (k >= 0) return hash(game, args[k + 1] ?? '');
  const unknown = args.find((a) => a.startsWith('-') && !['-h'].includes(a));
  if (unknown) return game.error(`slappasswd: invalid option -- '${unknown.slice(1)}'`, 1);
  const who = game.who;
  game.ask(
    'New password: ',
    (first) => {
      game.ask(
        'Re-enter new password: ',
        (second) => {
          const before = game.who;
          game.who = who;
          try {
            if (first === second) return hash(game, first);
            game.error('Password values do not match', 1);
            return game.recoverErrors().join('\n');
          } finally {
            game.who = before;
          }
        },
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

function slapcat(game: Shell): string {
  if (game.who !== 'root') return game.error('slapcat: could not open config directory "/etc/ldap/slapd.d": Permission denied', 1);
  const a: Directory | undefined = directory(game);
  if (!a) return '';
  return a.inputs
    .flatMap((e) => [...inputLines(e, { who: 'racine' }, []), ''])
    .join('\n')
    .trimEnd();
}

export const LDAP: Record<string, Command> = {
  ldapsearch: { ownOptions: true, launch: ({ args, game }) => ldapsearch(game, args) },
  ldapadd: { ownOptions: true, launch: ({ args, game, input }) => writeIn(game, 'ldapadd', args, input) },
  ldapmodify: { ownOptions: true, launch: ({ args, game, input }) => writeIn(game, 'ldapmodify', args, input) },
  ldapdelete: { ownOptions: true, launch: ({ args, game, input }) => writeIn(game, 'ldapdelete', args, input) },
  ldappasswd: { ownOptions: true, launch: ({ args, game }) => ldappasswd(game, args) },
  ldapwhoami: { ownOptions: true, launch: ({ args, game }) => ldapwhoami(game, args) },
  slappasswd: { section: 8, ownOptions: true, launch: ({ args, game }) => slappasswd(game, args) },
  slapcat: { section: 8, ownOptions: true, launch: ({ game }) => slapcat(game) },
  ldif: { section: 5, launch: () => '' },
};
