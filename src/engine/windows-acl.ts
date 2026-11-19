// NTFS permissions on a Windows machine (state.os = 'windows'): each file
// or folder may carry a security descriptor (world.ts NtfsAcl: its owner
// and its explicit access control entries); the inherited entries are
// computed from the parents, like Windows propagates them:
//   - (OI) object inherit: files below get the entry; (CI) container
//     inherit: folders below get it; (IO) inherit only: it doesn't apply to
//     the folder that carries it; (NP) no propagate: only the children;
//   - CREATOR OWNER becomes the owner of the new child, generic rights
//     (GA, GR, GE, GW) are mapped to the file rights on the child;
//   - a protected descriptor (inheritance disabled) takes nothing from above.
// The access check walks the entries in canonical order (explicit deny,
// explicit allow, then the inherited ones, nearest parent first): the first
// entry that denies a requested right not yet granted refuses, so an
// explicit Allow beats an inherited Deny, and a Deny beats an Allow at the
// same level. The owner may always read and change the permissions.
// Access through a share is the more restrictive of the share permissions
// and NTFS (shareAccess).
// Sources (Microsoft Learn): "How DACLs Control Access to an Object"
// (https://learn.microsoft.com/windows/win32/secauthz/how-dacls-control-access-to-an-object),
// "Order of ACEs in a DACL" (https://learn.microsoft.com/windows/win32/secauthz/order-of-aces-in-a-dacl),
// "ACE Inheritance Rules" (https://learn.microsoft.com/windows/win32/secauthz/ace-inheritance-rules),
// "File Security and Access Rights" (https://learn.microsoft.com/windows/win32/fileio/file-security-and-access-rights),
// FileSystemRights (https://learn.microsoft.com/dotnet/api/system.security.accesscontrol.filesystemrights),
// icacls (https://learn.microsoft.com/windows-server/administration/windows-commands/icacls),
// "Share and NTFS permissions" (https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-copying-moving-files).
// Simplifications (docs/SCENARIOS.md): inherited entries are computed, not
// copied (a moved file takes its new parent's at once), no SACL (Audit), no
// integrity labels, no privileges (backup, restore) beyond an
// administrator's right to take ownership.

import type { Game, Shell } from './shell';
import type { Directory, Node, NtfsAce, NtfsAcl } from './world';
import type { ShareRight, WinShare } from './windows';
import { windows } from './windows';
import { groups, users } from './windows-accounts';

// ——— Rights (FileSystemRights) ———

export const R = {
  ReadData: 0x1,
  WriteData: 0x2,
  AppendData: 0x4,
  ReadExtendedAttributes: 0x8,
  WriteExtendedAttributes: 0x10,
  ExecuteFile: 0x20,
  DeleteSubdirectoriesAndFiles: 0x40,
  ReadAttributes: 0x80,
  WriteAttributes: 0x100,
  Delete: 0x10000,
  ReadPermissions: 0x20000,
  ChangePermissions: 0x40000,
  TakeOwnership: 0x80000,
  Synchronize: 0x100000,
};
const SYNC = R.Synchronize;
// The masks icacls names (with Synchronize, as Windows stores them).
export const FULL = 0x1f01ff;
export const MODIFY = 0x1301bf;
export const READ_EXECUTE = 0x1200a9;
export const READ = 0x120089;
export const WRITE = 0x100116;
export const LIST = 0x100001 | 0x20000 | 0x80 | 0x8 | 0x20;
// Generic rights, as an inherit-only entry may carry them.
const GA = 0x10000000;
const GE = 0x20000000;
const GW = 0x40000000;
const GR = 0x80000000;

/** Generic rights mapped to the file rights (FILE_GENERIC_*). */
export function mapGeneric(mask: number): number {
  let m = mask & 0x0fffffff;
  if (mask & GA) m |= FULL;
  if (mask & GR) m |= 0x120089;
  if (mask & GW) m |= 0x120116;
  if (mask & GE) m |= 0x1200a0;
  return m >>> 0;
}

// The named values of FileSystemRights, largest first, as .NET's Enum.ToString reads flags.
const NAMED: [string, number][] = [
  ['FullControl', 2032127],
  ['Synchronize', 1048576],
  ['TakeOwnership', 524288],
  ['ChangePermissions', 262144],
  ['Modify', 197055],
  ['ReadAndExecute', 131241],
  ['Read', 131209],
  ['ReadPermissions', 131072],
  ['Delete', 65536],
  ['Write', 278],
  ['WriteAttributes', 256],
  ['ReadAttributes', 128],
  ['DeleteSubdirectoriesAndFiles', 64],
  ['ExecuteFile', 32],
  ['WriteExtendedAttributes', 16],
  ['ReadExtendedAttributes', 8],
  ['AppendData', 4],
  ['WriteData', 2],
  ['ReadData', 1],
];

/** A mask as Get-Acl shows it: "Modify, Synchronize", "FullControl", or a number when generic. */
export function rightsName(mask: number): string {
  if (mask & 0xf0000000) return String(mask >> 0);
  let rest = mask;
  const names: string[] = [];
  for (const [n, v] of NAMED)
    if ((rest & v) === v && rest) {
      names.push(n);
      rest &= ~v;
    }
  if (rest) return String(mask);
  return names.reverse().join(', ');
}

/** A rights name typed in PowerShell or New-Object ("Modify", "Read, Write", "FullControl"). */
export function rightsFromName(text: string): number | null {
  let m = 0;
  for (const part of text.split(',').map((x) => x.trim()).filter(Boolean)) {
    const found = NAMED.find(([n]) => n.toLowerCase() === part.toLowerCase()) ?? (part.toLowerCase() === 'listdirectory' ? ['', 1] : part.toLowerCase() === 'traverse' ? ['', 32] : part.toLowerCase() === 'createfiles' ? ['', 2] : part.toLowerCase() === 'createdirectories' ? ['', 4] : null);
    if (!found) return null;
    m |= found[1] as number;
  }
  return m ? m >>> 0 : null;
}

// icacls' simple rights, then its specific rights.
const SIMPLE: [string, number][] = [
  ['F', FULL],
  ['M', MODIFY],
  ['RX', READ_EXECUTE],
  ['R', READ],
  ['W', WRITE],
  ['D', R.Delete | SYNC],
];
const SPECIFIC: [string, number][] = [
  ['GA', GA],
  ['GR', GR],
  ['GW', GW],
  ['GE', GE],
  ['DE', R.Delete],
  ['RC', R.ReadPermissions],
  ['WDAC', R.ChangePermissions],
  ['WO', R.TakeOwnership],
  ['S', SYNC],
  ['RD', R.ReadData],
  ['WD', R.WriteData],
  ['AD', R.AppendData],
  ['REA', R.ReadExtendedAttributes],
  ['WEA', R.WriteExtendedAttributes],
  ['X', R.ExecuteFile],
  ['DC', R.DeleteSubdirectoriesAndFiles],
  ['RA', R.ReadAttributes],
  ['WA', R.WriteAttributes],
];

/** A mask as icacls writes it: F, M, RX, R, W, or (RX,W), or its specific rights (S,RD). */
export function icaclsRights(mask: number): string {
  // A deny entry has no Synchronize: it shows as the simple right all the same.
  const simple = SIMPLE.find(([, v]) => v === mask || (v === (mask | SYNC) && (mask & 0xffff) !== 0));
  if (simple) return simple[0];
  // Two simple rights together (RX,W), as icacls shows them.
  for (const [a, va] of SIMPLE) for (const [b, vb] of SIMPLE) if (a < b && a !== b && (va | vb) === mask && a !== 'D' && b !== 'D') return `${a === 'W' ? b : a},${a === 'W' ? a : b}`;
  const out: string[] = [];
  let rest = mask;
  for (const [n, v] of SPECIFIC)
    if (rest & v) {
      out.push(n);
      rest &= ~v;
    }
  return out.join(',');
}

/** icacls' perm (F, M, RX, R, W, D, or a list of specific rights in parentheses); null if unknown. */
export function icaclsParse(text: string): number | null {
  const parts = text.replace(/^\(|\)$/g, '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  if (!parts.length) return null;
  let m = 0;
  for (const p of parts) {
    const v = SIMPLE.find(([n]) => n === p)?.[1] ?? SPECIFIC.find(([n]) => n === p)?.[1];
    if (v === undefined) return null;
    m |= v;
  }
  return m >>> 0;
}

// ——— Identities ———

// Well-known identities (canonical name, SID, the short names that resolve to it).
export const WELL_KNOWN: { name: string; sid: string; sddl?: string; short: string[]; type: string }[] = [
  { name: 'Everyone', sid: 'S-1-1-0', sddl: 'WD', short: ['everyone'], type: 'Well-known group' },
  { name: 'CREATOR OWNER', sid: 'S-1-3-0', sddl: 'CO', short: ['creator owner'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\SYSTEM', sid: 'S-1-5-18', sddl: 'SY', short: ['system', 'localsystem'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\LOCAL SERVICE', sid: 'S-1-5-19', sddl: 'LS', short: ['local service', 'localservice'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\NETWORK SERVICE', sid: 'S-1-5-20', sddl: 'NS', short: ['network service', 'networkservice'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\Authenticated Users', sid: 'S-1-5-11', sddl: 'AU', short: ['authenticated users'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\INTERACTIVE', sid: 'S-1-5-4', sddl: 'IU', short: ['interactive'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\NETWORK', sid: 'S-1-5-2', sddl: 'NU', short: ['network'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\SERVICE', sid: 'S-1-5-6', sddl: 'SU', short: ['service'], type: 'Well-known group' },
  { name: 'NT AUTHORITY\\BATCH', sid: 'S-1-5-3', sddl: 'BT', short: ['batch'], type: 'Well-known group' },
  { name: 'NT SERVICE\\TrustedInstaller', sid: 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464', short: ['trustedinstaller'], type: 'Well-known group' },
];
// The built-in groups (BUILTIN\…): their RID under S-1-5-32 and SDDL letters.
export const BUILTIN_RIDS: Record<string, [number, string?]> = {
  Administrators: [544, 'BA'],
  Users: [545, 'BU'],
  Guests: [546, 'BG'],
  'Power Users': [547, 'PU'],
  'Backup Operators': [551, 'BO'],
  'Remote Desktop Users': [555, 'RD'],
  'Network Configuration Operators': [556, 'NO'],
  'Performance Monitor Users': [558, 'MU'],
  'Distributed COM Users': [562, 'CD'],
  'IIS_IUSRS': [568, 'IS'],
  'Event Log Readers': [573, 'ER'],
  'Remote Management Users': [580, 'RM'],
};

export interface Principal {
  name: string;
  sid: string;
  kind: 'User' | 'Group' | 'WellKnown';
  source: 'Local' | 'Unknown' | 'ActiveDirectory';
}

/**
 * The domain's part (set by windows-ad.ts): a domain account or group by
 * name (SCHOOL\alice, alice@school.internal, or a bare name the machine
 * doesn't know locally), the domain groups a principal reaches (nested), and
 * every domain principal (a SID lookup).
 */
export const DOMAIN_HOOKS: {
  principal?: (game: Game, domain: string, name: string) => Principal | null;
  groups?: (game: Game, principal: string) => string[];
  all?: (game: Game) => Principal[];
} = {};

interface Accountish {
  rid: number;
  builtin?: boolean;
  members?: string[];
}

/** The machine's SID (S-1-5-21-…), derived from its name, always the same. */
export function machineSid(game: Game): string {
  const c = windows(game).computer;
  let h = 0x811c9dc5;
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (const ch of c + i) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    parts.push(1_000_000_000 + (h % 3_000_000_000));
  }
  return `S-1-5-21-${parts.join('-')}`;
}

// The local accounts (built from the game's accounts the first time, see windows-accounts.ts).
const usersOf = (game: Game) => users(game) as unknown as Record<string, Accountish & { name: string }>;
const groupsOf = (game: Game) => groups(game) as unknown as Record<string, Accountish & { name: string }>;

/**
 * An identity as typed (alice, CABINET\alice, .\alice, Users, BUILTIN\Users,
 * SYSTEM, Everyone, *S-1-5-32-545) → the principal, or null ("No mapping
 * between account names and security IDs was done.").
 */
export function principal(game: Game, typed: string): Principal | null {
  const w = windows(game);
  let t = typed.trim().replace(/^"|"$/g, '');
  if (t.startsWith('*')) {
    const sid = t.slice(1).toUpperCase();
    const all = allPrincipals(game);
    return all.find((p) => p.sid.toUpperCase() === sid) ?? null;
  }
  const low = t.toLowerCase();
  const wk = WELL_KNOWN.find((x) => x.name.toLowerCase() === low || x.short.includes(low));
  if (wk) return { name: wk.name, sid: wk.sid, kind: 'WellKnown', source: 'Unknown' };
  // A user principal name (alice@school.internal): the domain's.
  const upn = /^([^@\\]+)@(.+)$/.exec(t);
  if (upn) return DOMAIN_HOOKS.principal?.(game, upn[2], upn[1]) ?? null;
  let domain = '';
  if (t.includes('\\')) {
    [domain, t] = t.split('\\', 2) as [string, string];
    domain = domain.toLowerCase();
  }
  const name = t.toLowerCase();
  if (domain === 'builtin' || !domain) {
    const g = Object.values(groupsOf(game)).find((x) => x.builtin && x.name.toLowerCase() === name);
    if (g) return { name: `BUILTIN\\${g.name}`, sid: `S-1-5-32-${g.rid}`, kind: 'Group', source: 'Local' };
    const known = Object.keys(BUILTIN_RIDS).find((k) => k.toLowerCase() === name);
    if (known && domain === 'builtin') return { name: `BUILTIN\\${known}`, sid: `S-1-5-32-${BUILTIN_RIDS[known][0]}`, kind: 'Group', source: 'Local' };
  }
  if (!domain || domain === '.' || domain === w.computer.toLowerCase()) {
    const u = Object.values(usersOf(game)).find((x) => x.name.toLowerCase() === name);
    if (u) return { name: `${w.computer}\\${u.name}`, sid: `${machineSid(game)}-${u.rid}`, kind: 'User', source: 'Local' };
    const g = Object.values(groupsOf(game)).find((x) => !x.builtin && x.name.toLowerCase() === name);
    if (g) return { name: `${w.computer}\\${g.name}`, sid: `${machineSid(game)}-${g.rid}`, kind: 'Group', source: 'Local' };
  }
  // Not a local account: the domain's (SCHOOL\Teachers, or a bare name on a member server).
  if (domain !== '.' && domain !== w.computer.toLowerCase()) return DOMAIN_HOOKS.principal?.(game, domain, t) ?? null;
  return null;
}

/** Every principal the machine knows (for a SID lookup). */
export function allPrincipals(game: Game): Principal[] {
  const out: Principal[] = WELL_KNOWN.map((x) => ({ name: x.name, sid: x.sid, kind: 'WellKnown' as const, source: 'Unknown' as const }));
  for (const u of Object.values(usersOf(game))) out.push(principal(game, `.\\${u.name}`)!);
  for (const g of Object.values(groupsOf(game))) out.push(principal(game, g.builtin ? `BUILTIN\\${g.name}` : `.\\${g.name}`)!);
  out.push(...(DOMAIN_HOOKS.all?.(game) ?? []));
  return out.filter(Boolean);
}

/** The canonical name of an identity (unknown ones stay as typed). */
export const canonical = (game: Game, typed: string) => principal(game, typed)?.name ?? typed;

/** A SID's SDDL form (BA, SY…) or the SID itself. */
export function sddlSid(game: Game, name: string): string {
  const wk = WELL_KNOWN.find((x) => x.name === name);
  if (wk) return wk.sddl ?? wk.sid;
  const b = /^BUILTIN\\(.+)$/.exec(name);
  if (b && BUILTIN_RIDS[b[1]]?.[1]) return BUILTIN_RIDS[b[1]][1]!;
  return principal(game, name)?.sid ?? name;
}

/**
 * The identities in a user's token: the user, Everyone, Authenticated
 * Users, the local groups they belong to (directly or through an identity
 * in the group, like Authenticated Users in Users), NETWORK through a share.
 * 'SYSTEM' is the local system account.
 */
export function token(game: Game, user: string, network = false): Set<string> {
  const ids = new Set<string>(['Everyone']);
  const p = /^(nt authority\\)?system$|^localsystem$/i.test(user) ? { name: 'NT AUTHORITY\\SYSTEM' } : principal(game, user);
  if (!p) return ids;
  ids.add(p.name);
  if (p.name === 'NT AUTHORITY\\SYSTEM') ids.add('BUILTIN\\Administrators');
  // A domain account: the domain groups it reaches through nested groups (Domain Users included).
  if ('source' in p && p.source === 'ActiveDirectory') for (const g of DOMAIN_HOOKS.groups?.(game, p.name) ?? []) ids.add(g);
  ids.add('NT AUTHORITY\\Authenticated Users');
  if (network) ids.add('NT AUTHORITY\\NETWORK');
  else ids.add('NT AUTHORITY\\INTERACTIVE');
  // The groups, until nothing new (a group may hold another identity of the token).
  for (let changed = true; changed; ) {
    changed = false;
    for (const g of Object.values(groupsOf(game))) {
      const id = g.builtin ? `BUILTIN\\${g.name}` : `${windows(game).computer}\\${g.name}`;
      if (ids.has(id)) continue;
      if ((g.members ?? []).some((m) => ids.has(canonical(game, m)))) {
        ids.add(id);
        changed = true;
      }
    }
  }
  return ids;
}

// ——— The security descriptor of a node ———

export interface ResolvedAce extends NtfsAce {
  inherited: boolean;
  // Where an inherited entry comes from (the parent's Windows path), for Get-Acl's IsInherited.
  from?: string;
}
export interface Descriptor {
  owner: string;
  aces: ResolvedAce[];
  protected: boolean;
}

/** The entries a child gets from one of its parent's entries (ACE inheritance rules). */
function inheritFrom(ace: ResolvedAce, dir: boolean, owner: string, parent: string): ResolvedAce[] {
  if (!ace.oi && !ace.ci) return [];
  const from = ace.inherited ? ace.from : parent;
  const creator = ace.id === 'CREATOR OWNER';
  const generic = (ace.mask & 0xf0000000) !== 0;
  const base = { id: ace.id, mask: ace.mask, deny: ace.deny, inherited: true, from };
  const effective = (): ResolvedAce => ({ ...base, id: creator ? owner : ace.id, mask: mapGeneric(ace.mask) });
  if (!dir) return ace.oi ? [effective()] : [];
  if (ace.np) return ace.ci ? [effective()] : [];
  const flags = { oi: ace.oi, ci: ace.ci };
  // It applies to the child folder only through CI; it goes on through OI or CI.
  if (!ace.ci) return [{ ...base, ...flags, io: true }];
  if (creator || generic) return [effective(), { ...base, ...flags, io: true }];
  return [{ ...base, ...flags }];
}

const sortCanonical = (aces: NtfsAce[]) => [...aces.filter((a) => a.deny), ...aces.filter((a) => !a.deny)];

/** Does any node on the path down to this one carry a descriptor? (A world without ACLs grants everything.) */
function chain(game: Shell, path: string): { node: Node; path: string }[] | null {
  const parts = path.split('/').filter(Boolean);
  const out: { node: Node; path: string }[] = [];
  let n: Node = game.root;
  let at = '';
  for (const p of parts) {
    if (n.type !== 'directory') return null;
    const next: Node | undefined = (n as Directory).children[p];
    if (!next) return null;
    at += `/${p}`;
    n = next;
    out.push({ node: n, path: at });
  }
  return out;
}

/** The node's security descriptor: owner, explicit then inherited entries; null when the world has no ACLs there. */
export function descriptor(game: Shell, path: string): Descriptor | null {
  const nodes = chain(game, path);
  if (!nodes || !nodes.length || !nodes.some((x) => x.node.acl)) return null;
  let owner = 'BUILTIN\\Administrators';
  let aces: ResolvedAce[] = [];
  let prot = false;
  for (const [i, { node }] of nodes.entries()) {
    const own = node.acl as NtfsAcl | undefined;
    const dir = node.type === 'directory';
    owner = own?.owner ?? owner;
    prot = !!own?.protected;
    const parentPath = i ? nodes[i - 1].path : '';
    const inherited = i === 0 || prot ? [] : aces.flatMap((a) => inheritFrom(a, dir, owner, parentPath));
    const explicit: ResolvedAce[] = sortCanonical(own?.aces ?? []).map((a) => ({ ...a, inherited: false }));
    aces = [...explicit, ...inherited];
  }
  return { owner, aces, protected: prot };
}

/** The node's own descriptor, created on first change (owner copied from what it shows). */
export function ownAcl(game: Shell, path: string): NtfsAcl {
  const n = game.find(path);
  if (!n) throw new Error(`no node ${path}`);
  if (!n.acl) n.acl = { owner: descriptor(game, path)?.owner, aces: [] };
  return n.acl;
}

// ——— Access ———

/** The rights a token gets on a node (allow entries not denied before them). */
export function effectiveRights(game: Shell, path: string, ids: Set<string>): number {
  const d = descriptor(game, path);
  if (!d) return FULL;
  let granted = 0;
  let denied = 0;
  if (ids.has(d.owner)) granted |= R.ReadPermissions | R.ChangePermissions;
  for (const a of d.aces) {
    if (a.io || !ids.has(a.id)) continue;
    const m = mapGeneric(a.mask);
    if (a.deny) denied |= m & ~granted;
    else granted |= m & ~denied;
  }
  return granted >>> 0;
}

/** May this token do all of `desired` on the node? (Windows' access check, in canonical order.) */
export function allowed(game: Shell, path: string, ids: Set<string>, desired: number): boolean {
  const d = descriptor(game, path);
  if (!d) return true;
  let granted = 0;
  const want = desired & ~SYNC;
  if (ids.has(d.owner)) granted |= (R.ReadPermissions | R.ChangePermissions) & want;
  if ((granted & want) === want) return true;
  for (const a of d.aces) {
    if (a.io || !ids.has(a.id)) continue;
    const m = mapGeneric(a.mask);
    if (a.deny) {
      if (m & want & ~granted) return false;
    } else granted |= m & want;
    if ((granted & want) === want) return true;
  }
  return false;
}

/** The session's token (its account), cached per command is not needed: tokens are small. */
export const tokenFor = (game: Game, user = game.who, network = false) => token(game, user, network);

/** May the session's user do this on a path? Reading a folder is listing it. */
export function canNtfs(game: Shell, path: string, want: 'read' | 'write' | 'modify' | 'delete' | 'list' | 'execute' | 'permissions' | 'append', user = game.who): boolean {
  const ids = tokenFor(game, user);
  const masks = { read: R.ReadData, list: R.ReadData, write: R.WriteData, append: R.AppendData, modify: R.WriteData, execute: R.ExecuteFile, permissions: R.ChangePermissions, delete: R.Delete };
  if (want === 'delete') {
    if (allowed(game, path, ids, R.Delete)) return true;
    const parent = path.replace(/\/[^/]+$/, '');
    return allowed(game, parent, ids, R.DeleteSubdirectoriesAndFiles);
  }
  return allowed(game, path, ids, masks[want]);
}

// ——— Shares ———

const SHARE_MASK: Record<ShareRight, number> = { Full: FULL, Change: MODIFY, Read: READ_EXECUTE };

/** A share's permissions: its own list, or story 30's form (who may change, everyone reads). */
export function shareAces(share: WinShare): { account: string; right: ShareRight; deny?: boolean }[] {
  if (share.access) return share.access;
  return [{ account: 'Everyone', right: 'Read' }, ...share.change.map((a) => ({ account: a, right: 'Change' as const }))];
}

/** What a token gets from a share's permissions (deny first). */
export function shareRights(game: Game, share: WinShare, ids: Set<string>): number {
  let granted = 0;
  let denied = 0;
  for (const a of shareAces(share)) {
    if (!ids.has(canonical(game, a.account))) continue;
    if (a.deny) denied |= SHARE_MASK[a.right];
    else granted |= SHARE_MASK[a.right];
  }
  return granted & ~denied;
}

/**
 * Access through a share: the share permissions AND the NTFS permissions
 * (the more restrictive wins). `path` is the node's internal path on the
 * server; `user` the account the SMB session authenticated as.
 */
export function shareAccess(server: Shell, share: WinShare, path: string, user: string, want: 'read' | 'write'): boolean {
  const ids = token(server, user, true);
  const bit = want === 'read' ? R.ReadData : R.WriteData;
  if (!(shareRights(server, share, ids) & bit)) return false;
  return allowed(server, path, ids, bit);
}

/** The effective rights through a share (for a report): share ∩ NTFS. */
export const shareEffective = (server: Shell, share: WinShare, path: string, user: string) => {
  const ids = token(server, user, true);
  return shareRights(server, share, ids) & effectiveRights(server, path, ids);
};

// ——— Text forms ———

const flagsText = (a: ResolvedAce) => `${a.inherited ? '(I)' : ''}${a.oi ? '(OI)' : ''}${a.ci ? '(CI)' : ''}${a.io ? '(IO)' : ''}${a.np ? '(NP)' : ''}`;

/** icacls' lines for a node: "D:\Shares BUILTIN\Administrators:(OI)(CI)(F)", the next ones aligned. */
export function icaclsLines(game: Shell, win: string, d: Descriptor): string[] {
  const pad = ' '.repeat(win.length + 1);
  return d.aces.map((a, i) => `${i ? pad : `${win} `}${a.id}:${a.deny ? '(DENY)' : ''}${flagsText(a)}(${icaclsRights(a.mask)})`);
}

/** Get-Acl's InheritanceFlags and PropagationFlags. */
export const inheritanceFlags = (a: NtfsAce) => (a.ci && a.oi ? 'ContainerInherit, ObjectInherit' : a.ci ? 'ContainerInherit' : a.oi ? 'ObjectInherit' : 'None');
export const propagationFlags = (a: NtfsAce) => (a.np && a.io ? 'NoPropagateInherit, InheritOnly' : a.np ? 'NoPropagateInherit' : a.io ? 'InheritOnly' : 'None');

/** An entry as Get-Acl's AccessToString writes it: "BUILTIN\Users Allow  ReadAndExecute, Synchronize". */
export const accessLine = (a: NtfsAce) => `${a.id} ${a.deny ? 'Deny ' : 'Allow'}  ${rightsName(a.mask)}`;

/** The descriptor in SDDL (O:BAG:SYD:PAI(A;OICI;FA;;;SY)…). */
export function sddl(game: Shell, d: Descriptor): string {
  const rights = (m: number) => (m === FULL ? 'FA' : m === GA ? 'GA' : `0x${(m >>> 0).toString(16)}`);
  const ace = (a: ResolvedAce) =>
    `(${a.deny ? 'D' : 'A'};${a.oi ? 'OI' : ''}${a.ci ? 'CI' : ''}${a.np ? 'NP' : ''}${a.io ? 'IO' : ''}${a.inherited ? 'ID' : ''};${rights(a.mask)};;;${sddlSid(game, a.id)})`;
  return `O:${sddlSid(game, d.owner)}G:SYD:${d.protected ? 'P' : ''}AI${d.aces.map(ace).join('')}`;
}

/** Parses the inheritance flags typed in icacls' grant ((OI)(CI)(IO)(NP)) and the rights after them. */
export function parseGrant(text: string): { flags: Pick<NtfsAce, 'oi' | 'ci' | 'io' | 'np'>; mask: number } | null {
  const groups = [...text.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].toUpperCase());
  const rest = text.replace(/\([^)]*\)/g, '');
  if (rest.trim()) {
    const m = icaclsParse(rest);
    if (m === null) return null;
    groups.push(rest);
  }
  const flags: Pick<NtfsAce, 'oi' | 'ci' | 'io' | 'np'> = {};
  let mask = 0;
  for (const g of groups) {
    if (g === 'OI') flags.oi = true;
    else if (g === 'CI') flags.ci = true;
    else if (g === 'IO') flags.io = true;
    else if (g === 'NP') flags.np = true;
    else if (g === 'I') continue;
    else {
      const m = icaclsParse(g);
      if (m === null) return null;
      mask |= m;
    }
  }
  return mask ? { flags, mask } : null;
}
