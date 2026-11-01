// Un annuaire LDAP (OpenLDAP, slapd) sur une machine (etat.ldap) : des
// entrées rangées en arbre sous une base (dc=thehive,dc=example), chacune
// avec ses classes d'objets (objectClass) et ses attributs.
//   - le format LDIF (RFC 2849) : entrées à ajouter, ou changements
//     (changetype: add, modify, delete ; add:, replace:, delete: dans un modify) ;
//   - un petit schéma (core, cosine, inetorgperson, nis) : les attributs
//     connus et ceux que chaque classe exige ;
//   - les filtres de recherche (RFC 4515) : (&…), (|…), (!…), (attr=valeur),
//     (attr=*), (attr=déb*fin) ;
//   - les mots de passe : {SSHA} (slappasswd), ou en clair (à éviter) ;
//   - les droits, comme le paquet Debian : lecture anonyme sauf userPassword,
//     écriture par l'administrateur (cn=admin) ou par root sur ldapi:/// (-Y EXTERNAL).
// Sources : https://www.openldap.org/doc/admin26/, https://www.rfc-editor.org/rfc/rfc2849,
// https://www.rfc-editor.org/rfc/rfc4515, https://wiki.debian.org/LDAP/OpenLDAPSetup
// Écarts : pas de cn=config modifiable, de réplication, d'index, de
// référentiel ni de base64 (::) ; un schéma réduit ; l'empreinte {SSHA}
// n'est pas un vrai SHA-1.

import type { Game } from './shell';

export interface Input {
  dn: string;
  attrs: Record<string, string[]>;
}

export interface Directory {
  base: string;
  admin: string;
  inputs: Input[];
}

export const directory = (j: Game) => j.state.ldap as Directory | undefined;

// ——— Les noms (DN) ———

/** Un DN sous une forme comparable : minuscules, sans blancs autour des virgules et des =. */
export const normalise = (dn: string) =>
  dn
    .split(',')
    .map((r) =>
      r
        .split('=')
        .map((x) => x.trim())
        .join('='),
    )
    .join(',')
    .toLowerCase();

export const parent = (dn: string) => dn.split(',').slice(1).join(',');
export const find = (a: Directory, dn: string) => a.inputs.find((e) => normalise(e.dn) === normalise(dn));
export const under = (dn: string, base: string) => normalise(dn) === normalise(base) || normalise(dn).endsWith(',' + normalise(base));

// ——— Le schéma ———

// Les attributs connus (en minuscules), avec leurs noms officiels.
const ATTRIBUTES = [
  'objectClass',
  'dc',
  'o',
  'ou',
  'cn',
  'sn',
  'givenName',
  'displayName',
  'uid',
  'mail',
  'telephoneNumber',
  'description',
  'userPassword',
  'uidNumber',
  'gidNumber',
  'homeDirectory',
  'loginShell',
  'gecos',
  'memberUid',
  'member',
  'title',
  'employeeType',
  'l',
];
const ATTRIBUTE_NAME = Object.fromEntries(ATTRIBUTES.map((a) => [a.toLowerCase(), a]));
export const attributeName = (a: string) => ATTRIBUTE_NAME[a.toLowerCase()] ?? a;

// Les classes connues : les attributs qu'elles exigent (MUST) et permettent (MAY).
const CLASSES: Record<string, { must: string[]; may: string[]; structural: boolean }> = {
  top: { must: [], may: [], structural: false },
  dcobject: { must: ['dc'], may: ['description'], structural: false },
  organization: { must: ['o'], may: ['description', 'telephoneNumber', 'l'], structural: true },
  organizationalunit: { must: ['ou'], may: ['description', 'telephoneNumber', 'l'], structural: true },
  person: { must: ['sn', 'cn'], may: ['userPassword', 'telephoneNumber', 'description'], structural: true },
  organizationalperson: { must: ['sn', 'cn'], may: ['title', 'l', 'telephoneNumber', 'description', 'userPassword'], structural: true },
  inetorgperson: {
    must: ['sn', 'cn'],
    may: ['givenName', 'displayName', 'uid', 'mail', 'telephoneNumber', 'title', 'employeeType', 'description', 'userPassword', 'l'],
    structural: true,
  },
  posixaccount: {
    must: ['cn', 'uid', 'uidNumber', 'gidNumber', 'homeDirectory'],
    may: ['userPassword', 'loginShell', 'gecos', 'description'],
    structural: false,
  },
  shadowaccount: { must: ['uid'], may: ['userPassword', 'description'], structural: false },
  posixgroup: { must: ['cn', 'gidNumber'], may: ['userPassword', 'memberUid', 'description'], structural: true },
  groupofnames: { must: ['member', 'cn'], may: ['description', 'o', 'ou'], structural: true },
  organizationalrole: { must: ['cn'], may: ['description', 'telephoneNumber', 'l'], structural: true },
  simplesecurityobject: { must: ['userPassword'], may: [], structural: false },
};

export interface LdapError {
  code: number;
  text: string;
  info?: string;
}

const CODES_NAMES: Record<number, string> = {
  8: 'Strong(er) authentication required',
  16: 'No such attribute',
  17: 'Undefined attribute type',
  19: 'Constraint violation',
  20: 'Type or value exists',
  21: 'Invalid syntax',
  32: 'No such object',
  34: 'Invalid DN syntax',
  49: 'Invalid credentials',
  50: 'Insufficient access',
  64: 'Naming violation',
  65: 'Object class violation',
  66: 'Operation not allowed on non-leaf',
  68: 'Already exists',
};
export const error = (code: number, info?: string): LdapError => ({ code, text: CODES_NAMES[code], ...(info ? { info } : {}) });

/** Une entrée respecte-t-elle le schéma ? null si oui. */
export function checkSchema(e: Input): LdapError | null {
  for (const a of Object.keys(e.attrs)) if (!ATTRIBUTE_NAME[a]) return error(17, `${a}: attribute type undefined`);
  const classes = (e.attrs.objectclass ?? []).map((c) => c.toLowerCase());
  if (!classes.length) return error(65, 'no objectClass attribute');
  for (const c of classes) if (!CLASSES[c]) return error(21, `objectClass: value #0 invalid per syntax`);
  if (!classes.some((c) => CLASSES[c].structural)) return error(65, 'no structural object class provided');
  for (const c of classes)
    for (const m of CLASSES[c].must)
      if (!e.attrs[m.toLowerCase()]?.length) return error(65, `object class '${className(c)}' requires attribute '${m}'`);
  const permitted = new Set(['objectclass', ...classes.flatMap((c) => [...CLASSES[c].must, ...CLASSES[c].may].map((x) => x.toLowerCase()))]);
  for (const a of Object.keys(e.attrs)) if (!permitted.has(a)) return error(65, `attribute '${attributeName(a)}' not allowed`);
  // L'attribut du nom (uid=sami…) doit être dans l'entrée.
  const [rdnA, rdnV] = e.dn
    .split(',')[0]
    .split('=')
    .map((x) => x.trim());
  if (!e.attrs[rdnA.toLowerCase()]?.some((v) => v.toLowerCase() === (rdnV ?? '').toLowerCase()))
    return error(64, 'value of naming attribute is not present in entry');
  for (const n of ['uidnumber', 'gidnumber'])
    if (e.attrs[n]?.some((v) => !/^\d+$/.test(v))) return error(21, `${attributeName(n)}: value #0 invalid per syntax`);
  return null;
}

const CLASSES_NAMES: Record<string, string> = {
  inetorgperson: 'inetOrgPerson',
  posixaccount: 'posixAccount',
  posixgroup: 'posixGroup',
  organizationalunit: 'organizationalUnit',
  groupofnames: 'groupOfNames',
  person: 'person',
  organizationalperson: 'organizationalPerson',
  shadowaccount: 'shadowAccount',
  organization: 'organization',
  dcobject: 'dcObject',
  organizationalrole: 'organizationalRole',
  simplesecurityobject: 'simpleSecurityObject',
};
const className = (c: string) => CLASSES_NAMES[c] ?? c;

// ——— LDIF ———

export type Change =
  | { what: 'add'; input: Input; line: number }
  | { what: 'delete'; dn: string; line: number }
  | { what: 'modify'; dn: string; ops: { op: 'add' | 'replace' | 'delete'; attr: string; values: string[] }[]; line: number };

/** Lit un texte LDIF ; `ajout` : sans changetype, une entrée est un ajout (ldapadd). Lève une erreur au format d'ldapmodify. */
export function readLdif(text: string, addition: boolean): Change[] {
  // Les lignes repliées (qui commencent par une espace) continuent la précédente.
  const lines: { t: string; n: number }[] = [];
  text.split('\n').forEach((rawValue, i) => {
    if (rawValue.startsWith(' ') && lines.length && lines.at(-1)!.t !== '') lines.at(-1)!.t += rawValue.slice(1);
    else lines.push({ t: rawValue.replace(/\r$/, ''), n: i + 1 });
  });
  const blocks: { t: string; n: number }[][] = [[]];
  for (const l of lines) {
    if (l.t.startsWith('#')) continue;
    if (l.t.trim() === '') {
      if (blocks.at(-1)!.length) blocks.push([]);
    } else blocks.at(-1)!.push(l);
  }
  const changes: Change[] = [];
  for (const block of blocks.filter((b) => b.length)) {
    const pairs = block.map((l) => {
      // « - » sépare deux changements d'un même modify.
      if (l.t.trim() === '-') return { a: '-', v: '', n: l.n };
      const k = l.t.indexOf(':');
      if (k < 0) throw new Error(`ldapmodify: invalid format (line ${l.n}) entry: ""`);
      return { a: l.t.slice(0, k).trim(), v: l.t.slice(k + 1).replace(/^:?\s*/, ''), n: l.n };
    });
    if (pairs[0].a.toLowerCase() !== 'dn') throw new Error(`ldapmodify: invalid format (line ${pairs[0].n}) entry: ""`);
    const dn = pairs[0].v.trim();
    let rest = pairs.slice(1);
    let type = addition ? 'add' : 'modify';
    if (rest[0]?.a.toLowerCase() === 'changetype') {
      type = rest[0].v.trim().toLowerCase();
      rest = rest.slice(1);
    } else if (!addition) throw new Error(`ldapmodify: modify operation type is missing at line ${pairs[0].n}, entry "${dn}"`);
    if (type === 'add') {
      const attrs: Record<string, string[]> = {};
      for (const p of rest) (attrs[p.a.toLowerCase()] ??= []).push(p.v.trim());
      changes.push({ what: 'add', input: { dn, attrs }, line: pairs[0].n });
    } else if (type === 'delete') changes.push({ what: 'delete', dn, line: pairs[0].n });
    else if (type === 'modify') {
      const ops: { op: 'add' | 'replace' | 'delete'; attr: string; values: string[] }[] = [];
      let current: (typeof ops)[number] | null = null;
      for (const p of rest) {
        if (p.a === '-') {
          current = null;
          continue;
        }
        const op = p.a.toLowerCase();
        if (!current && (op === 'add' || op === 'replace' || op === 'delete')) {
          current = { op, attr: p.v.trim(), values: [] };
          ops.push(current);
        } else if (current && p.a.toLowerCase() === current.attr.toLowerCase()) current.values.push(p.v.trim());
        else throw new Error(`ldapmodify: wrong attributeType at line ${p.n}, entry "${dn}"`);
      }
      changes.push({ what: 'modify', dn, ops, line: pairs[0].n });
    } else throw new Error(`ldapmodify: invalid changetype "${type}" at line ${pairs[0].n}, entry "${dn}"`);
  }
  return changes;
}

/** Applique un changement ; renvoie l'erreur de slapd, ou null. */
export function apply(a: Directory, c: Change): LdapError | null {
  if (c.what === 'add') {
    if (!/^[\w-]+=[^,]+(,[\w-]+=[^,]+)*$/.test(c.input.dn.replace(/\s*,\s*/g, ','))) return error(34, 'invalid DN');
    if (find(a, c.input.dn)) return error(68);
    if (!under(c.input.dn, a.base)) return error(32);
    if (normalise(c.input.dn) !== normalise(a.base) && !find(a, parent(c.input.dn))) return error(32);
    const e = checkSchema(c.input);
    if (e) return e;
    a.inputs.push(structuredClone(c.input));
    return null;
  }
  const e = find(a, c.dn);
  if (!e) return error(32);
  if (c.what === 'delete') {
    if (a.inputs.some((x) => normalise(parent(x.dn)) === normalise(e.dn))) return error(66, 'subordinate objects must be deleted first');
    a.inputs = a.inputs.filter((x) => x !== e);
    return null;
  }
  const copyOf = structuredClone(e);
  for (const o of c.ops) {
    const key = o.attr.toLowerCase();
    if (!ATTRIBUTE_NAME[key]) return error(17, `${o.attr}: attribute type undefined`);
    const before = copyOf.attrs[key] ?? [];
    if (o.op === 'add') {
      const already = o.values.find((v) => before.some((x) => x.toLowerCase() === v.toLowerCase()));
      if (already) return error(20, `modify/add: ${attributeName(key)}: value #0 already exists`);
      copyOf.attrs[key] = [...before, ...o.values];
    } else if (o.op === 'replace') {
      if (o.values.length) copyOf.attrs[key] = [...o.values];
      else delete copyOf.attrs[key];
    } else {
      if (!o.values.length) {
        if (!before.length) return error(16, `modify/delete: ${attributeName(key)}: no such attribute`);
        delete copyOf.attrs[key];
      } else {
        const missing = o.values.find((v) => !before.some((x) => x.toLowerCase() === v.toLowerCase()));
        if (missing) return error(16, `modify/delete: ${attributeName(key)}: no such value`);
        copyOf.attrs[key] = before.filter((x) => !o.values.some((v) => v.toLowerCase() === x.toLowerCase()));
        if (!copyOf.attrs[key].length) delete copyOf.attrs[key];
      }
    }
  }
  const s = checkSchema(copyOf);
  if (s) return s;
  e.attrs = copyOf.attrs;
  return null;
}

// ——— Les filtres (RFC 4515) ———

type Filter = { and: Filter[] } | { or: Filter[] } | { not: Filter } | { attr: string; pattern: string };

export function readFilter(text: string): Filter | null {
  let k = 0;
  const t = text.trim().startsWith('(') ? text.trim() : `(${text.trim()})`;
  const read = (): Filter | null => {
    if (t[k] !== '(') return null;
    k++;
    let f: Filter | null;
    if (t[k] === '&' || t[k] === '|') {
      const op = t[k++];
      const listing: Filter[] = [];
      while (t[k] === '(') {
        const x = read();
        if (!x) return null;
        listing.push(x);
      }
      f = op === '&' ? { and: listing } : { or: listing };
    } else if (t[k] === '!') {
      k++;
      const x = read();
      if (!x) return null;
      f = { not: x };
    } else {
      const end = t.indexOf(')', k);
      if (end < 0) return null;
      const body = t.slice(k, end);
      const e = body.indexOf('=');
      if (e <= 0) return null;
      f = {
        attr: body
          .slice(0, e)
          .replace(/[~<>]$/, '')
          .toLowerCase(),
        pattern: body.slice(e + 1),
      };
      k = end;
    }
    if (t[k] !== ')') return null;
    k++;
    return f;
  };
  const f = read();
  return f && k === t.length ? f : null;
}

export function correspond(f: Filter, e: Input): boolean {
  if ('and' in f) return f.and.every((x) => correspond(x, e));
  if ('or' in f) return f.or.some((x) => correspond(x, e));
  if ('not' in f) return !correspond(f.not, e);
  const values = e.attrs[f.attr] ?? [];
  if (f.pattern === '*') return values.length > 0;
  const re = new RegExp(
    `^${f.pattern
      .split('*')
      .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
    'i',
  );
  return values.some((v) => re.test(v));
}

// ——— Les mots de passe ———

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fingerprint(secret: string, salt: string): string {
  let h = 2166136261;
  const bytes: number[] = [];
  for (let i = 0; i < 24; i++) {
    for (const c of secret + salt + String(i)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    bytes.push(h & 63);
  }
  return bytes.map((o) => B64[o]).join('');
}

/** Une empreinte {SSHA} avec un sel donné (pour les entrées de départ d'un chapitre). */
export const hashWithSalt = (secret: string, salt: string) => `{SSHA}${fingerprint(secret, salt)}${salt}`;

/** slappasswd : une empreinte {SSHA} (salée : deux fois le même mot de passe ne donne pas la même). */
export function hash(j: Game, secret: string): string {
  const n = (j.state.ldapSalt = (j.state.ldapSalt ?? 0) + 1);
  const salt = fingerprint(String(n), 'sel').slice(0, 8);
  return `{SSHA}${fingerprint(secret, salt)}${salt}`;
}

/** Un mot de passe correspond-il à la valeur de userPassword (empreinte, ou en clair) ? */
export function check(stores: string, secret: string): boolean {
  if (stores.startsWith('{SSHA}')) {
    const body = stores.slice(6);
    const salt = body.slice(-8);
    return fingerprint(secret, salt) === body.slice(0, -8);
  }
  return !stores.startsWith('{') && stores === secret;
}

export const inClear = (v: string) => !/^\{[A-Z0-9-]+\}/i.test(v);
