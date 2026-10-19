// Un annuaire LDAP (OpenLDAP, slapd) sur une machine (etat.ldap) : des
// entrées rangées en arbre sous une base (dc=laruche,dc=example), chacune
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

import type { Jeu } from './shell';

export interface Entree {
  dn: string;
  attrs: Record<string, string[]>;
}

export interface Annuaire {
  base: string;
  admin: string;
  entrees: Entree[];
}

export const annuaire = (j: Jeu) => j.etat.ldap as Annuaire | undefined;

// ——— Les noms (DN) ———

/** Un DN sous une forme comparable : minuscules, sans blancs autour des virgules et des =. */
export const normaliser = (dn: string) =>
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
export const trouver = (a: Annuaire, dn: string) => a.entrees.find((e) => normaliser(e.dn) === normaliser(dn));
export const sous = (dn: string, base: string) => normaliser(dn) === normaliser(base) || normaliser(dn).endsWith(',' + normaliser(base));

// ——— Le schéma ———

// Les attributs connus (en minuscules), avec leurs noms officiels.
const ATTRIBUTS = [
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
const NOM_ATTRIBUT = Object.fromEntries(ATTRIBUTS.map((a) => [a.toLowerCase(), a]));
export const nomAttribut = (a: string) => NOM_ATTRIBUT[a.toLowerCase()] ?? a;

// Les classes connues : les attributs qu'elles exigent (MUST) et permettent (MAY).
const CLASSES: Record<string, { must: string[]; may: string[]; structurelle: boolean }> = {
  top: { must: [], may: [], structurelle: false },
  dcobject: { must: ['dc'], may: ['description'], structurelle: false },
  organization: { must: ['o'], may: ['description', 'telephoneNumber', 'l'], structurelle: true },
  organizationalunit: { must: ['ou'], may: ['description', 'telephoneNumber', 'l'], structurelle: true },
  person: { must: ['sn', 'cn'], may: ['userPassword', 'telephoneNumber', 'description'], structurelle: true },
  organizationalperson: { must: ['sn', 'cn'], may: ['title', 'l', 'telephoneNumber', 'description', 'userPassword'], structurelle: true },
  inetorgperson: {
    must: ['sn', 'cn'],
    may: ['givenName', 'displayName', 'uid', 'mail', 'telephoneNumber', 'title', 'employeeType', 'description', 'userPassword', 'l'],
    structurelle: true,
  },
  posixaccount: {
    must: ['cn', 'uid', 'uidNumber', 'gidNumber', 'homeDirectory'],
    may: ['userPassword', 'loginShell', 'gecos', 'description'],
    structurelle: false,
  },
  shadowaccount: { must: ['uid'], may: ['userPassword', 'description'], structurelle: false },
  posixgroup: { must: ['cn', 'gidNumber'], may: ['userPassword', 'memberUid', 'description'], structurelle: true },
  groupofnames: { must: ['member', 'cn'], may: ['description', 'o', 'ou'], structurelle: true },
  organizationalrole: { must: ['cn'], may: ['description', 'telephoneNumber', 'l'], structurelle: true },
  simplesecurityobject: { must: ['userPassword'], may: [], structurelle: false },
};

export interface ErreurLdap {
  code: number;
  texte: string;
  info?: string;
}

const NOMS_CODES: Record<number, string> = {
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
export const erreur = (code: number, info?: string): ErreurLdap => ({ code, texte: NOMS_CODES[code], ...(info ? { info } : {}) });

/** Une entrée respecte-t-elle le schéma ? null si oui. */
export function verifierSchema(e: Entree): ErreurLdap | null {
  for (const a of Object.keys(e.attrs)) if (!NOM_ATTRIBUT[a]) return erreur(17, `${a}: attribute type undefined`);
  const classes = (e.attrs.objectclass ?? []).map((c) => c.toLowerCase());
  if (!classes.length) return erreur(65, 'no objectClass attribute');
  for (const c of classes) if (!CLASSES[c]) return erreur(21, `objectClass: value #0 invalid per syntax`);
  if (!classes.some((c) => CLASSES[c].structurelle)) return erreur(65, 'no structural object class provided');
  for (const c of classes)
    for (const m of CLASSES[c].must)
      if (!e.attrs[m.toLowerCase()]?.length) return erreur(65, `object class '${nomClasse(c)}' requires attribute '${m}'`);
  const permis = new Set(['objectclass', ...classes.flatMap((c) => [...CLASSES[c].must, ...CLASSES[c].may].map((x) => x.toLowerCase()))]);
  for (const a of Object.keys(e.attrs)) if (!permis.has(a)) return erreur(65, `attribute '${nomAttribut(a)}' not allowed`);
  // L'attribut du nom (uid=sami…) doit être dans l'entrée.
  const [rdnA, rdnV] = e.dn
    .split(',')[0]
    .split('=')
    .map((x) => x.trim());
  if (!e.attrs[rdnA.toLowerCase()]?.some((v) => v.toLowerCase() === (rdnV ?? '').toLowerCase()))
    return erreur(64, 'value of naming attribute is not present in entry');
  for (const n of ['uidnumber', 'gidnumber'])
    if (e.attrs[n]?.some((v) => !/^\d+$/.test(v))) return erreur(21, `${nomAttribut(n)}: value #0 invalid per syntax`);
  return null;
}

const NOMS_CLASSES: Record<string, string> = {
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
const nomClasse = (c: string) => NOMS_CLASSES[c] ?? c;

// ——— LDIF ———

export type Changement =
  | { quoi: 'add'; entree: Entree; ligne: number }
  | { quoi: 'delete'; dn: string; ligne: number }
  | { quoi: 'modify'; dn: string; ops: { op: 'add' | 'replace' | 'delete'; attr: string; valeurs: string[] }[]; ligne: number };

/** Lit un texte LDIF ; `ajout` : sans changetype, une entrée est un ajout (ldapadd). Lève une erreur au format d'ldapmodify. */
export function lireLdif(texte: string, ajout: boolean): Changement[] {
  // Les lignes repliées (qui commencent par une espace) continuent la précédente.
  const lignes: { t: string; n: number }[] = [];
  texte.split('\n').forEach((brute, i) => {
    if (brute.startsWith(' ') && lignes.length && lignes.at(-1)!.t !== '') lignes.at(-1)!.t += brute.slice(1);
    else lignes.push({ t: brute.replace(/\r$/, ''), n: i + 1 });
  });
  const blocs: { t: string; n: number }[][] = [[]];
  for (const l of lignes) {
    if (l.t.startsWith('#')) continue;
    if (l.t.trim() === '') {
      if (blocs.at(-1)!.length) blocs.push([]);
    } else blocs.at(-1)!.push(l);
  }
  const changements: Changement[] = [];
  for (const bloc of blocs.filter((b) => b.length)) {
    const paires = bloc.map((l) => {
      // « - » sépare deux changements d'un même modify.
      if (l.t.trim() === '-') return { a: '-', v: '', n: l.n };
      const k = l.t.indexOf(':');
      if (k < 0) throw new Error(`ldapmodify: invalid format (line ${l.n}) entry: ""`);
      return { a: l.t.slice(0, k).trim(), v: l.t.slice(k + 1).replace(/^:?\s*/, ''), n: l.n };
    });
    if (paires[0].a.toLowerCase() !== 'dn') throw new Error(`ldapmodify: invalid format (line ${paires[0].n}) entry: ""`);
    const dn = paires[0].v.trim();
    let reste = paires.slice(1);
    let type = ajout ? 'add' : 'modify';
    if (reste[0]?.a.toLowerCase() === 'changetype') {
      type = reste[0].v.trim().toLowerCase();
      reste = reste.slice(1);
    } else if (!ajout) throw new Error(`ldapmodify: modify operation type is missing at line ${paires[0].n}, entry "${dn}"`);
    if (type === 'add') {
      const attrs: Record<string, string[]> = {};
      for (const p of reste) (attrs[p.a.toLowerCase()] ??= []).push(p.v.trim());
      changements.push({ quoi: 'add', entree: { dn, attrs }, ligne: paires[0].n });
    } else if (type === 'delete') changements.push({ quoi: 'delete', dn, ligne: paires[0].n });
    else if (type === 'modify') {
      const ops: { op: 'add' | 'replace' | 'delete'; attr: string; valeurs: string[] }[] = [];
      let courante: (typeof ops)[number] | null = null;
      for (const p of reste) {
        if (p.a === '-') {
          courante = null;
          continue;
        }
        const op = p.a.toLowerCase();
        if (!courante && (op === 'add' || op === 'replace' || op === 'delete')) {
          courante = { op, attr: p.v.trim(), valeurs: [] };
          ops.push(courante);
        } else if (courante && p.a.toLowerCase() === courante.attr.toLowerCase()) courante.valeurs.push(p.v.trim());
        else throw new Error(`ldapmodify: wrong attributeType at line ${p.n}, entry "${dn}"`);
      }
      changements.push({ quoi: 'modify', dn, ops, ligne: paires[0].n });
    } else throw new Error(`ldapmodify: invalid changetype "${type}" at line ${paires[0].n}, entry "${dn}"`);
  }
  return changements;
}

/** Applique un changement ; renvoie l'erreur de slapd, ou null. */
export function appliquer(a: Annuaire, c: Changement): ErreurLdap | null {
  if (c.quoi === 'add') {
    if (!/^[\w-]+=[^,]+(,[\w-]+=[^,]+)*$/.test(c.entree.dn.replace(/\s*,\s*/g, ','))) return erreur(34, 'invalid DN');
    if (trouver(a, c.entree.dn)) return erreur(68);
    if (!sous(c.entree.dn, a.base)) return erreur(32);
    if (normaliser(c.entree.dn) !== normaliser(a.base) && !trouver(a, parent(c.entree.dn))) return erreur(32);
    const e = verifierSchema(c.entree);
    if (e) return e;
    a.entrees.push(structuredClone(c.entree));
    return null;
  }
  const e = trouver(a, c.dn);
  if (!e) return erreur(32);
  if (c.quoi === 'delete') {
    if (a.entrees.some((x) => normaliser(parent(x.dn)) === normaliser(e.dn))) return erreur(66, 'subordinate objects must be deleted first');
    a.entrees = a.entrees.filter((x) => x !== e);
    return null;
  }
  const copie = structuredClone(e);
  for (const o of c.ops) {
    const cle = o.attr.toLowerCase();
    if (!NOM_ATTRIBUT[cle]) return erreur(17, `${o.attr}: attribute type undefined`);
    const avant = copie.attrs[cle] ?? [];
    if (o.op === 'add') {
      const deja = o.valeurs.find((v) => avant.some((x) => x.toLowerCase() === v.toLowerCase()));
      if (deja) return erreur(20, `modify/add: ${nomAttribut(cle)}: value #0 already exists`);
      copie.attrs[cle] = [...avant, ...o.valeurs];
    } else if (o.op === 'replace') {
      if (o.valeurs.length) copie.attrs[cle] = [...o.valeurs];
      else delete copie.attrs[cle];
    } else {
      if (!o.valeurs.length) {
        if (!avant.length) return erreur(16, `modify/delete: ${nomAttribut(cle)}: no such attribute`);
        delete copie.attrs[cle];
      } else {
        const absente = o.valeurs.find((v) => !avant.some((x) => x.toLowerCase() === v.toLowerCase()));
        if (absente) return erreur(16, `modify/delete: ${nomAttribut(cle)}: no such value`);
        copie.attrs[cle] = avant.filter((x) => !o.valeurs.some((v) => v.toLowerCase() === x.toLowerCase()));
        if (!copie.attrs[cle].length) delete copie.attrs[cle];
      }
    }
  }
  const s = verifierSchema(copie);
  if (s) return s;
  e.attrs = copie.attrs;
  return null;
}

// ——— Les filtres (RFC 4515) ———

type Filtre = { et: Filtre[] } | { ou: Filtre[] } | { non: Filtre } | { attr: string; motif: string };

export function lireFiltre(texte: string): Filtre | null {
  let k = 0;
  const t = texte.trim().startsWith('(') ? texte.trim() : `(${texte.trim()})`;
  const lire = (): Filtre | null => {
    if (t[k] !== '(') return null;
    k++;
    let f: Filtre | null;
    if (t[k] === '&' || t[k] === '|') {
      const op = t[k++];
      const liste: Filtre[] = [];
      while (t[k] === '(') {
        const x = lire();
        if (!x) return null;
        liste.push(x);
      }
      f = op === '&' ? { et: liste } : { ou: liste };
    } else if (t[k] === '!') {
      k++;
      const x = lire();
      if (!x) return null;
      f = { non: x };
    } else {
      const fin = t.indexOf(')', k);
      if (fin < 0) return null;
      const corps = t.slice(k, fin);
      const e = corps.indexOf('=');
      if (e <= 0) return null;
      f = {
        attr: corps
          .slice(0, e)
          .replace(/[~<>]$/, '')
          .toLowerCase(),
        motif: corps.slice(e + 1),
      };
      k = fin;
    }
    if (t[k] !== ')') return null;
    k++;
    return f;
  };
  const f = lire();
  return f && k === t.length ? f : null;
}

export function correspond(f: Filtre, e: Entree): boolean {
  if ('et' in f) return f.et.every((x) => correspond(x, e));
  if ('ou' in f) return f.ou.some((x) => correspond(x, e));
  if ('non' in f) return !correspond(f.non, e);
  const valeurs = e.attrs[f.attr] ?? [];
  if (f.motif === '*') return valeurs.length > 0;
  const re = new RegExp(
    `^${f.motif
      .split('*')
      .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
    'i',
  );
  return valeurs.some((v) => re.test(v));
}

// ——— Les mots de passe ———

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function empreinte(secret: string, sel: string): string {
  let h = 2166136261;
  const octets: number[] = [];
  for (let i = 0; i < 24; i++) {
    for (const c of secret + sel + String(i)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    octets.push(h & 63);
  }
  return octets.map((o) => B64[o]).join('');
}

/** Une empreinte {SSHA} avec un sel donné (pour les entrées de départ d'un chapitre). */
export const hacherAvecSel = (secret: string, sel: string) => `{SSHA}${empreinte(secret, sel)}${sel}`;

/** slappasswd : une empreinte {SSHA} (salée : deux fois le même mot de passe ne donne pas la même). */
export function hacher(j: Jeu, secret: string): string {
  const n = (j.etat.ldapSel = (j.etat.ldapSel ?? 0) + 1);
  const sel = empreinte(String(n), 'sel').slice(0, 8);
  return `{SSHA}${empreinte(secret, sel)}${sel}`;
}

/** Un mot de passe correspond-il à la valeur de userPassword (empreinte, ou en clair) ? */
export function verifier(stocke: string, secret: string): boolean {
  if (stocke.startsWith('{SSHA}')) {
    const corps = stocke.slice(6);
    const sel = corps.slice(-8);
    return empreinte(secret, sel) === corps.slice(0, -8);
  }
  return !stocke.startsWith('{') && stocke === secret;
}

export const enClair = (v: string) => !/^\{[A-Z0-9-]+\}/i.test(v);
