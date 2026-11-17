// A Windows Server seen from Linux (state.os = 'windows'): the machine a
// Linux admin meets next door, reached over SMB (cifs.ts, smbclient) and
// over its built-in OpenSSH server, whose shell is Windows PowerShell 5.1
// (powershell.ts, commands/powershell.ts). The game doesn't simulate
// Windows itself: only what those visits read.
//   - drives are the world's top directories (C: is /C, D: is /D), their
//     names compared without case like NTFS does;
//   - volumes: letter, label, size, and what the system uses outside the
//     modelled files (base); free space follows the files;
//   - services (name, display name, status, start type), SMB shares (name,
//     path, which accounts may change them), the System event log;
//   - SMB: SMB1 disabled (the default since Windows Server 2019), the
//     accounts' passwords for SMB sessions.
// Sources (Microsoft Learn): "OpenSSH for Windows overview"
// (https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview),
// "OpenSSH Server configuration for Windows" (DefaultShell,
// administrators_authorized_keys), "How to detect, enable and disable SMBv1"
// (https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3).
// Simplifications (docs/SCENARIOS.md): no registry, no ACLs (a share says
// who may change it), no NTFS attributes but hidden, one fixed clock.

import type { Game, Shell } from './shell';
import type { Directory, Node } from './world';

export const isWindows = (game: Game) => game.state.os === 'windows';

export interface WinService {
  name: string;
  display: string;
  status: 'Running' | 'Stopped';
  start: 'Automatic' | 'Manual' | 'Disabled';
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
  level: 'Information' | 'Warning' | 'Error';
  provider: string;
  message: string;
}
export interface WinShare {
  name: string;
  // C:\… ('' for IPC$).
  path: string;
  description: string;
  // The accounts that may change files through the share (the others read).
  change: string[];
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
  // The accounts' passwords (SMB sessions).
  passwords: Record<string, string>;
  // The clock (ms, local time read as UTC).
  clock: number;
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
  return (v?.base ?? 0) + (tree ? game.size(tree) : 0);
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
