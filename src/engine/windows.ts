// A Windows Server (state.os = 'windows'): first the machine a Linux admin
// meets next door (story 30, read only: state.windows.readOnly), then a
// machine of its own to administer. This module holds the model's core:
//   - drives are the world's top directories (C: is /C, D: is /D), their
//     names compared without case like NTFS does; each node may carry an
//     NTFS security descriptor (world.ts NtfsAcl, windows-acl.ts);
//   - volumes: letter, label, size, and what the system uses outside the
//     modelled files (base); free space follows the files;
//   - services (windows-services.ts: status, start type, logon account and
//     the password the Service Control Manager keeps), SMB shares and their
//     share permissions, the event logs (System, Application, Security,
//     Microsoft-Windows-TaskScheduler/Operational), local users and groups
//     (windows-accounts.ts), the registry (windows-registry.ts), scheduled
//     tasks (windows-tasks.ts), the clock;
//   - the session's shells: OpenSSH lands in the DefaultShell of
//     HKLM:\SOFTWARE\OpenSSH (powershell.exe), otherwise in cmd.exe.
// Sources (Microsoft Learn): "OpenSSH for Windows overview"
// (https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview),
// "OpenSSH Server configuration for Windows" (DefaultShell,
// administrators_authorized_keys,
// https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration),
// "How to detect, enable and disable SMBv1"
// (https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3),
// "Event logging" and the event schema (Level: 1 Critical, 2 Error,
// 3 Warning, 4 Information,
// https://learn.microsoft.com/windows/win32/wes/eventschema-levels-complextype).
// Simplifications (docs/SCENARIOS.md): no NTFS attributes but hidden, one
// HKCU for the session, a clock that moves only when a story says so.

import type { Game, Shell } from './shell';
import type { Directory, Node } from './world';

export const isWindows = (game: Game) => game.state.os === 'windows';

export interface WinService {
  name: string;
  display: string;
  status: 'Running' | 'Stopped';
  start: 'Automatic' | 'Manual' | 'Disabled';
  // The logon account (sc qc's SERVICE_START_NAME): LocalSystem by default,
  // NT AUTHORITY\LocalService, or a local user (.\svc_backup).
  account?: string;
  // The password the Service Control Manager stored for that account (sc
  // config obj= password=): checked against the account's when it starts.
  password?: string;
  // The program (BINARY_PATH_NAME).
  path?: string;
  description?: string;
  // The services it needs (started first; stopping them needs -Force).
  dependsOn?: string[];
  // A Win32 error the service returns when it starts (2: its program is
  // missing, 1053: it doesn't answer), set by a story.
  fails?: number;
  // The exit code of its last stop (sc query's WIN32_EXIT_CODE).
  exitCode?: number;
  // Its own process (svchost.exe otherwise).
  process?: string;
  // The files it holds open while it runs (D:\Logs\Agenda\agenda.log): another process can't delete them.
  opens?: string[];
  // What it does when it starts (a story's service reading its configuration file).
  onStart?: (game: Game) => void;
}
export interface WinVolume {
  letter: string;
  label: string;
  size: number;
  // Bytes used outside the modelled files (the system, the MFT…).
  base: number;
}
export interface WinEvent {
  // Local time, read as UTC (like systemd's clock).
  time: number;
  id: number;
  level: 'Critical' | 'Information' | 'Warning' | 'Error';
  provider: string;
  message: string;
  // The record number in its log (given when it is logged).
  record?: number;
  // The account it was logged for (a task's user), as a SID's name.
  user?: string;
  // Security: Audit Success or Audit Failure.
  keywords?: string;
}
export interface WinLog {
  events: WinEvent[];
  // A disabled log records nothing (the Task Scheduler's history is off by default).
  enabled: boolean;
}
export type ShareRight = 'Full' | 'Change' | 'Read';
export interface ShareAce {
  account: string;
  right: ShareRight;
  deny?: boolean;
}
export interface WinShare {
  name: string;
  // C:\… ('' for IPC$).
  path: string;
  description: string;
  // The accounts that may change files through the share (the others read):
  // story 30's short form, used when `access` isn't given.
  change: string[];
  // The share permissions (Get-SmbShareAccess): by default Everyone Read.
  access?: ShareAce[];
  // The administrative shares (C$, ADMIN$, IPC$): only administrators.
  special?: boolean;
}
export interface Windows {
  // The computer's name (CABINET), as hostname shows it.
  computer: string;
  services: WinService[];
  volumes: WinVolume[];
  // The System log, oldest first.
  events: WinEvent[];
  shares: WinShare[];
  // SMB1 is disabled since Windows Server 2019: a client asking for vers=1.0 is turned away.
  smb1: boolean;
  // The accounts' passwords (SMB sessions, ssh, services, tasks).
  passwords: Record<string, string>;
  // The clock (ms, local time read as UTC).
  clock: number;
  // Story 30: the session only reads (write cmdlets answer with a note of the game).
  readOnly?: boolean;
  // The other logs (Application, Security, Microsoft-Windows-TaskScheduler/Operational…).
  logs?: Record<string, WinLog>;
  // Local users and groups (windows-accounts.ts); built from the accounts when absent.
  users?: Record<string, unknown>;
  groups?: Record<string, unknown>;
  // The local password policy (net accounts).
  policy?: { maxAge: number; minLength: number; complexity: boolean };
  // The registry (windows-registry.ts).
  registry?: unknown;
  // Scheduled tasks (windows-tasks.ts).
  tasks?: unknown[];
  // Environment variables beyond the computed ones ($env:NAME).
  env?: Record<string, string>;
  // The network: the machine's address, mask and gateway (ipconfig).
  network?: { address: string; mask: string; gateway: string; dns?: string; suffix?: string; mac?: string };
  // The session's shells, innermost last (cmd.exe, powershell.exe).
  shells?: ('cmd' | 'powershell')[];
  // A registry or other provider location (HKLM:\SOFTWARE) when not on a drive.
  location?: string | null;
  // The last boot (Get-ComputerInfo, uptime of processes).
  boot?: number;
  // Counters that keep ids deterministic (process ids, task instance GUIDs).
  serial?: number;
  // Windows Defender Firewall (windows-firewall.ts); the defaults when absent.
  firewall?: unknown;
  // The domain the machine belongs to (windows-ad.ts: a member server; a domain controller has state.ad).
  domain?: { dns: string; netbios: string; dc: string; ou?: string; tools?: boolean };
  // The Group Policy applied on the machine (windows-gpo.ts).
  gp?: unknown;
}

export const windows = (game: Game): Windows => game.state.windows as Windows;

// ——— Paths: C:\Users\you ⇄ /C/Users/you ———

/** The Windows path of an internal path (/D/Shares/plans → D:\Shares\plans, /C → C:\). */
export function toWindows(internal: string): string {
  const parts = internal.split('/').filter(Boolean);
  if (!parts.length) return '\\';
  return `${parts[0]}:\\${parts.slice(1).join('\\')}`;
}

/** A child's name, compared without case (NTFS keeps the case, ignores it to look up). */
export function childNamed(dir: Directory, name: string): string | undefined {
  if (Object.hasOwn(dir.children, name)) return name;
  const low = name.toLowerCase();
  return Object.keys(dir.children).find((n) => n.toLowerCase() === low);
}

/**
 * A path typed in PowerShell (absolute, relative, D:, ~, / or \), as an
 * internal path with the names' real case; `exists` says whether it was all
 * found (otherwise the missing part keeps the case it was typed in).
 */
export function resolveWindows(game: Shell, typed: string): { path: string; exists: boolean } {
  let p = typed.replace(/\//g, '\\').trim();
  const cwd = game.cwd.split('/').filter(Boolean);
  let parts: string[];
  if (p === '~' || p.startsWith('~\\')) {
    parts = game.home.split('/').filter(Boolean);
    p = p.slice(1);
  } else if (/^[A-Za-z]:/.test(p)) {
    const drive = p[0].toUpperCase();
    // D: alone or D:name: the drive's current place (here: its root, or cwd on the same drive).
    parts = p[2] === '\\' ? [drive] : cwd[0] === drive ? [...cwd] : [drive];
    p = p.slice(2);
  } else if (p.startsWith('\\')) parts = [cwd[0] ?? 'C'];
  else parts = [...cwd];
  for (const seg of p.split('\\').filter(Boolean)) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 1) parts.pop();
    } else parts.push(seg);
  }
  // The names' real case, as far as they exist.
  let n: Node = game.root;
  let exists = true;
  const out: string[] = [];
  for (const seg of parts) {
    const real: string | undefined = exists && n.type === 'directory' ? childNamed(n, seg) : undefined;
    if (real === undefined) {
      exists = false;
      out.push(seg);
      continue;
    }
    out.push(real);
    n = (n as Directory).children[real];
  }
  return { path: '/' + out.join('/'), exists };
}

/** A hidden name (Windows' Hidden attribute): System Volume Information, $RECYCLE.BIN, desktop.ini. */
export const hidden = (name: string) => name.startsWith('$') || name === 'System Volume Information' || name.toLowerCase() === 'desktop.ini' || name.startsWith('.');

// ——— Volumes ———

/** What a volume uses: its base plus the files of its drive. */
export function volumeUsed(game: Shell, letter: string): number {
  const v = windows(game).volumes.find((x) => x.letter === letter);
  const tree = game.find(`/${letter}`);
  return (v?.base ?? 0) + (tree ? onDisk(game, tree) : 0);
}

/** The bytes a file or folder takes on its volume (NTFS-compressed files take less). */
export function onDisk(game: Shell, n: Node): number {
  if (n.type === 'file') return n.onDisk ?? game.size(n);
  return Object.values(n.children).reduce((sum, c) => sum + onDisk(game, c), 0);
}

/** The volume a Windows path (D:\Shares\plans) lies on. */
export const volumeOf = (game: Game, winPath: string) => windows(game).volumes.find((v) => v.letter === winPath[0]?.toUpperCase());

// ——— Dates, as en-US Windows writes them ———

const two = (n: number) => String(n).padStart(2, '0');
/** 11/20/2029 7:41:12 AM */
export function longDate(ms: number): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${h % 12 || 12}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`;
}
/** Get-ChildItem's LastWriteTime column: "11/18/2029   4:12 PM". */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  return `${`${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`.padStart(10)} ${`${h % 12 || 12}:${two(d.getUTCMinutes())}`.padStart(7)} ${h < 12 ? 'AM' : 'PM'}`;
}

// ——— Event logs ———

export const SYSTEM_LOG = 'System';
export const TASK_LOG = 'Microsoft-Windows-TaskScheduler/Operational';

/** A log by its name (without case): System is windows.events; null if the machine has no such log. */
export function winLog(game: Game, name: string): WinLog | null {
  const w = windows(game);
  if (name.toLowerCase() === 'system') return { events: w.events, enabled: true };
  const logs = (w.logs ??= {});
  const key = Object.keys(logs).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? logs[key] : null;
}

/** The log names the machine has, System first. */
export const logNames = (game: Game) => [SYSTEM_LOG, ...Object.keys(windows(game).logs ?? {})];

/** Writes an event (at the machine's clock unless given), if its log is enabled. */
export function logEvent(game: Game, log: string, e: Omit<WinEvent, 'time'> & { time?: number }): void {
  const l = winLog(game, log);
  if (!l || !l.enabled) return;
  const record = (l.events.at(-1)?.record ?? 4000 + l.events.length) + 1;
  l.events.push({ ...e, time: e.time ?? windows(game).clock, record });
}

/** A deterministic counter of the machine (process ids, GUIDs). */
export function serial(game: Game): number {
  const w = windows(game);
  w.serial = (w.serial ?? 0) + 1;
  return w.serial;
}

/** A GUID derived from a counter, always the same for the same machine and step. */
export function guid(game: Game): string {
  const n = serial(game);
  const hex = (seed: number, len: number) => {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    let out = '';
    while (out.length < len) {
      h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0;
      out += h.toString(16).padStart(8, '0');
    }
    return out.slice(0, len);
  };
  const c = windows(game).computer;
  const seed = [...c].reduce((a, ch) => a * 31 + ch.charCodeAt(0), n) >>> 0;
  return `{${hex(seed, 8)}-${hex(seed + 1, 4)}-${hex(seed + 2, 4)}-${hex(seed + 3, 4)}-${hex(seed + 4, 12)}}`;
}

// ——— The session's shells (OpenSSH's DefaultShell) ———

export type WinShell = 'cmd' | 'powershell';

/** The shell being typed in. */
export const currentShell = (game: Game): WinShell => windows(game).shells?.at(-1) ?? 'powershell';

/** cmd.exe's prompt in an OpenSSH session (user@HOST C:\Users\user>), PowerShell's (PS C:\…>). */
export function windowsPrompt(game: Shell): string {
  const w = windows(game);
  const where = w.location ?? toWindows(game.cwd);
  if (currentShell(game) === 'cmd') return `${game.who}@${w.computer} ${toWindows(game.cwd)}>`;
  return `PS ${where}>`;
}

export const POWERSHELL_BANNER = 'Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\nInstall the latest PowerShell for new features and improvements! https://aka.ms/PSWindows\n';
export const CMD_BANNER = 'Microsoft Windows [Version 10.0.20348.2700]\n(c) Microsoft Corporation. All rights reserved.\n';

/** A drive's free bytes. */
export function volumeFree(game: Shell, letter: string): number {
  const v = windows(game).volumes.find((x) => x.letter === letter.toUpperCase());
  return v ? v.size - volumeUsed(game, v.letter) : Infinity;
}
