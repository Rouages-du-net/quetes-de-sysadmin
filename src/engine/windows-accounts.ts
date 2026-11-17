// Local users and groups of a Windows machine (no domain: Active Directory
// is a later story), and the logon of an OpenSSH session.
//   - a user: name, full name, description, enabled, RID (500 for
//     Administrator, 1000 and up for the others), when its password was set
//     and when it expires (the local policy's maximum age, 42 days by
//     default, unless "password never expires"), last logon; its password
//     is in state.windows.passwords (SMB, ssh, services and tasks read it);
//   - a group: built-in (BUILTIN\Administrators, Users…) or local
//     (CABINET\Accountants), its members as identities;
//   - the password policy: complexity (three of four kinds of characters,
//     not the account's name, six characters at least) and minimum length;
//   - the game's Linux accounts (Shell.accounts) follow, so that ssh, the
//     keys of administrators and groupsFor keep working.
// Sources (Microsoft Learn): Microsoft.PowerShell.LocalAccounts
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/?view=powershell-5.1),
// "Password must meet complexity requirements"
// (https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/password-must-meet-complexity-requirements),
// "Maximum password age" (42 days by default), net user
// (https://learn.microsoft.com/windows-server/administration/windows-commands/net-user),
// "Well-known SIDs" (https://learn.microsoft.com/windows/win32/secauthz/well-known-sids).

import type { Game, Shell } from './shell';
import { windows, CMD_BANNER, POWERSHELL_BANNER, type Windows } from './windows';
import { canonical, principal } from './windows-acl';
import { registryValue } from './windows-registry';

export interface WinUser {
  name: string;
  fullName: string;
  description: string;
  enabled: boolean;
  rid: number;
  passwordLastSet: number | null;
  neverExpires?: boolean;
  mayChange?: boolean;
  lastLogon: number | null;
}
export interface WinGroup {
  name: string;
  description: string;
  rid: number;
  builtin?: boolean;
  members: string[];
}

const DAY = 86_400_000;

export const BUILTIN_GROUPS: [string, number, string][] = [
  ['Administrators', 544, 'Administrators have complete and unrestricted access to the computer/domain'],
  ['Backup Operators', 551, 'Backup Operators can override security restrictions for the sole purpose of backing up or restoring files'],
  ['Event Log Readers', 573, 'Members of this group can read event logs from local machine'],
  ['Guests', 546, 'Guests have the same access as members of the Users group by default, except for the Guest account which is further restricted'],
  ['Remote Desktop Users', 555, 'Members in this group are granted the right to logon remotely'],
  ['Remote Management Users', 580, 'Members of this group can access WMI resources over management protocols (such as WS-Management via the Windows Remote Management service). This applies only to WMI namespaces that grant access to the user.'],
  ['Users', 545, 'Users are prevented from making accidental or intentional system-wide changes and can run most applications'],
];

export const BUILTIN_USERS: [string, number, string, boolean][] = [
  ['Administrator', 500, 'Built-in account for administering the computer/domain', true],
  ['DefaultAccount', 503, 'A user account managed by the system.', false],
  ['Guest', 501, 'Built-in account for guest access to the computer/domain', false],
  ['WDAGUtilityAccount', 504, 'A user account managed and used by the system for Windows Defender Application Guard scenarios.', false],
];

/** The machine's users (built from the Linux-style accounts the first time, for story 30's cabinet). */
export function users(game: Game): Record<string, WinUser> {
  const w = windows(game);
  if (!w.users) {
    const out: Record<string, WinUser> = {};
    for (const [name, rid, description, enabled] of BUILTIN_USERS)
      out[name] = { name, fullName: '', description, enabled: enabled && !!game.accounts.users[name], rid, passwordLastSet: name === 'Administrator' ? w.clock - 60 * DAY : null, neverExpires: name !== 'Administrator', lastLogon: null };
    let rid = 1000;
    for (const name of Object.keys(game.accounts.users)) if (!out[name]) out[name] = { name, fullName: '', description: '', enabled: true, rid: rid++, passwordLastSet: w.clock - 30 * DAY, lastLogon: null };
    w.users = out;
  }
  return w.users as Record<string, WinUser>;
}

/** The machine's groups (built from the accounts the first time). */
export function groups(game: Game): Record<string, WinGroup> {
  const w = windows(game);
  if (!w.groups) {
    const out: Record<string, WinGroup> = {};
    for (const [name, rid, description] of BUILTIN_GROUPS) {
      const members = (game.accounts.groups[name]?.members ?? []).map((m) => `${w.computer}\\${m}`);
      if (name === 'Users') members.unshift('NT AUTHORITY\\Authenticated Users', 'NT AUTHORITY\\INTERACTIVE');
      out[name] = { name, description, rid, builtin: true, members };
    }
    let rid = 1100;
    for (const [name, g] of Object.entries(game.accounts.groups)) if (!out[name]) out[name] = { name, description: '', rid: rid++, members: g.members.map((m) => `${w.computer}\\${m}`) };
    w.groups = out;
  }
  return w.groups as Record<string, WinGroup>;
}

/** Makes sure both tables exist (identities resolve against them). */
export function ensureAccounts(game: Game): void {
  users(game);
  groups(game);
}

/** A user by name, without case (alice, .\alice, CABINET\alice). */
export function findUser(game: Game, typed: string): WinUser | undefined {
  ensureAccounts(game);
  const w = windows(game);
  const m = /^(?:(\.|[^\\]+)\\)?(.+)$/.exec(typed.trim())!;
  if (m[1] && m[1] !== '.' && m[1].toLowerCase() !== w.computer.toLowerCase()) return undefined;
  return Object.values(users(game)).find((u) => u.name.toLowerCase() === m[2].toLowerCase());
}

/** A group by name, without case (Users, BUILTIN\Users, CABINET\Accountants). */
export function findGroup(game: Game, typed: string): WinGroup | undefined {
  ensureAccounts(game);
  const name = typed.trim().replace(/^[^\\]*\\/, '').toLowerCase();
  return Object.values(groups(game)).find((g) => g.name.toLowerCase() === name);
}

/** A group's identity (BUILTIN\Users or CABINET\Accountants). */
export const groupId = (game: Game, g: WinGroup) => (g.builtin ? `BUILTIN\\${g.name}` : `${windows(game).computer}\\${g.name}`);

/** Is the account's password expired at the machine's clock? */
export function passwordExpired(game: Game, u: WinUser): boolean {
  const w = windows(game);
  const max = (w.policy?.maxAge ?? 42) * DAY;
  return !u.neverExpires && u.passwordLastSet !== null && max > 0 && w.clock > u.passwordLastSet + max;
}

/** When the password expires (null: never). */
export function passwordExpires(game: Game, u: WinUser): number | null {
  const max = (windows(game).policy?.maxAge ?? 42) * DAY;
  return u.neverExpires || u.passwordLastSet === null || !max ? null : u.passwordLastSet + max;
}

/** The complexity rules of the local policy: null if the password is accepted. */
export function passwordProblem(game: Game, user: string, password: string): 'policy' | null {
  const p = windows(game).policy ?? { maxAge: 42, minLength: 0, complexity: true };
  if (password.length < p.minLength) return 'policy';
  if (p.complexity) {
    const kinds = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
    if (password.length < 6 || kinds < 3 || (user.length >= 3 && password.toLowerCase().includes(user.toLowerCase()))) return 'policy';
  }
  return null;
}

/** Sets a password (Set-LocalUser, net user): the services and tasks that kept the old one now fail. */
export function setPassword(game: Game, u: WinUser, password: string): void {
  const w = windows(game);
  w.passwords[u.name] = password;
  u.passwordLastSet = w.clock;
}

/** Why a logon fails: null if it succeeds. Win32 errors: 1326 bad password, 1331 disabled, 1330 expired. */
export function logonError(game: Game, account: string, password: string | undefined): 1326 | 1331 | 1330 | null {
  const u = findUser(game, account);
  if (!u) return 1326;
  if (password !== undefined && windows(game).passwords[u.name] !== password) return 1326;
  if (!u.enabled) return 1331;
  if (passwordExpired(game, u)) return 1330;
  return null;
}

/** Keeps the game's accounts in step (ssh, administrators' keys, groupsFor). */
export function syncAccounts(game: Game): void {
  const w = windows(game);
  const us = users(game);
  const gs = groups(game);
  const accounts = game.accounts;
  for (const u of Object.values(us)) {
    if (!u.enabled && u.name !== game.player) continue;
    accounts.users[u.name] ??= { uid: 1000 + u.rid, group: 'Users', home: `/C/Users/${u.name}` };
  }
  for (const g of Object.values(gs)) {
    const members = g.members
      .map((m) => canonical(game, m))
      .filter((m) => m.toLowerCase().startsWith(`${w.computer.toLowerCase()}\\`))
      .map((m) => m.slice(w.computer.length + 1));
    accounts.groups[g.name] = { gid: g.builtin ? g.rid : 1000 + g.rid, members };
  }
}

/** The account's display in a group's member list (CABINET\alice, NT AUTHORITY\Authenticated Users). */
export const memberName = (game: Game, m: string) => canonical(game, m);

/** Does an identity name a principal the machine knows? */
export const knownPrincipal = (game: Game, typed: string) => principal(game, typed) !== null;

// ——— The OpenSSH session: where it lands ———

const DEFAULT_SHELL_KEY = 'HKLM:\\SOFTWARE\\OpenSSH';

/** The shell an OpenSSH session starts: DefaultShell in the registry, cmd.exe without it (story 30's cabinet: PowerShell). */
export function defaultShell(game: Game): 'cmd' | 'powershell' {
  const w: Windows = windows(game);
  if (!w.registry) return 'powershell';
  const v = registryValue(game, DEFAULT_SHELL_KEY, 'DefaultShell');
  return typeof v === 'string' && /powershell(\.exe)?$/i.test(v.trim()) ? 'powershell' : 'cmd';
}

/** Opens a session on the machine for its player: the shells' stack, the profile, the banner it shows. */
export function windowsLogin(game: Shell): string {
  const w = windows(game);
  const shell = defaultShell(game);
  w.shells = [shell];
  w.location = null;
  game.cwd = game.home;
  const u = findUser(game, game.player);
  if (u) u.lastLogon = w.clock;
  return shell === 'powershell' ? POWERSHELL_BANNER : CMD_BANNER;
}
