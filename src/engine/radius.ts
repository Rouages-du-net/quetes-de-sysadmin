// FreeRADIUS 3 sur une machine (etat.radius) : le serveur qui dit oui ou non
// aux bornes Wi-Fi d'entreprise (802.1X), d'après l'annuaire LDAP.
//   - la configuration (/etc/freeradius/3.0) : clients.conf (les bornes qui
//     ont le droit de poser des questions, et leur secret partagé), le module
//     ldap (mods-enabled/ldap, un lien vers mods-available/ldap), le fichier
//     des réponses (mods-config/files/authorize, « users ») ; lue au
//     démarrage du service, comme radiusd ;
//   - une demande (Access-Request) : la borne doit être un client connu, avec
//     le bon secret ; le module ldap trouve la personne (uid) et son
//     userPassword, pap compare le mot de passe ; le fichier users ajoute
//     les réponses (le VLAN : Tunnel-Private-Group-Id), d'après Ldap-Group.
// Sources : https://www.freeradius.org/documentation/freeradius-server/3.2.8/,
// https://wiki.freeradius.org/modules/Rlm_ldap, https://wiki.freeradius.org/config/Users,
// https://www.rfc-editor.org/rfc/rfc3580 (VLAN par RADIUS)
// Écarts : pas d'EAP simulé (les bornes parlent PAP, comme EAP-TTLS/PAP
// dans le tunnel), pas de comptabilité (accounting), ni de sites autres que
// default ; une syntaxe de configuration simplifiée (sections, clé = valeur).

import type { Game } from './shell';
import { directory, normalise, find as findLdap, check, type Directory, type Input } from './ldap';
import { inside, isIp } from './lan';
import { nft, traverse, type Ruleset } from './nftables';
import { writeLog, systemd } from './systemd';

export const DIRECTORY = '/etc/freeradius/3.0';

// ——— La syntaxe des fichiers de configuration ———

export interface Section {
  name: string;
  args: string[];
  values: Record<string, string>;
  sections: Section[];
}

/** Lit un fichier de configuration de FreeRADIUS ; lève une erreur au format de radiusd. */
export function readConfRadius(text: string, file: string): Section {
  const root: Section = { name: '', args: [], values: {}, sections: [] };
  const stack = [root];
  text.split('\n').forEach((rawValue, i) => {
    const line = rawValue.replace(/(^|\s)#.*$/, '').trim();
    if (!line) return;
    const place = `${file}[${i + 1}]`;
    if (line === '}') {
      if (stack.length === 1) throw new Error(`${place}: Too many closing braces`);
      stack.pop();
      return;
    }
    const opens = /^([\w.-]+)((?:\s+[^\s{]+)*)\s*\{$/.exec(line);
    if (opens) {
      const s: Section = { name: opens[1], args: opens[2].trim().split(/\s+/).filter(Boolean), values: {}, sections: [] };
      stack.at(-1)!.sections.push(s);
      stack.push(s);
      return;
    }
    const kv = /^([\w.:-]+)\s*(\+?=|:=)\s*(.*)$/.exec(line);
    if (kv) {
      const value = kv[3].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!value) throw new Error(`${place}: Syntax error: Expected value after "${kv[1]} ="`);
      stack.at(-1)!.values[kv[1]] = value;
      return;
    }
    if (/^[\w.-]+(\s+[\w.-]+)*$/.test(line)) {
      // Un nom seul (un module listé dans authorize { … }), ou une section sans accolade.
      if (/^(client|ldap|user|group)\b/.test(line) && stack.length === 1)
        throw new Error(`${place}: Expecting section start brace '{' after "${line}"`);
      stack.at(-1)!.values[line] = '';
      return;
    }
    throw new Error(`${place}: Parse error after "${line.split(/\s+/)[0]}"`);
  });
  if (stack.length > 1) throw new Error(`${file}[${text.split('\n').length}]: Section "${stack.at(-1)!.name}" is missing a closing brace`);
  return root;
}

// ——— Le fichier users (mods-config/files/authorize) ———

export interface UsersInput {
  name: string;
  checks: { attr: string; op: string; value: string }[];
  responses: { attr: string; op: string; value: string }[];
  next: boolean;
}

const COUPLE = /^([\w-]+(?::\d+)?)\s*(==|:=|=|\+=|!=|=~)\s*("[^"]*"|[^,\s]+)$/;

export function readUsers(text: string, file: string): UsersInput[] {
  const inputs: UsersInput[] = [];
  let current: UsersInput | null = null;
  text.split('\n').forEach((rawValue, i) => {
    if (/^\s*#/.test(rawValue) || !rawValue.trim()) return;
    const place = `${file}[${i + 1}]`;
    const couples = (end: string) =>
      end
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const m = COUPLE.exec(x);
          if (!m)
            throw new Error(
              `${place}: Parse error (${current ? 'reply' : 'check'}) for entry ${current?.name ?? x.split(/\s+/)[0]}: Expected end of line or comma`,
            );
          return { attr: m[1], op: m[2], value: m[3].replace(/^"(.*)"$/, '$1') };
        });
    if (!/^\s/.test(rawValue)) {
      const [name, ...rest] = rawValue.trim().split(/\s+/);
      current = { name, checks: [], responses: [], next: false };
      inputs.push(current);
      current.checks = couples(rest.join(' '));
      return;
    }
    if (!current) throw new Error(`${place}: Entry does not begin with a user name`);
    const r = couples(rawValue);
    for (const c of r) {
      if (c.attr === 'Fall-Through') current.next = /^(yes|1)$/i.test(c.value);
      else current.responses.push(c);
    }
  });
  return inputs;
}

// ——— La configuration chargée ———

export interface ConfRadius {
  clients: { name: string; network: string; secret: string }[];
  ldap: null | { server: string; identity?: string; password?: string; base: string; userBase: string; baseGroup: string; byMemberUid: boolean };
  users: UsersInput[];
}

/** Lit toute la configuration, comme radiusd au démarrage (ou freeradius -XC) ; les erreurs en lignes. */
export function readRadius(j: Game): { conf: ConfRadius | null; errors: string[] } {
  const read = (f: string) => j.read(`${DIRECTORY}/${f}`);
  try {
    const clients = readConfRadius(read('clients.conf') ?? '', `${DIRECTORY}/clients.conf`)
      .sections.filter((s) => s.name === 'client')
      .map((s) => {
        const ip = s.values.ipaddr ?? s.values.ipv4addr ?? s.values.ipv6addr ?? '';
        if (!s.values.secret) throw new Error(`${DIRECTORY}/clients.conf: No 'secret' was specified for client ${s.args[0] ?? ''}`);
        return { name: s.args[0] ?? '', network: ip.includes('/') || !isIp(ip) ? ip : `${ip}/32`, secret: s.values.secret };
      });
    let ldap: ConfRadius['ldap'] = null;
    const ldapText = read('mods-enabled/ldap');
    if (ldapText !== null) {
      const s = readConfRadius(ldapText, `${DIRECTORY}/mods-enabled/ldap`).sections.find((x) => x.name === 'ldap');
      if (s) {
        const base = s.values.base_dn ?? '';
        const replace = (v: string | undefined) => (v ?? '${..base_dn}').replace('${..base_dn}', base);
        const user = s.sections.find((x) => x.name === 'user');
        const group = s.sections.find((x) => x.name === 'group');
        ldap = {
          server: s.values.server ?? 'localhost',
          identity: s.values.identity,
          password: s.values.password,
          base,
          userBase: replace(user?.values.base_dn),
          baseGroup: replace(group?.values.base_dn),
          byMemberUid: /memberUid=/.test(group?.values.membership_filter ?? ''),
        };
      }
    }
    const users = readUsers(read('mods-config/files/authorize') ?? '', `${DIRECTORY}/mods-config/files/authorize`);
    return { conf: { clients, ldap, users }, errors: [] };
  } catch (e) {
    return { conf: null, errors: [(e as Error).message, `Errors reading or parsing ${DIRECTORY}/radiusd.conf`] };
  }
}

export const radius = (j: Game) => j.state.radius as { conf: ConfRadius | null } | undefined;
export const inWorks = (j: Game) => systemd(j)?.services.freeradius?.state === 'active';

// ——— Une demande ———

export interface Request {
  // D'où vient la demande : la borne (son adresse et l'interface du routeur), ou le routeur lui-même (radtest).
  client: string;
  iif: string;
  secret: string;
  user: string;
  password: string;
}

export interface Response {
  // accept, reject, ou rien (la demande est ignorée : pas de réponse du tout).
  what: 'accept' | 'reject' | 'rien';
  attributes: { attr: string; value: string }[];
  // Ce que radiusd écrit (journal, ou radiusd -X).
  log: string[];
}

const groupFor = (a: Directory, conf: NonNullable<ConfRadius['ldap']>, uid: string, user: Input, group: string): boolean => {
  const g = a.inputs.find(
    (e) =>
      (e.attrs.objectclass ?? []).some((c) => c.toLowerCase() === 'posixgroup') &&
      normalise(e.dn).endsWith(normalise(conf.baseGroup)) &&
      ((e.attrs.cn ?? []).includes(group) || normalise(e.dn) === normalise(group)),
  );
  if (!g) return false;
  // Par défaut, rlm_ldap cherche l'attribut memberOf de l'utilisateur ; membership_filter permet memberUid.
  if (conf.byMemberUid) return (g.attrs.memberuid ?? []).includes(uid);
  return (user.attrs.memberof ?? []).some((m) => normalise(m) === normalise(g.dn));
};

/** Ce que répond radiusd à une demande, avec cette configuration chargée. */
export function handle(j: Game, d: Request, o: { conf?: ConfRadius | null; ruleset?: Ruleset; works?: boolean } = {}): Response {
  const conf = o.conf !== undefined ? o.conf : (radius(j)?.conf ?? null);
  const works = o.works ?? inWorks(j);
  const log: string[] = [];
  const nothing = (): Response => ({ what: 'rien', attributes: [], log });
  if (!works || !conf) return nothing();
  // La chaîne input du pare-feu : UDP 1812 vers le routeur.
  const pkg = {
    iif: d.iif,
    oif: '',
    saddr: d.client,
    daddr: '10.10.30.1',
    proto: 'udp' as const,
    sport: 41234,
    dport: 1812,
    ct: 'new' as const,
    size: 120,
  };
  if (d.iif !== 'lo' && !traverse(o.ruleset ?? nft(j), 'input', 'filter', pkg).pass) return nothing();
  const client = conf.clients.find((c) => (c.network.includes('/') ? inside(d.client, c.network) : c.network === d.client));
  if (!client) {
    log.push(`Ignoring request to auth address * port 1812 bound to server default from unknown client ${d.client} port 41234 proto udp`);
    return nothing();
  }
  if (client.secret !== d.secret) {
    log.push(
      `Dropping packet without response because of error: Received packet from ${d.client} with invalid Message-Authenticator!  (Shared secret is incorrect.)`,
    );
    return nothing();
  }
  const refusal = (reason: string): Response => {
    log.push(`Auth: (0) Login incorrect (${reason}): [${d.user}] (from client ${client.name} port 0)`);
    return { what: 'reject', attributes: [], log };
  };
  // Le module ldap : se présenter, trouver la personne, lire son userPassword.
  const l = conf.ldap;
  const a = directory(j);
  let input: Input | undefined;
  if (l) {
    if (!a || systemd(j)?.services.slapd?.state !== 'active') {
      log.push(`rlm_ldap (ldap): Bind with ${l.identity ?? '(anonymous)'} to ldap://${l.server}:389 failed: Can't contact LDAP server`);
      return refusal('ldap: module failed');
    }
    if (
      l.identity &&
      !(normalise(l.identity) === normalise(a.admin)
        ? check(String(j.state.ldapAdmin ?? ''), l.password ?? '')
        : (findLdap(a, l.identity)?.attrs.userpassword ?? []).some((v) => check(v, l.password ?? '')))
    ) {
      log.push(`rlm_ldap (ldap): Bind with ${l.identity} to ldap://${l.server}:389 failed: Invalid credentials`);
      return refusal('ldap: module failed');
    }
    input = a.inputs.find(
      (e) => (e.attrs.uid ?? []).includes(d.user) && normalise(e.dn).endsWith(normalise(l.userBase)) && l.userBase !== '',
    );
    if (!input) {
      log.push(`(0) ldap: User object not found`);
      return refusal('No Auth-Type found: rejecting the user via Post-Auth-Type = Reject');
    }
  }
  // Le mot de passe « connu » : seulement si l'identité du module a le droit de lire userPassword.
  const admin = !!l?.identity && normalise(l.identity) === normalise(a?.admin ?? '');
  const known = input && admin ? (input.attrs.userpassword ?? []) : [];
  if (!known.length) {
    log.push('(0) pap: WARNING: No "known good" password found for the user.  Not setting Auth-Type');
    return refusal('No Auth-Type found: rejecting the user via Post-Auth-Type = Reject');
  }
  if (!known.some((v) => check(v, d.password))) return refusal('pap: Password comparison failed');
  // Le fichier users : la première entrée qui correspond (et les suivantes si Fall-Through).
  const attributes: Response['attributes'] = [];
  for (const u of conf.users) {
    if (u.name !== 'DEFAULT' && u.name !== d.user) continue;
    const ok = u.checks.every((v) => {
      if (v.attr.toLowerCase() === 'ldap-group') {
        const member = !!l && !!a && !!input && groupFor(a, l, d.user, input, v.value);
        return v.op === '!=' ? !member : member;
      }
      if (v.attr === 'Auth-Type') return true;
      return false;
    });
    if (!ok) continue;
    if (u.checks.some((v) => v.attr === 'Auth-Type' && v.value === 'Reject')) return refusal('Auth-Type = Reject');
    for (const r of u.responses) {
      const i = attributes.findIndex((x) => x.attr === r.attr);
      if (i >= 0 && r.op !== '+=') attributes[i] = { attr: r.attr, value: r.value };
      else attributes.push({ attr: r.attr, value: r.value });
    }
    if (!u.next) break;
  }
  log.push(`Auth: (0) Login OK: [${d.user}] (from client ${client.name} port 0)`);
  return { what: 'accept', attributes, log };
}

/** Le VLAN qu'une réponse donne (Tunnel-Private-Group-Id), s'il est complet (avec Tunnel-Type et Tunnel-Medium-Type). */
export function vlanFor(r: Response): number | null {
  const v = (n: string) => r.attributes.find((x) => x.attr.replace(/:\d+$/, '') === n)?.value;
  if (r.what !== 'accept' || v('Tunnel-Type') !== 'VLAN' || !['IEEE-802', '6'].includes(v('Tunnel-Medium-Type') ?? '')) return null;
  const id = Number(v('Tunnel-Private-Group-Id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Au démarrage de freeradius : la configuration est lue (et gardée) ; les demandes des bornes sont journalisées. */
export function loadRadius(j: Game, requests: Request[] = []) {
  const { conf } = readRadius(j);
  j.state.radius = { conf };
  const sd = systemd(j);
  if (!sd) return;
  writeLog(sd, 'freeradius.service', 'freeradius', 1630, 'Ready to process requests');
  for (const d of requests) for (const l of handle(j, d).log) writeLog(sd, 'freeradius.service', 'freeradius', 1630, l);
}
