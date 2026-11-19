// Active Directory Domain Services: a domain (DNS name school.internal,
// NetBIOS name SCHOOL), kept on its domain controller (state.ad), which a
// member server reaches (state.windows.domain names it):
//   - objects with a distinguished name (CN=Alice Martin,OU=Teachers,
//     DC=school,DC=internal), an objectGUID and, for security principals, a
//     SID (the domain's SID and a RID, deterministic); the default
//     containers CN=Users, CN=Computers, CN=Builtin and OU=Domain
//     Controllers; organizational units (ProtectedFromAccidentalDeletion);
//   - users: sAMAccountName, userPrincipalName, enabled, the password and
//     when it was set, "never expires", "must change at next logon", the
//     account's expiry, badPwdCount, the lockout, the last logon, the
//     usual attributes (Department, Title, Manager…), their groups;
//   - groups: scope (Global, DomainLocal, Universal), category (Security,
//     Distribution), members (nested groups count: a token holds every
//     group reached), the primary group (Domain Users, Domain Computers);
//   - computers; the domain's password and lockout policy
//     (Get-ADDefaultDomainPasswordPolicy: no lockout by default);
//   - a logon with a domain account (DOMAIN\user or user@domain) on a member
//     server: a wrong password counts in badPwdCount, the account locks at
//     the threshold (event 4740 in the domain controller's Security log, with
//     the caller computer's name; 4625 on the machine that was asked), a
//     locked, disabled or expired account is refused; domain groups in the
//     token of NTFS permissions and share permissions (windows-acl.ts hooks);
//   - the filters of the ActiveDirectory module: the PowerShell Expression
//     Language of -Filter (Name -like 'a*' -and Enabled -eq $false) and LDAP
//     filters (-LDAPFilter, read by ldap.ts).
// Sources (Microsoft Learn): "Active Directory Domain Services overview"
// (https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview),
// "Active Directory security groups" (default groups, RIDs,
// https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups),
// "Group scope" (https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups#group-scope),
// "Account Lockout Policy" (threshold, duration, reset counter after,
// https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/account-lockout-policy),
// "Password Policy" (domain defaults: 42 days, 7 characters, 24 remembered,
// https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/password-policy),
// events 4740 and 4625
// (https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740,
// https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625),
// about_ActiveDirectory_Filter
// (https://learn.microsoft.com/previous-versions/windows/server/hh531527(v=ws.10)),
// "OpenSSH for Windows: domain users" (DOMAIN\user, user@domain,
// https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration).
// Simplifications (docs/SCENARIOS.md): one domain, one domain controller (no
// replication, no sites, no FSMO roles to move), no Kerberos tickets (a
// logon is checked at once), no fine-grained password policies, no
// password history, no ACLs on directory objects.

import type { Game, Shell } from './shell';
import { logEvent, longDate, windows } from './windows';
import { DOMAIN_HOOKS, type Principal } from './windows-acl';
import { LOGON_HOOKS } from './windows-accounts';
import { normalise, readFilter, correspond } from './ldap';
import { PSDate, wildcard } from './powershell';

const DAY = 86_400_000;
const MINUTE = 60_000;

export type AdClass = 'user' | 'group' | 'organizationalUnit' | 'container' | 'computer' | 'domainDNS' | 'builtinDomain';

export interface AdObject {
  dn: string;
  cls: AdClass;
  // The RDN's value (CN or OU).
  name: string;
  guid: string;
  // The SID's RID (the domain's SID before it; S-1-5-32 for the Builtin groups).
  rid?: number;
  builtin?: boolean;
  sam?: string;
  description?: string;
  created: number;
  modified: number;
  protected?: boolean;
  // A user.
  upn?: string;
  given?: string;
  surname?: string;
  display?: string;
  enabled?: boolean;
  passwordLastSet?: number | null;
  mustChange?: boolean;
  neverExpires?: boolean;
  cannotChange?: boolean;
  accountExpires?: number | null;
  badPwdCount?: number;
  badPasswordTime?: number | null;
  lockoutTime?: number | null;
  lastLogon?: number | null;
  department?: string;
  title?: string;
  office?: string;
  company?: string;
  mail?: string;
  manager?: string;
  primaryGroup?: number;
  // A group.
  scope?: 'Global' | 'DomainLocal' | 'Universal';
  category?: 'Security' | 'Distribution';
  members?: string[];
  // A computer.
  dnsHostName?: string;
  os?: string;
  osVersion?: string;
  address?: string;
  // Group Policy: the GPOs linked here (first: link order 1), inheritance blocked.
  gpLinks?: GpLink[];
  blockInheritance?: boolean;
  // In the AD Recycle Bin: where it was, when it was deleted, the groups it was in (link values kept).
  deleted?: { parent: string; at: number; name: string; groups: string[] };
}

/** A workstation of the domain that isn't a machine of the game: who is logged on, the policy last applied there (gpresult /s). */
export interface ClientSession {
  computer: string;
  user: string;
  logon: number;
  // The applied policy (windows-gpo.ts AppliedPolicy), computed at logon and by Invoke-GPUpdate.
  gp?: unknown;
}

export interface GpLink {
  gpo: string;
  enabled: boolean;
  enforced: boolean;
}

export type GpoSetting =
  // A firewall rule (Computer Configuration > Windows Defender Firewall).
  | { kind: 'firewallRule'; display: string; protocol: string; localPort: string[]; remoteAddress?: string[]; action: 'Allow' | 'Block'; direction?: 'Inbound' | 'Outbound'; name?: string }
  // A firewall profile turned on or off.
  | { kind: 'firewallProfile'; profile: 'Domain' | 'Private' | 'Public'; enabled: boolean }
  // A drive mapped at logon (User Configuration > Preferences > Drive Maps).
  | { kind: 'driveMap'; letter: string; path: string; label?: string }
  // A logon script (User Configuration > Windows Settings > Scripts).
  | { kind: 'logonScript'; script: string }
  // A user right (Computer Configuration > User Rights Assignment): deny log on locally…
  | { kind: 'userRight'; right: 'SeDenyInteractiveLogonRight' | 'SeDenyNetworkLogonRight' | 'SeDenyRemoteInteractiveLogonRight' | 'SeInteractiveLogonRight'; accounts: string[] }
  // The account policies (only effective at the domain's level).
  | { kind: 'passwordPolicy'; minLength?: number; maxAge?: number; complexity?: boolean; history?: number }
  | { kind: 'lockoutPolicy'; threshold?: number; duration?: number; window?: number }
  // A registry value (Administrative Templates), as Set-GPRegistryValue writes it.
  | { kind: 'registry'; key: string; value: string; data: string | number };

/** Which half of a GPO a setting belongs to. */
export const settingSide = (s: GpoSetting): 'user' | 'computer' => (s.kind === 'driveMap' || s.kind === 'logonScript' || (s.kind === 'registry' && /^HKCU/i.test(s.key)) ? 'user' : 'computer');

export interface GpoPermission {
  // The trustee's canonical name (NT AUTHORITY\Authenticated Users, SCHOOL\Teachers).
  trustee: string;
  permission: 'GpoApply' | 'GpoRead' | 'GpoEdit' | 'GpoEditDeleteModifySecurity' | 'GpoCustom';
  denied?: boolean;
}

export interface Gpo {
  id: string;
  name: string;
  description: string;
  owner: string;
  created: number;
  modified: number;
  status: 'AllSettingsEnabled' | 'UserSettingsDisabled' | 'ComputerSettingsDisabled' | 'AllSettingsDisabled';
  userVersion: number;
  computerVersion: number;
  settings: GpoSetting[];
  permissions: GpoPermission[];
}

export interface DomainPolicy {
  complexity: boolean;
  minLength: number;
  // Days (0: never).
  maxAge: number;
  minAge: number;
  history: number;
  // 0: never locks.
  threshold: number;
  // Minutes (0: until an administrator unlocks).
  duration: number;
  window: number;
}

export interface Domain {
  dns: string;
  netbios: string;
  sid: string;
  objects: AdObject[];
  // The accounts' passwords, by objectGUID.
  passwords: Record<string, string>;
  policy: DomainPolicy;
  gpos: Gpo[];
  // The domain controller's computer name (DC01) and its address.
  dc: string;
  dcAddress?: string;
  serial: number;
  nextRid: number;
  // The AD Recycle Bin: when it was enabled (null: not enabled), and the objects it holds.
  recycleBin?: number | null;
  deleted?: AdObject[];
  // The domain's workstations with a user logged on (they aren't machines of the game).
  clients?: ClientSession[];
}

/** The domain's distinguished name (DC=school,DC=internal). */
export const domainDn = (dns: string) => dns.split('.').map((p) => `DC=${p}`).join(',');

/** The DN's first value (Alice Martin for CN=Alice Martin,OU=…). */
export const rdnValue = (dn: string) => dn.split(',')[0].replace(/^[^=]+=/, '');
export const parentDn = (dn: string) => dn.split(',').slice(1).join(',');
export const sameDn = (a: string, b: string) => normalise(a) === normalise(b);
/** Is `dn` the base or below it? */
export const below = (dn: string, base: string) => sameDn(dn, base) || normalise(dn).endsWith(`,${normalise(base)}`);

const DEFAULT_POLICY: DomainPolicy = { complexity: true, minLength: 7, maxAge: 42, minAge: 1, history: 24, threshold: 0, duration: 30, window: 30 };

// ——— Where the domain lives ———

/** The domain controller's session (itself, the story's main machine, or the internal host named by the member). */
export function controllerOf(game: Game): Shell | null {
  const sh = game as Shell;
  if (sh.state.ad) return sh;
  const d = sh.state.windows ? windows(sh).domain : undefined;
  if (!d) return null;
  const p = sh.principal;
  if ((p.state.ad as Domain | undefined)?.dns === d.dns) return p;
  const dc = p.internal(d.dc);
  return dc?.state.ad ? dc : null;
}

/** The domain this machine belongs to (or that it serves), with its controller. */
export function domainOf(game: Game): { ad: Domain; dc: Shell } | null {
  const dc = controllerOf(game);
  return dc ? { ad: dc.state.ad as Domain, dc } : null;
}

/** The domain's clock: its controller's. */
export const adClock = (dc: Shell) => windows(dc).clock;

// ——— Identifiers ———

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}

/** The domain's SID, derived from its name. */
export function domainSid(netbios: string): string {
  const parts = [0, 1, 2].map((i) => 1_000_000_000 + (hash(`${netbios.toUpperCase()}#${i}`) % 3_000_000_000));
  return `S-1-5-21-${parts.join('-')}`;
}

/** A deterministic objectGUID (the domain and a counter). */
export function newGuid(ad: Domain): string {
  ad.serial++;
  const hex = (seed: string, len: number) => {
    let out = '';
    let h = hash(seed);
    while (out.length < len) {
      h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0;
      out += h.toString(16).padStart(8, '0');
    }
    return out.slice(0, len);
  };
  const s = `${ad.dns}/${ad.serial}`;
  return `${hex(s, 8)}-${hex(`${s}a`, 4)}-4${hex(`${s}b`, 3)}-a${hex(`${s}c`, 3)}-${hex(`${s}d`, 12)}`;
}

export const sidOf = (ad: Domain, o: AdObject) => (o.rid === undefined ? '' : o.builtin ? `S-1-5-32-${o.rid}` : `${ad.sid}-${o.rid}`);

/** A principal's canonical name (SCHOOL\alice, SCHOOL\Teachers, SCHOOL\FILES$, BUILTIN\Administrators). */
export const accountName = (ad: Domain, o: AdObject) => (o.builtin ? `BUILTIN\\${o.sam ?? o.name}` : `${ad.netbios}\\${o.sam ?? o.name}`);

/** The canonical name (school.internal/Staff/Teachers/Alice Martin). */
export function canonicalName(ad: Domain, dn: string): string {
  const parts = dn.split(',').filter((p) => !/^DC=/i.test(p)).map((p) => p.replace(/^[^=]+=/, '')).reverse();
  return [ad.dns, ...parts].join('/');
}

// ——— Finding objects ———

export const byDn = (ad: Domain, dn: string) => ad.objects.find((o) => sameDn(o.dn, dn));
export const byGuid = (ad: Domain, guid: string) => ad.objects.find((o) => o.guid.toLowerCase() === guid.toLowerCase().replace(/[{}]/g, ''));
export const isPrincipal = (o: AdObject) => o.cls === 'user' || o.cls === 'group' || o.cls === 'computer';

/** An -Identity: a DN, a GUID, a SID or a sAMAccountName (a computer with or without its $). */
export function findIdentity(ad: Domain, typed: string, classes?: AdClass[]): AdObject | undefined {
  const t = typed.trim();
  const ok = (o: AdObject | undefined) => (o && (!classes || classes.includes(o.cls)) ? o : undefined);
  if (/=/.test(t)) return ok(byDn(ad, t));
  if (/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(t)) return ok(byGuid(ad, t));
  if (/^S-1-/i.test(t)) return ok(ad.objects.find((o) => sidOf(ad, o).toUpperCase() === t.toUpperCase()));
  const low = t.toLowerCase();
  return ad.objects.find((o) => (!classes || classes.includes(o.cls)) && isPrincipal(o) && (o.sam?.toLowerCase() === low || (o.cls === 'computer' && o.sam?.toLowerCase() === `${low}$`)));
}

/** An account typed at a logon or in a permission: DOMAIN\name, name@dns, or a bare name. */
export function findAccount(ad: Domain, typed: string): AdObject | undefined {
  const t = typed.trim();
  const upn = /^([^@\\]+)@(.+)$/.exec(t);
  if (upn) return ad.objects.find((o) => o.upn?.toLowerCase() === t.toLowerCase()) ?? (upn[2].toLowerCase() === ad.dns.toLowerCase() ? findIdentity(ad, upn[1]) : undefined);
  const m = /^([^\\]+)\\(.+)$/.exec(t);
  if (m) {
    if (m[1].toLowerCase() === 'builtin') return ad.objects.find((o) => o.builtin && o.name.toLowerCase() === m[2].toLowerCase());
    if (![ad.netbios.toLowerCase(), ad.dns.toLowerCase()].includes(m[1].toLowerCase())) return undefined;
    return findIdentity(ad, m[2]);
  }
  return findIdentity(ad, t);
}

// ——— Groups ———

/** The groups an object is directly a member of (its primary group too). */
export function directGroups(ad: Domain, o: AdObject): AdObject[] {
  return ad.objects.filter((g) => g.cls === 'group' && ((g.members ?? []).some((m) => sameDn(m, o.dn)) || (o.primaryGroup !== undefined && !g.builtin && g.rid === o.primaryGroup)));
}

/** Every group an object reaches, through nested groups. */
export function allGroups(ad: Domain, o: AdObject): AdObject[] {
  const out: AdObject[] = [];
  const queue = [o];
  while (queue.length) {
    const x = queue.shift()!;
    for (const g of directGroups(ad, x))
      if (!out.includes(g)) {
        out.push(g);
        queue.push(g);
      }
  }
  return out;
}

/** A group's members (those whose primary group it is included); -Recursive: the users and computers below its nested groups. */
export function groupMembers(ad: Domain, g: AdObject, recursive = false): AdObject[] {
  const direct = [...(g.members ?? []).map((m) => byDn(ad, m)).filter((x): x is AdObject => !!x), ...ad.objects.filter((o) => !g.builtin && o.primaryGroup !== undefined && o.primaryGroup === g.rid)];
  if (!recursive) return direct;
  const out: AdObject[] = [];
  const seen = new Set<AdObject>();
  const walk = (list: AdObject[]) => {
    for (const x of list) {
      if (seen.has(x)) continue;
      seen.add(x);
      if (x.cls === 'group') walk(groupMembers(ad, x));
      else out.push(x);
    }
  };
  walk(direct);
  return out;
}

// ——— Accounts' state ———

/** Is the account locked out now (the lockout duration passed: no longer)? */
export function lockedOut(ad: Domain, o: AdObject, now: number): boolean {
  if (!o.lockoutTime) return false;
  return ad.policy.duration === 0 || now < o.lockoutTime + ad.policy.duration * MINUTE;
}

/** Does the password expire, and when? */
export function passwordExpiry(ad: Domain, o: AdObject): number | null {
  if (o.neverExpires || !ad.policy.maxAge || !o.passwordLastSet) return null;
  return o.passwordLastSet + ad.policy.maxAge * DAY;
}
export const passwordExpired = (ad: Domain, o: AdObject, now: number) => !!o.mustChange || (passwordExpiry(ad, o) ?? Infinity) < now;
export const accountExpired = (o: AdObject, now: number) => !!o.accountExpires && o.accountExpires < now;

/** The domain's complexity rules: null if accepted (three kinds of characters, the policy's length, not the account's name). */
export function passwordRejected(ad: Domain, o: Pick<AdObject, 'sam' | 'display' | 'name'>, password: string): boolean {
  const p = ad.policy;
  if (password.length < p.minLength) return true;
  if (!p.complexity) return false;
  const kinds = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (kinds < 3) return true;
  const low = password.toLowerCase();
  if (o.sam && o.sam.length >= 3 && low.includes(o.sam.toLowerCase())) return true;
  return (o.display ?? o.name ?? '').split(/[\s,.\-_#]+/).some((part) => part.length >= 3 && low.includes(part.toLowerCase()));
}

/** Sets a password (Set-ADAccountPassword, New-ADUser): when it was set, no longer "must change". */
export function setAdPassword(ad: Domain, o: AdObject, password: string, now: number): void {
  ad.passwords[o.guid] = password;
  o.passwordLastSet = now;
  o.mustChange = false;
  o.modified = now;
}

// ——— Logon ———

export type AdLogonResult = 'ok' | 'unknown' | 'bad-password' | 'locked' | 'disabled' | 'account-expired' | 'password-expired' | 'must-change';

const STATUS: Record<Exclude<AdLogonResult, 'ok'>, [string, string, string]> = {
  unknown: ['Unknown user name or bad password.', '0xC000006D', '0xC0000064'],
  'bad-password': ['Unknown user name or bad password.', '0xC000006D', '0xC000006A'],
  locked: ['Account locked out.', '0xC0000234', '0x0'],
  disabled: ['Account currently disabled.', '0xC000006E', '0xC0000072'],
  'account-expired': ['The specified user account has expired.', '0xC000006E', '0xC0000193'],
  'password-expired': ["The specified account's password has expired.", '0xC000006E', '0xC0000071'],
  'must-change': ["The user's password must be changed before logging on the first time.", '0xC000006E', '0xC0000224'],
};

export interface LogonFrom {
  // The client's address (Source Network Address).
  address: string | null;
  // The computer that asked the domain controller (4740's Caller Computer Name).
  caller: string;
  // 3: network (SMB), 8: network cleartext (OpenSSH with a password).
  type?: number;
}

/**
 * A logon with a domain account, checked by the domain controller: the
 * reason it fails, or 'ok'. A wrong password counts (badPwdCount, reset
 * after the observation window) and locks the account at the threshold
 * (event 4740 on the controller); the machine asked writes 4625 (or 4624).
 * Without a password (a key): only whether the account may log on.
 */
export function adLogon(member: Shell, typed: string, password: string | undefined, from: LogonFrom): AdLogonResult {
  const d = domainOf(member);
  if (!d) return 'unknown';
  const { ad, dc } = d;
  const now = adClock(dc);
  const o = findAccount(ad, typed);
  const user = o && o.cls === 'user' ? o : undefined;
  let result: AdLogonResult;
  if (!user) result = 'unknown';
  else if (lockedOut(ad, user, now)) result = 'locked';
  else if (password !== undefined && ad.passwords[user.guid] !== password) {
    // The counter starts again after the observation window.
    if (user.badPasswordTime && now > user.badPasswordTime + ad.policy.window * MINUTE) user.badPwdCount = 0;
    user.badPwdCount = (user.badPwdCount ?? 0) + 1;
    user.badPasswordTime = now;
    if (ad.policy.threshold > 0 && user.badPwdCount >= ad.policy.threshold) {
      user.lockoutTime = now;
      logEvent(dc, 'Security', {
        id: 4740,
        level: 'Information',
        provider: 'Microsoft-Windows-Security-Auditing',
        keywords: 'Audit Success',
        message: `A user account was locked out.\n\nSubject:\n\tSecurity ID:\t\tSYSTEM\n\tAccount Name:\t\t${ad.dc}$\n\tAccount Domain:\t\t${ad.netbios}\n\tLogon ID:\t\t0x3E7\n\nAccount That Was Locked Out:\n\tSecurity ID:\t\t${sidOf(ad, user)}\n\tAccount Name:\t\t${user.sam}\n\nAdditional Information:\n\tCaller Computer Name:\t${from.caller}`,
      });
    }
    result = 'bad-password';
  } else if (!user.enabled) result = 'disabled';
  else if (accountExpired(user, now)) result = 'account-expired';
  else if (user.mustChange) result = 'must-change';
  else if (passwordExpired(ad, user, now)) result = 'password-expired';
  else result = 'ok';
  if (password === undefined && result !== 'ok') return result;
  const w = windows(member);
  if (result === 'ok') {
    user!.badPwdCount = 0;
    user!.lastLogon = now;
    logEvent(member, 'Security', {
      id: 4624,
      level: 'Information',
      provider: 'Microsoft-Windows-Security-Auditing',
      keywords: 'Audit Success',
      user: accountName(ad, user!),
      message: `An account was successfully logged on.\n\nLogon Information:\n\tLogon Type:\t\t${from.type ?? 8}\n\nNew Logon:\n\tSecurity ID:\t\t${sidOf(ad, user!)}\n\tAccount Name:\t\t${user!.sam}\n\tAccount Domain:\t\t${ad.netbios}\n\nNetwork Information:\n\tWorkstation Name:\t${w.computer}\n\tSource Network Address:\t${from.address ?? '-'}`,
    });
    return 'ok';
  }
  const [reason, status, sub] = STATUS[result];
  const name = user?.sam ?? typed.replace(/^[^\\]*\\/, '').replace(/@.*$/, '');
  logEvent(member, 'Security', {
    id: 4625,
    level: 'Information',
    provider: 'Microsoft-Windows-Security-Auditing',
    keywords: 'Audit Failure',
    message: `An account failed to log on.\n\nLogon Type:\t\t\t${from.type ?? 8}\n\nAccount For Which Logon Failed:\n\tSecurity ID:\t\tNULL SID\n\tAccount Name:\t\t${name}\n\tAccount Domain:\t\t${ad.netbios}\n\nFailure Information:\n\tFailure Reason:\t\t${reason}\n\tStatus:\t\t\t${status}\n\tSub Status:\t\t${sub}\n\nNetwork Information:\n\tWorkstation Name:\t-\n\tSource Network Address:\t${from.address ?? '-'}`,
  });
  return result;
}

// ——— The hooks: domain principals in tokens and permissions, logons ———

/** A domain object as a principal of the machine's permissions. */
function asPrincipal(ad: Domain, o: AdObject): Principal {
  return { name: accountName(ad, o), sid: sidOf(ad, o), kind: o.cls === 'group' ? 'Group' : 'User', source: 'ActiveDirectory' };
}

DOMAIN_HOOKS.principal = (game, domain, name) => {
  const d = domainOf(game);
  if (!d) return null;
  const { ad } = d;
  const typed = domain ? (domain.includes('.') && !name.includes('@') ? `${name}@${domain}` : `${domain}\\${name}`) : name;
  const o = findAccount(ad, typed) ?? (domain ? undefined : findAccount(ad, `${ad.netbios}\\${name}`));
  return o && isPrincipal(o) ? asPrincipal(ad, o) : null;
};
DOMAIN_HOOKS.groups = (game, principalName) => {
  const d = domainOf(game);
  if (!d) return [];
  const o = findAccount(d.ad, principalName);
  if (!o) return [];
  const out = allGroups(d.ad, o).map((g) => accountName(d.ad, g));
  // Every domain account is in Domain Users (or Domain Computers) through its primary group.
  return out;
};
DOMAIN_HOOKS.all = (game) => {
  const d = domainOf(game);
  return d ? d.ad.objects.filter(isPrincipal).map((o) => asPrincipal(d.ad, o)) : [];
};

LOGON_HOOKS.domainResult = (game, account, password, from) => {
  const d = domainOf(game);
  if (!d) return null;
  const known = findAccount(d.ad, account);
  if (!known && !/[\\@]/.test(account)) return null;
  const result = adLogon(game as Shell, account, password, { address: from?.address ?? null, caller: from?.caller ?? windows(game).computer, type: from?.type });
  return { name: known && known.cls === 'user' ? accountName(d.ad, known) : account, result };
};
LOGON_HOOKS.domain = (game, account, password, from) => {
  const d = domainOf(game);
  if (!d) return null;
  const known = findAccount(d.ad, account);
  // A bare name the domain doesn't know: the local accounts decide.
  if (!known && !/[\\@]/.test(account)) return null;
  return adLogon(game as Shell, account, password, { address: from?.address ?? null, caller: from?.caller ?? windows(game).computer, type: from?.type }) === 'ok';
};

// ——— Properties, as the ActiveDirectory module shows them ———

/** A date as an AD integer (FILETIME: 100 ns since 1601), 0 for none. */
export const fileTime = (ms: number | null | undefined) => (ms ? (ms + 11_644_473_600_000) * 10_000 : 0);
const date = (ms: number | null | undefined) => (ms ? new PSDate(ms) : null);

export const USER_DEFAULT = ['DistinguishedName', 'Enabled', 'GivenName', 'Name', 'ObjectClass', 'ObjectGUID', 'SamAccountName', 'SID', 'Surname', 'UserPrincipalName'];
export const GROUP_DEFAULT = ['DistinguishedName', 'GroupCategory', 'GroupScope', 'Name', 'ObjectClass', 'ObjectGUID', 'SamAccountName', 'SID'];
export const COMPUTER_DEFAULT = ['DistinguishedName', 'DNSHostName', 'Enabled', 'Name', 'ObjectClass', 'ObjectGUID', 'SamAccountName', 'SID', 'UserPrincipalName'];
export const OU_DEFAULT = ['City', 'Country', 'DistinguishedName', 'LinkedGroupPolicyObjects', 'ManagedBy', 'Name', 'ObjectClass', 'ObjectGUID', 'PostalCode', 'State', 'StreetAddress'];

/** Every property the game models for an object (-Properties *), by name. */
export function adProperties(ad: Domain, o: AdObject, now: number): Record<string, unknown> {
  const common: Record<string, unknown> = {
    CanonicalName: canonicalName(ad, o.dn),
    CN: o.name,
    Created: new PSDate(o.created),
    Description: o.description ?? null,
    DistinguishedName: o.dn,
    Modified: new PSDate(o.modified),
    Name: o.name,
    ObjectClass: o.cls,
    ObjectGUID: o.guid,
    ProtectedFromAccidentalDeletion: !!o.protected,
    whenChanged: new PSDate(o.modified),
    whenCreated: new PSDate(o.created),
  };
  if (o.deleted) Object.assign(common, { Deleted: true, isDeleted: true, LastKnownParent: o.deleted.parent, 'msDS-LastKnownRDN': o.deleted.name, ...(o.deleted.name === DELETED_OBJECTS ? {} : { Name: `${o.deleted.name}\nDEL:${o.guid}`, CN: `${o.deleted.name}\nDEL:${o.guid}` }) });
  const policyLinks = () => (o.gpLinks ?? []).map((l) => `cn={${l.gpo.toUpperCase()}},cn=policies,cn=system,${domainDn(ad.dns)}`);
  if (o.cls === 'organizationalUnit' || o.cls === 'container' || o.cls === 'domainDNS')
    return { ...common, City: null, Country: null, LinkedGroupPolicyObjects: policyLinks(), ManagedBy: null, PostalCode: null, State: null, StreetAddress: null };
  const principal = {
    ...common,
    MemberOf: directGroups(ad, o).filter((g) => g.rid !== o.primaryGroup || g.builtin).map((g) => g.dn),
    objectSid: sidOf(ad, o),
    SamAccountName: o.sam ?? o.name,
    SID: sidOf(ad, o),
  };
  if (o.cls === 'group')
    return { ...principal, GroupCategory: o.category ?? 'Security', GroupScope: o.scope ?? 'Global', ManagedBy: null, Members: (o.members ?? []).slice(), member: (o.members ?? []).slice() };
  const primary = ad.objects.find((g) => g.cls === 'group' && !g.builtin && g.rid === o.primaryGroup);
  const account = {
    ...principal,
    AccountExpirationDate: date(o.accountExpires),
    accountExpires: o.accountExpires ? fileTime(o.accountExpires) : '9223372036854775807',
    AccountLockoutTime: lockedOut(ad, o, now) ? date(o.lockoutTime) : null,
    BadLogonCount: o.badPwdCount ?? 0,
    badPwdCount: o.badPwdCount ?? 0,
    CannotChangePassword: !!o.cannotChange,
    Enabled: o.enabled !== false,
    LastBadPasswordAttempt: date(o.badPasswordTime),
    LastLogonDate: date(o.lastLogon),
    lastLogonTimestamp: fileTime(o.lastLogon),
    LockedOut: lockedOut(ad, o, now),
    lockoutTime: lockedOut(ad, o, now) ? fileTime(o.lockoutTime) : 0,
    PasswordExpired: passwordExpired(ad, o, now),
    PasswordLastSet: o.mustChange ? null : date(o.passwordLastSet),
    PasswordNeverExpires: !!o.neverExpires,
    pwdLastSet: o.mustChange ? 0 : fileTime(o.passwordLastSet),
    PrimaryGroup: primary?.dn ?? null,
    UserPrincipalName: o.upn ?? null,
  };
  if (o.cls === 'computer')
    return { ...account, DNSHostName: o.dnsHostName ?? null, IPv4Address: o.address ?? null, OperatingSystem: o.os ?? null, OperatingSystemVersion: o.osVersion ?? null };
  return {
    ...account,
    City: null,
    Company: o.company ?? null,
    Department: o.department ?? null,
    DisplayName: o.display ?? null,
    EmailAddress: o.mail ?? null,
    GivenName: o.given ?? null,
    mail: o.mail ?? null,
    Manager: o.manager ?? null,
    Office: o.office ?? null,
    Surname: o.surname ?? null,
    Title: o.title ?? null,
  };
}

/** The LDAP attributes of an object (for -LDAPFilter). */
export function ldapAttributes(ad: Domain, o: AdObject, now: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const put = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return;
    out[k.toLowerCase()] = (Array.isArray(v) ? v : [v]).map(String);
  };
  const classes: Record<AdClass, string[]> = {
    user: ['top', 'person', 'organizationalPerson', 'user'],
    computer: ['top', 'person', 'organizationalPerson', 'user', 'computer'],
    group: ['top', 'group'],
    organizationalUnit: ['top', 'organizationalUnit'],
    container: ['top', 'container'],
    domainDNS: ['top', 'domain', 'domainDNS'],
    builtinDomain: ['top', 'builtinDomain'],
  };
  put('objectClass', classes[o.cls]);
  if (o.deleted) {
    put('isDeleted', 'TRUE');
    put('lastKnownParent', o.deleted.parent);
  }
  put('objectCategory', o.cls === 'user' ? 'person' : o.cls);
  put('distinguishedName', o.dn);
  put(o.cls === 'organizationalUnit' ? 'ou' : 'cn', o.name);
  put('name', o.name);
  put('sAMAccountName', o.sam);
  put('userPrincipalName', o.upn);
  put('givenName', o.given);
  put('sn', o.surname);
  put('displayName', o.display);
  put('description', o.description);
  put('department', o.department);
  put('title', o.title);
  put('physicalDeliveryOfficeName', o.office);
  put('company', o.company);
  put('mail', o.mail);
  put('manager', o.manager);
  put('member', o.members);
  put('memberOf', directGroups(ad, o).filter((g) => g.rid !== o.primaryGroup || g.builtin).map((g) => g.dn));
  put('dNSHostName', o.dnsHostName);
  put('operatingSystem', o.os);
  if (o.cls === 'user' || o.cls === 'computer') {
    // userAccountControl: 2 disabled, 512 normal account, 4096 workstation trust, 65536 password never expires.
    put('userAccountControl', (o.cls === 'computer' ? 4096 : 512) + (o.enabled === false ? 2 : 0) + (o.neverExpires ? 65536 : 0));
    put('lockoutTime', lockedOut(ad, o, now) ? fileTime(o.lockoutTime) : 0);
    put('badPwdCount', o.badPwdCount ?? 0);
    if (o.lastLogon) put('lastLogonTimestamp', fileTime(o.lastLogon));
  }
  return out;
}

/** An LDAP filter (RFC 4515, ldap.ts) against the domain's objects; null if it doesn't parse. */
export function ldapMatch(ad: Domain, filter: string, now: number): ((o: AdObject) => boolean) | null {
  // The bitwise matching rule (userAccountControl:1.2.840.113556.1.4.803:=2) as a plain test.
  const bits: { attr: string; value: number }[] = [];
  const plain = filter.replace(/\(([A-Za-z]+):1\.2\.840\.113556\.1\.4\.80[34]:=(\d+)\)/g, (_m, attr: string, value: string) => {
    bits.push({ attr: attr.toLowerCase(), value: Number(value) });
    return `(${attr}=*)`;
  });
  const f = readFilter(plain);
  if (!f) return null;
  return (o) => {
    const attrs = ldapAttributes(ad, o, now);
    if (!correspond(f, { dn: o.dn, attrs })) return false;
    return bits.every((b) => (Number(attrs[b.attr]?.[0] ?? 0) & b.value) === b.value);
  };
}

// ——— -Filter: the PowerShell Expression Language of the ActiveDirectory module ———

export class AdFilterError {
  constructor(
    public message: string,
    public position: number,
  ) {}
}

type FilterNode = { and: FilterNode[] } | { or: FilterNode[] } | { not: FilterNode } | { all: true } | { prop: string; op: string; value: unknown };

const FILTER_OPS = ['eq', 'ne', 'like', 'notlike', 'gt', 'ge', 'lt', 'le', 'approx', 'band', 'bor', 'recursivematch'];

/**
 * Parses -Filter's text: comparisons (Property -op value) joined with -and,
 * -or, -not and parentheses; '*' for every object. Values: quoted strings,
 * numbers, $true/$false/$null, $variables (and $var.Property), read from
 * the caller's scope by `variable`.
 */
export function parseAdFilter(source: string, variable: (name: string) => unknown): FilterNode {
  const s = source.trim();
  let i = 0;
  const ws = () => {
    while (/\s/.test(s[i] ?? '')) i++;
  };
  const fail = (message: string): never => {
    throw new AdFilterError(message, i);
  };
  const value = (): unknown => {
    ws();
    const c = s[i];
    if (c === "'" || c === '"') {
      const end = s.indexOf(c, i + 1);
      if (end < 0) fail('Unterminated string');
      const v = s.slice(i + 1, end);
      i = end + 1;
      return v;
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][\w:]*)((?:\.\w+)*)/.exec(s.slice(i))!;
      if (!m) fail('Syntax error');
      i += m[0].length;
      let v = variable(m[1]);
      for (const p of m[2].split('.').filter(Boolean)) v = v && typeof v === 'object' && 'props' in (v as object) ? (v as { props: Record<string, unknown> }).props[Object.keys((v as { props: Record<string, unknown> }).props).find((k) => k.toLowerCase() === p.toLowerCase()) ?? p] : undefined;
      return v;
    }
    const m = /^[^\s()]+/.exec(s.slice(i));
    if (!m) fail('Syntax error');
    i += m![0].length;
    return /^-?\d+(\.\d+)?$/.test(m![0]) ? Number(m![0]) : m![0];
  };
  const primary = (): FilterNode => {
    ws();
    if (s[i] === '(') {
      i++;
      const e = or();
      ws();
      if (s[i] !== ')') fail('Missing closing parenthesis');
      i++;
      return e;
    }
    if (/^-not\b/i.test(s.slice(i))) {
      i += 4;
      return { not: primary() };
    }
    if (s[i] === '*') {
      i++;
      return { all: true };
    }
    const prop = /^[A-Za-z][\w-]*/.exec(s.slice(i));
    if (!prop) fail('Syntax error');
    i += prop![0].length;
    ws();
    const op = /^-([A-Za-z]+)/.exec(s.slice(i));
    if (!op) fail(`Operator Not supported: ${s.slice(i).split(/\s/)[0] || '(none)'}`);
    if (!FILTER_OPS.includes(op![1].toLowerCase())) fail(`Operator Not supported: ${op![0]}`);
    i += op![0].length;
    return { prop: prop![0], op: op![1].toLowerCase(), value: value() };
  };
  const and = (): FilterNode => {
    const items = [primary()];
    for (;;) {
      ws();
      if (!/^-and\b/i.test(s.slice(i))) break;
      i += 4;
      items.push(primary());
    }
    return items.length === 1 ? items[0] : { and: items };
  };
  const or = (): FilterNode => {
    const items = [and()];
    for (;;) {
      ws();
      if (!/^-or\b/i.test(s.slice(i))) break;
      i += 3;
      items.push(and());
    }
    return items.length === 1 ? items[0] : { or: items };
  };
  const out = or();
  ws();
  if (i < s.length) fail(`Syntax error`);
  return out;
}

/** Does an object match a parsed -Filter? (Properties compared without case; dates as dates.) */
export function filterMatches(node: FilterNode, props: Record<string, unknown>): boolean {
  if ('all' in node) return true;
  if ('and' in node) return node.and.every((n) => filterMatches(n, props));
  if ('or' in node) return node.or.some((n) => filterMatches(n, props));
  if ('not' in node) return !filterMatches(node.not, props);
  const key = Object.keys(props).find((k) => k.toLowerCase() === node.prop.toLowerCase());
  const raw = key === undefined ? undefined : props[key];
  const values = Array.isArray(raw) ? raw : [raw];
  const want = node.value;
  const num = (x: unknown): number | null => (x instanceof PSDate ? x.ms : typeof x === 'number' ? x : typeof x === 'boolean' ? Number(x) : x !== null && x !== undefined && /^-?\d+(\.\d+)?$/.test(String(x)) ? Number(x) : null);
  const asDate = (x: unknown) => (x instanceof PSDate ? x.ms : typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? Date.parse(x) : null);
  const one = (v: unknown): boolean => {
    const text = v === null || v === undefined ? '' : v instanceof PSDate ? String(v.ms) : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
    const w = want === null || want === undefined ? '' : typeof want === 'boolean' ? (want ? 'true' : 'false') : want instanceof PSDate ? String(want.ms) : String(want);
    switch (node.op) {
      case 'eq':
      case 'approx':
        return v instanceof PSDate ? v.ms === asDate(want) : text.toLowerCase() === w.toLowerCase();
      case 'ne':
        return text.toLowerCase() !== w.toLowerCase();
      case 'like':
        return v !== null && v !== undefined && wildcard(w).test(text);
      case 'notlike':
        return !(v !== null && v !== undefined && wildcard(w).test(text));
      case 'band':
        return ((num(v) ?? 0) & (num(want) ?? 0)) !== 0;
      case 'bor':
        return ((num(v) ?? 0) | (num(want) ?? 0)) !== 0;
      case 'recursivematch':
        return text.toLowerCase() === w.toLowerCase();
    }
    const a = v instanceof PSDate ? v.ms : num(v);
    const b = v instanceof PSDate ? asDate(want) : num(want);
    if (a === null || b === null) {
      if (v === null || v === undefined) return false;
      const c = text.toLowerCase().localeCompare(w.toLowerCase());
      return node.op === 'gt' ? c > 0 : node.op === 'ge' ? c >= 0 : node.op === 'lt' ? c < 0 : c <= 0;
    }
    return node.op === 'gt' ? a > b : node.op === 'ge' ? a >= b : node.op === 'lt' ? a < b : a <= b;
  };
  if (node.op === 'notlike' || node.op === 'ne') return values.every(one);
  return values.some(one);
}

// ——— Changes ———

/** Creates an object in the domain (its GUID, its RID for a principal, its dates). */
export function addObject(ad: Domain, o: Omit<AdObject, 'guid' | 'created' | 'modified'>, now: number): AdObject {
  const made: AdObject = { ...o, guid: newGuid(ad), created: now, modified: now };
  if ((o.cls === 'user' || o.cls === 'group' || o.cls === 'computer') && o.rid === undefined) made.rid = ad.nextRid++;
  ad.objects.push(made);
  return made;
}

/** Renames the DNs below an object that moved (Move-ADObject), in members and managers too. */
export function moveObject(ad: Domain, o: AdObject, target: string, now: number): void {
  const old = o.dn;
  const fresh = `${o.dn.split(',')[0]},${target}`;
  for (const x of ad.objects) {
    if (below(x.dn, old)) x.dn = `${x.dn.slice(0, x.dn.length - old.length)}${fresh}`;
    if (x.members) x.members = x.members.map((m) => (below(m, old) ? `${m.slice(0, m.length - old.length)}${fresh}` : m));
    if (x.manager && below(x.manager, old)) x.manager = `${x.manager.slice(0, x.manager.length - old.length)}${fresh}`;
  }
  o.modified = now;
}

/**
 * Removes an object and what is below it (and the references to them in
 * groups). With the AD Recycle Bin enabled, each goes to CN=Deleted
 * Objects with its attributes, its password and the groups it was in (the
 * link values are kept): Restore-ADObject brings it back as it was.
 */
export function removeObject(ad: Domain, o: AdObject, now = o.modified): void {
  const gone = ad.objects.filter((x) => below(x.dn, o.dn));
  const old = gone.map((x) => x.dn);
  if (ad.recycleBin) {
    const bin = (ad.deleted ??= []);
    for (const x of gone) {
      const groups = ad.objects.filter((g) => g.cls === 'group' && (g.members ?? []).some((m) => sameDn(m, x.dn))).map((g) => g.dn);
      x.deleted = { parent: parentDn(x.dn), at: now, name: x.name, groups };
      x.dn = `${x.cls === 'organizationalUnit' ? 'OU' : 'CN'}=${x.name}\\0ADEL:${x.guid},CN=Deleted Objects,${domainDn(ad.dns)}`;
      x.modified = now;
      bin.push(x);
    }
  } else for (const x of gone) delete ad.passwords[x.guid];
  ad.objects = ad.objects.filter((x) => !gone.includes(x));
  for (const x of ad.objects) if (x.members) x.members = x.members.filter((m) => !old.some((d) => sameDn(m, d)));
}

export const DELETED_OBJECTS = 'Deleted Objects';

/** CN=Deleted Objects (itself marked deleted): Get-ADObject -IncludeDeletedObjects finds it. */
export function deletedObjectsContainer(ad: Domain): AdObject {
  const base = domainDn(ad.dns);
  const domain = byDn(ad, base)!;
  return { dn: `CN=${DELETED_OBJECTS},${base}`, cls: 'container', name: DELETED_OBJECTS, guid: `${domain.guid.slice(0, 24)}d3e1ed0b1ec5`, created: domain.created, modified: domain.created, description: 'Default container for deleted objects', deleted: { parent: base, at: domain.created, name: DELETED_OBJECTS, groups: [] } };
}

/** The DN an object of the Recycle Bin had. */
export const formerDn = (o: AdObject) => (o.deleted ? `${o.dn.split(',')[0].replace(/\\0ADEL:.*$/, '')},${o.deleted.parent}` : o.dn);

/** A deleted object, by its GUID or its DN in CN=Deleted Objects (or its former DN). */
export function findDeleted(ad: Domain, typed: string): AdObject | undefined {
  const t = typed.trim().replace(/[{}]/g, '');
  return (ad.deleted ?? []).find((o) => o.guid.toLowerCase() === t.toLowerCase() || sameDn(o.dn, t) || sameDn(formerDn(o), t) || o.sam?.toLowerCase() === t.toLowerCase());
}

/**
 * Restore-ADObject: the object back where it was (or under `target`), with
 * its SID, its password and its groups; an error's text if its parent is
 * gone or the name is taken.
 */
export function restoreObject(ad: Domain, o: AdObject, now: number, target?: string, newName?: string): string | null {
  if (!o.deleted) return 'Illegal modify operation. Some aspect of the modification is not permitted';
  const parent = target ?? o.deleted.parent;
  if (!byDn(ad, parent)) return "The operation could not be performed because the object's parent is either uninstantiated or deleted";
  const name = newName ?? o.deleted.name;
  const dn = `${o.cls === 'organizationalUnit' ? 'OU' : 'CN'}=${name},${parent}`;
  if (byDn(ad, dn)) return 'An attempt was made to add an object to the directory with a name that is already in use';
  if (o.sam && ad.objects.some((x) => x.sam?.toLowerCase() === o.sam!.toLowerCase())) return 'The specified account already exists';
  const groups = o.deleted.groups;
  ad.deleted = (ad.deleted ?? []).filter((x) => x !== o);
  o.dn = dn;
  o.name = name;
  o.modified = now;
  delete o.deleted;
  ad.objects.push(o);
  // The link values the Recycle Bin kept: back in the groups that still exist.
  for (const g of groups) {
    const group = byDn(ad, g);
    if (group && !(group.members ?? []).some((m) => sameDn(m, dn))) (group.members ??= []).push(dn);
  }
  return null;
}

// ——— Building a domain (a story declares it) ———

export interface AdUserSpec {
  sam: string;
  given?: string;
  surname?: string;
  // The CN (by default "Given Surname", or the account's name).
  name?: string;
  // Its OU as a path from the domain ('Staff/Teachers'); CN=Users by default.
  ou?: string;
  password: string;
  enabled?: boolean;
  description?: string;
  department?: string;
  title?: string;
  office?: string;
  // The manager's sAMAccountName.
  manager?: string;
  groups?: string[];
  neverExpires?: boolean;
  // How long ago the password was set, and the last logon (days; null: never).
  passwordAge?: number;
  lastLogon?: number | null;
  mustChange?: boolean;
  // When the account expires (ms).
  accountExpires?: number;
  badPwdCount?: number;
}
export interface AdGroupSpec {
  name: string;
  ou?: string;
  scope?: AdObject['scope'];
  category?: AdObject['category'];
  description?: string;
  // sAMAccountNames of users, computers (NAME$) or groups.
  members?: string[];
}
export interface GpoSpec {
  name: string;
  description?: string;
  settings?: GpoSetting[];
  // Where it is linked: a DN, or an OU path ('Staff/Teachers'), or '' for the domain; first: link order 1.
  links?: { target: string; enabled?: boolean; enforced?: boolean }[];
  // Security filtering: who gets Apply Group Policy (Authenticated Users by default).
  apply?: string[];
  status?: Gpo['status'];
}
export interface DomainSpec {
  dns: string;
  netbios: string;
  // The domain controller's computer name (DC01) and address.
  dc: string;
  dcAddress?: string;
  ous?: { path: string; description?: string; protected?: boolean; blockInheritance?: boolean }[];
  users?: AdUserSpec[];
  groups?: AdGroupSpec[];
  computers?: { name: string; ou?: string; os?: string; address?: string; enabled?: boolean }[];
  gpos?: GpoSpec[];
  policy?: Partial<DomainPolicy>;
  // The player's account in the domain (a Domain Admin) and its password.
  player?: { sam: string; password: string; given?: string; surname?: string; ou?: string };
  // The AD Recycle Bin enabled (days before the clock).
  recycleBin?: number;
  // Workstations (computers of the spec) with a user logged on since `logon` (ms).
  sessions?: { computer: string; user: string; logon: number }[];
}

/** An OU path ('Staff/Teachers') as a DN under the domain; a DN stays as it is; '' is the domain. */
export function ouDn(dns: string, path: string | undefined, fallback = `CN=Users,${domainDn(dns)}`): string {
  if (path === undefined) return fallback;
  if (path === '') return domainDn(dns);
  if (path.includes('=')) return path;
  return [...path.split('/').reverse().map((p) => `OU=${p}`), domainDn(dns)].join(',');
}

export const DEFAULT_DOMAIN_POLICY_ID = '31b2f340-016d-11d2-945f-00c04fb984f9';
export const DEFAULT_DC_POLICY_ID = '6ac1786c-016f-11d2-945f-00c04fb984f9';

/** The default permissions of a GPO: Authenticated Users apply it, the admins edit it. */
export const defaultGpoPermissions = (netbios: string): GpoPermission[] => [
  { trustee: 'NT AUTHORITY\\Authenticated Users', permission: 'GpoApply' },
  { trustee: `${netbios}\\Domain Admins`, permission: 'GpoEditDeleteModifySecurity' },
  { trustee: `${netbios}\\Enterprise Admins`, permission: 'GpoEditDeleteModifySecurity' },
  { trustee: 'NT AUTHORITY\\ENTERPRISE DOMAIN CONTROLLERS', permission: 'GpoRead' },
  { trustee: 'NT AUTHORITY\\SYSTEM', permission: 'GpoEditDeleteModifySecurity' },
];

/** A domain as a story declares it, with its default containers, groups, accounts and GPOs. */
export function buildDomain(spec: DomainSpec, clock: number): Domain {
  const base = domainDn(spec.dns);
  const created = clock - 400 * DAY;
  const ad: Domain = { dns: spec.dns, netbios: spec.netbios.toUpperCase(), sid: domainSid(spec.netbios), objects: [], passwords: {}, policy: { ...DEFAULT_POLICY, ...spec.policy }, gpos: [], dc: spec.dc.toUpperCase(), dcAddress: spec.dcAddress, serial: 0, nextRid: 1103, recycleBin: spec.recycleBin !== undefined ? clock - spec.recycleBin * DAY : null, deleted: [], clients: (spec.sessions ?? []).map((x) => ({ computer: x.computer.toUpperCase(), user: x.user, logon: x.logon })) };
  const add = (o: Omit<AdObject, 'guid' | 'created' | 'modified'>) => addObject(ad, o, created);
  add({ dn: base, cls: 'domainDNS', name: spec.dns.split('.')[0] });
  add({ dn: `CN=Builtin,${base}`, cls: 'builtinDomain', name: 'Builtin' });
  add({ dn: `CN=Users,${base}`, cls: 'container', name: 'Users', description: 'Default container for upgraded user accounts' });
  add({ dn: `CN=Computers,${base}`, cls: 'container', name: 'Computers', description: 'Default container for upgraded computer accounts' });
  add({ dn: `OU=Domain Controllers,${base}`, cls: 'organizationalUnit', name: 'Domain Controllers', description: 'Default container for domain controllers', protected: true });
  const users = `CN=Users,${base}`;
  const group = (name: string, rid: number, scope: AdObject['scope'], description: string, builtin = false) =>
    add({ dn: `CN=${name},${builtin ? `CN=Builtin,${base}` : users}`, cls: 'group', name, sam: name, rid, builtin, scope, category: 'Security', description, members: [] });
  const admins = group('Domain Admins', 512, 'Global', 'Designated administrators of the domain');
  group('Domain Users', 513, 'Global', 'All domain users');
  group('Domain Guests', 514, 'Global', 'All domain guests');
  group('Domain Computers', 515, 'Global', 'All workstations and servers joined to the domain');
  group('Domain Controllers', 516, 'Global', 'All domain controllers in the domain');
  group('Cert Publishers', 517, 'DomainLocal', 'Members of this group are permitted to publish certificates to the directory');
  const schema = group('Schema Admins', 518, 'Universal', 'Designated administrators of the schema');
  const enterprise = group('Enterprise Admins', 519, 'Universal', 'Designated administrators of the enterprise');
  group('Group Policy Creator Owners', 520, 'Global', 'Members in this group can modify group policy for the domain');
  group('Protected Users', 525, 'Global', 'Members of this group are afforded additional protections against authentication security threats.');
  group('DnsAdmins', 1101, 'DomainLocal', 'DNS Administrators Group');
  group('DnsUpdateProxy', 1102, 'Global', 'DNS clients who are permitted to perform dynamic updates on behalf of some other clients (such as DHCP servers).');
  const bAdmins = group('Administrators', 544, 'DomainLocal', 'Administrators have complete and unrestricted access to the computer/domain', true);
  const bUsers = group('Users', 545, 'DomainLocal', 'Users are prevented from making accidental or intentional system-wide changes and can run most applications', true);
  group('Guests', 546, 'DomainLocal', 'Guests have the same access as members of the Users group by default, except for the Guest account which is further restricted', true);
  group('Account Operators', 548, 'DomainLocal', 'Members can administer domain user and group accounts', true);
  group('Server Operators', 549, 'DomainLocal', 'Members can administer domain servers', true);
  group('Print Operators', 550, 'DomainLocal', 'Members can administer printers installed on domain controllers', true);
  group('Backup Operators', 551, 'DomainLocal', 'Backup Operators can override security restrictions for the sole purpose of backing up or restoring files', true);
  group('Remote Desktop Users', 555, 'DomainLocal', 'Members in this group are granted the right to logon remotely', true);
  const userObject = (u: AdUserSpec, rid?: number) => {
    const name = u.name ?? ([u.given, u.surname].filter(Boolean).join(' ') || u.sam);
    const o = add({
      dn: `CN=${name},${ouDn(spec.dns, u.ou)}`,
      cls: 'user',
      name,
      sam: u.sam,
      ...(rid !== undefined ? { rid } : {}),
      upn: `${u.sam}@${spec.dns}`,
      given: u.given,
      surname: u.surname,
      display: u.given || u.surname ? name : undefined,
      enabled: u.enabled ?? true,
      description: u.description,
      department: u.department,
      title: u.title,
      office: u.office,
      neverExpires: u.neverExpires,
      mustChange: u.mustChange,
      accountExpires: u.accountExpires ?? null,
      passwordLastSet: clock - (u.passwordAge ?? 20) * DAY,
      lastLogon: u.lastLogon === null ? null : clock - (u.lastLogon ?? 1) * DAY,
      badPwdCount: u.badPwdCount ?? 0,
      primaryGroup: 513,
    });
    ad.passwords[o.guid] = u.password;
    return o;
  };
  const administrator = userObject({ sam: 'Administrator', name: 'Administrator', password: `${spec.player?.password ?? 'Admin'}!`, description: 'Built-in account for administering the computer/domain', neverExpires: true, passwordAge: 400 }, 500);
  administrator.display = undefined;
  administrator.upn = undefined;
  const guest = userObject({ sam: 'Guest', name: 'Guest', password: '', enabled: false, description: 'Built-in account for guest access to the computer/domain', neverExpires: true, lastLogon: null }, 501);
  guest.upn = undefined;
  guest.primaryGroup = 514;
  const krbtgt = userObject({ sam: 'krbtgt', name: 'krbtgt', password: 'krbtgt', enabled: false, description: 'Key Distribution Center Service Account', lastLogon: null, passwordAge: 400 }, 502);
  krbtgt.upn = undefined;
  for (const g of [admins, enterprise, schema]) g.members!.push(administrator.dn);
  bAdmins.members!.push(administrator.dn, admins.dn, enterprise.dn);
  bUsers.members!.push(`CN=Domain Users,${users}`);
  // Organizational units, parents first.
  for (const ou of [...(spec.ous ?? [])].sort((a, b) => a.path.split('/').length - b.path.split('/').length))
    add({ dn: ouDn(spec.dns, ou.path), cls: 'organizationalUnit', name: ou.path.split('/').at(-1)!, description: ou.description, protected: ou.protected ?? true, blockInheritance: ou.blockInheritance });
  // Computers: the domain controller, then the members.
  add({ dn: `CN=${ad.dc},OU=Domain Controllers,${base}`, cls: 'computer', name: ad.dc, sam: `${ad.dc}$`, enabled: true, dnsHostName: `${ad.dc.toLowerCase()}.${spec.dns}`, os: 'Windows Server 2022 Standard', osVersion: '10.0 (20348)', address: spec.dcAddress, primaryGroup: 516, passwordLastSet: clock - 20 * DAY, lastLogon: clock - DAY });
  for (const c of spec.computers ?? [])
    add({ dn: `CN=${c.name.toUpperCase()},${ouDn(spec.dns, c.ou, `CN=Computers,${base}`)}`, cls: 'computer', name: c.name.toUpperCase(), sam: `${c.name.toUpperCase()}$`, enabled: c.enabled ?? true, dnsHostName: `${c.name.toLowerCase()}.${spec.dns}`, os: c.os ?? 'Windows Server 2022 Standard', osVersion: '10.0 (20348)', address: c.address, primaryGroup: 515, passwordLastSet: clock - 20 * DAY, lastLogon: clock - DAY });
  // The player: a domain administrator.
  if (spec.player && !(spec.users ?? []).some((u) => u.sam.toLowerCase() === spec.player!.sam.toLowerCase())) {
    const p = spec.player;
    const me = userObject({ sam: p.sam, given: p.given, surname: p.surname, name: p.given || p.surname ? undefined : p.sam, ou: p.ou, password: p.password, passwordAge: 10 });
    admins.members!.push(me.dn);
  }
  for (const u of spec.users ?? []) userObject(u);
  for (const g of spec.groups ?? [])
    add({ dn: `CN=${g.name},${ouDn(spec.dns, g.ou)}`, cls: 'group', name: g.name, sam: g.name, scope: g.scope ?? 'Global', category: g.category ?? 'Security', description: g.description, members: [] });
  // Members, once everything exists.
  const dnOf = (sam: string) => findIdentity(ad, sam)?.dn;
  for (const g of spec.groups ?? []) {
    const o = findIdentity(ad, g.name, ['group'])!;
    for (const m of g.members ?? []) {
      const dn = dnOf(m);
      if (dn && !o.members!.includes(dn)) o.members!.push(dn);
    }
  }
  for (const u of spec.users ?? []) {
    const o = findIdentity(ad, u.sam, ['user'])!;
    for (const g of u.groups ?? []) {
      const grp = findIdentity(ad, g, ['group']) ?? ad.objects.find((x) => x.cls === 'group' && x.name.toLowerCase() === g.toLowerCase());
      if (grp && !grp.members!.includes(o.dn)) grp.members!.push(o.dn);
    }
    if (u.manager) o.manager = dnOf(u.manager);
  }
  // The default GPOs, then the story's.
  const gpo = (id: string, name: string, settings: GpoSetting[], status: Gpo['status'] = 'AllSettingsEnabled', description = ''): Gpo => {
    const g: Gpo = { id, name, description, owner: `${ad.netbios}\\Domain Admins`, created, modified: created, status, userVersion: settings.some((s) => settingSide(s) === 'user') ? 1 : 0, computerVersion: settings.some((s) => settingSide(s) === 'computer') ? 3 : 1, settings, permissions: defaultGpoPermissions(ad.netbios) };
    ad.gpos.push(g);
    return g;
  };
  const policy = ad.policy;
  gpo(DEFAULT_DOMAIN_POLICY_ID, 'Default Domain Policy', [
    { kind: 'passwordPolicy', minLength: policy.minLength, maxAge: policy.maxAge, complexity: policy.complexity, history: policy.history },
    { kind: 'lockoutPolicy', threshold: policy.threshold, duration: policy.duration, window: policy.window },
  ]);
  gpo(DEFAULT_DC_POLICY_ID, 'Default Domain Controllers Policy', [{ kind: 'userRight', right: 'SeInteractiveLogonRight', accounts: ['BUILTIN\\Administrators', 'BUILTIN\\Backup Operators', 'BUILTIN\\Server Operators'] }]);
  byDn(ad, base)!.gpLinks = [{ gpo: DEFAULT_DOMAIN_POLICY_ID, enabled: true, enforced: false }];
  byDn(ad, `OU=Domain Controllers,${base}`)!.gpLinks = [{ gpo: DEFAULT_DC_POLICY_ID, enabled: true, enforced: false }];
  for (const [k, g] of (spec.gpos ?? []).entries()) {
    const id = newGuid(ad);
    const made = gpo(id, g.name, g.settings ?? [], g.status, g.description ?? '');
    made.created = made.modified = clock - (30 - k) * DAY;
    if (g.apply) {
      made.permissions = made.permissions.map((p) => (p.trustee === 'NT AUTHORITY\\Authenticated Users' ? { ...p, permission: 'GpoRead' } : p));
      for (const a of g.apply) made.permissions.push({ trustee: a.includes('\\') ? a : `${ad.netbios}\\${a}`, permission: 'GpoApply' });
    }
    for (const l of g.links ?? []) {
      const target = byDn(ad, ouDn(spec.dns, l.target));
      if (target) (target.gpLinks ??= []).push({ gpo: id, enabled: l.enabled ?? true, enforced: l.enforced ?? false });
    }
  }
  return ad;
}

/** The DN of the machine's own computer object. */
export function computerObject(game: Game): AdObject | undefined {
  const d = domainOf(game);
  if (!d) return undefined;
  return findIdentity(d.ad, `${windows(game).computer}$`, ['computer']);
}

/** "11/20/2029 9:00:00 AM" for an AD date. */
export const adDate = (ms: number) => longDate(ms);
