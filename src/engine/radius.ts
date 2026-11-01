// FreeRADIUS 3 on a machine (state.radius): the server that says yes or no
// to enterprise Wi-Fi access points (802.1X), based on the LDAP directory.
//   - the configuration (/etc/freeradius/3.0): clients.conf (the access points
//     allowed to ask questions, and their shared secret), the ldap
//     module (mods-enabled/ldap, a link to mods-available/ldap), the
//     answers file (mods-config/files/authorize, "users"); read when the
//     service starts, like radiusd;
//   - a request (Access-Request): the access point must be a known client, with
//     the right secret; the ldap module finds the person (uid) and their
//     userPassword, pap compares the password; the users file adds
//     the replies (the VLAN: Tunnel-Private-Group-Id), based on Ldap-Group.
// Sources: https://www.freeradius.org/documentation/freeradius-server/3.2.8/,
// https://wiki.freeradius.org/modules/Rlm_ldap, https://wiki.freeradius.org/config/Users,
// https://www.rfc-editor.org/rfc/rfc3580 (VLAN through RADIUS)
// Differences: no simulated EAP (the access points speak PAP, like EAP-TTLS/PAP
// inside the tunnel), no accounting, no sites other than
// default; a simplified configuration syntax (sections, key = value).

import type { Game } from './shell';
import { directory, normalise, find as findLdap, check, type Directory, type Input } from './ldap';
import { inside, isIp } from './lan';
import { nft, traverse, type Ruleset } from './nftables';
import { writeLog, systemd } from './systemd';

export const DIRECTORY = '/etc/freeradius/3.0';

// ——— Configuration file syntax ———

export interface Section {
  name: string;
  args: string[];
  values: Record<string, string>;
  sections: Section[];
}

/** Reads a FreeRADIUS configuration file; throws an error in radiusd's format. */
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
      // A bare name (a module listed in authorize { … }), or a section without a brace.
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

// ——— The users file (mods-config/files/authorize) ———

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

// ——— The loaded configuration ———

export interface ConfRadius {
  clients: { name: string; network: string; secret: string }[];
  ldap: null | { server: string; identity?: string; password?: string; base: string; userBase: string; baseGroup: string; byMemberUid: boolean };
  users: UsersInput[];
}

/** Reads the whole configuration, like radiusd at start-up (or freeradius -XC); errors as lines. */
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

// ——— A request ———

export interface Request {
  // Where the request comes from: the access point (its address and the router's interface), or the router itself (radtest).
  client: string;
  iif: string;
  secret: string;
  user: string;
  password: string;
}

export interface Response {
  // accept, reject, or nothing (the request is ignored: no reply at all).
  what: 'accept' | 'reject' | 'nothing';
  attributes: { attr: string; value: string }[];
  // What radiusd writes (log, or radiusd -X).
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
  // By default, rlm_ldap looks for the user's memberOf attribute; membership_filter allows memberUid.
  if (conf.byMemberUid) return (g.attrs.memberuid ?? []).includes(uid);
  return (user.attrs.memberof ?? []).some((m) => normalise(m) === normalise(g.dn));
};

/** What radiusd answers to a request, with this configuration loaded. */
export function handle(j: Game, d: Request, o: { conf?: ConfRadius | null; ruleset?: Ruleset; works?: boolean } = {}): Response {
  const conf = o.conf !== undefined ? o.conf : (radius(j)?.conf ?? null);
  const works = o.works ?? inWorks(j);
  const log: string[] = [];
  const nothing = (): Response => ({ what: 'nothing', attributes: [], log });
  if (!works || !conf) return nothing();
  // The firewall's input chain: UDP 1812 to the router.
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
  // The ldap module: bind, find the person, read their userPassword.
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
  // The "known" password: only if the module's identity is allowed to read userPassword.
  const admin = !!l?.identity && normalise(l.identity) === normalise(a?.admin ?? '');
  const known = input && admin ? (input.attrs.userpassword ?? []) : [];
  if (!known.length) {
    log.push('(0) pap: WARNING: No "known good" password found for the user.  Not setting Auth-Type');
    return refusal('No Auth-Type found: rejecting the user via Post-Auth-Type = Reject');
  }
  if (!known.some((v) => check(v, d.password))) return refusal('pap: Password comparison failed');
  // The users file: the first matching entry (and the next ones if Fall-Through).
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

/** The VLAN a reply gives (Tunnel-Private-Group-Id), if complete (with Tunnel-Type and Tunnel-Medium-Type). */
export function vlanFor(r: Response): number | null {
  const v = (n: string) => r.attributes.find((x) => x.attr.replace(/:\d+$/, '') === n)?.value;
  if (r.what !== 'accept' || v('Tunnel-Type') !== 'VLAN' || !['IEEE-802', '6'].includes(v('Tunnel-Medium-Type') ?? '')) return null;
  const id = Number(v('Tunnel-Private-Group-Id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** When freeradius starts: the configuration is read (and kept); the access points' requests are logged. */
export function loadRadius(j: Game, requests: Request[] = []) {
  const { conf } = readRadius(j);
  j.state.radius = { conf };
  const sd = systemd(j);
  if (!sd) return;
  writeLog(sd, 'freeradius.service', 'freeradius', 1630, 'Ready to process requests');
  for (const d of requests) for (const l of handle(j, d).log) writeLog(sd, 'freeradius.service', 'freeradius', 1630, l);
}
