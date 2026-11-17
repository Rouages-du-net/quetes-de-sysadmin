// cmd.exe, where a Windows OpenSSH session lands when no DefaultShell is
// set: the prompt "user@HOST C:\Users\user>", a few built-in commands (dir,
// cd, type, echo, set, ver, mkdir, cls, exit) and the native programs
// (ipconfig, net, sc, icacls, schtasks, reg, whoami, hostname, powershell…).
// "powershell" starts Windows PowerShell inside it; exit comes back.
// Sources (Microsoft Learn): Windows commands
// (https://learn.microsoft.com/windows-server/administration/windows-commands/windows-commands),
// dir, cd, type, set, ver; "OpenSSH Server configuration for Windows"
// (DefaultShell).
// Differences (docs/SCENARIOS.md): no batch files, no pipes or redirections
// in cmd (use PowerShell), %VAR% expanded from the environment only.

import type { Shell } from '../shell';
import type { Directory } from '../world';
import { hidden, resolveWindows, toWindows, volumeFree, windows } from '../windows';
import { canNtfs } from '../windows-acl';
import { nativeNamed } from './windows-natives';
import { environment } from './powershell';
import { SHELL_HOOKS } from './windows-shells';

const two = (n: number) => String(n).padStart(2, '0');
function dirDate(ms: number): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  return `${two(d.getUTCMonth() + 1)}/${two(d.getUTCDate())}/${d.getUTCFullYear()}  ${two(h % 12 || 12)}:${two(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}
const thousands = (n: number) => n.toLocaleString('en-US');

function dir(game: Shell, arg: string | undefined): { out: string; code: number } {
  const where = resolveWindows(game, arg ?? '.');
  const n = where.exists ? game.find(where.path) : null;
  const win = toWindows(where.path);
  const letter = win[0];
  const v = windows(game).volumes.find((x) => x.letter === letter);
  const head = [` Volume in drive ${letter} ${v?.label ? `is ${v.label}` : 'has no label.'}`, ' Volume Serial Number is 6A2B-91C4', ''];
  if (!n) return { out: [...head, 'File Not Found'].join('\n'), code: 1 };
  if (n.type === 'directory' && !canNtfs(game, where.path, 'list')) return { out: 'Access is denied.', code: 1 };
  const clock = windows(game).clock;
  const dirNode = n.type === 'directory' ? (n as Directory) : null;
  const entries = dirNode ? Object.entries(dirNode.children).filter(([k]) => !hidden(k)).sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase())) : [[win.split('\\').at(-1)!, n] as const];
  const lines = [...head, ` Directory of ${dirNode ? win : win.replace(/\\[^\\]+$/, '') || win}`, ''];
  if (dirNode && where.path.split('/').filter(Boolean).length > 1) lines.push(`${dirDate(clock)}    <DIR>          .`, `${dirDate(clock)}    <DIR>          ..`);
  let files = 0;
  let bytes = 0;
  let dirs = dirNode && where.path.split('/').filter(Boolean).length > 1 ? 2 : 0;
  for (const [name, c] of entries) {
    const mtime = (c as { mtime?: number }).mtime ?? clock;
    if (c.type === 'directory') {
      dirs++;
      lines.push(`${dirDate(mtime)}    <DIR>          ${name}`);
    } else {
      files++;
      const size = game.size(c);
      bytes += size;
      lines.push(`${dirDate(mtime)}  ${thousands(size).padStart(16)} ${name}`);
    }
  }
  lines.push(`${String(files).padStart(16)} File(s) ${thousands(bytes).padStart(14)} bytes`, `${String(dirs).padStart(16)} Dir(s)  ${thousands(Math.max(0, volumeFree(game, letter))).padStart(14)} bytes free`);
  return { out: lines.join('\n'), code: 0 };
}

/** %NAME% from the environment. */
const expandVars = (game: Shell, line: string) =>
  line.replace(/%([^%]+)%/g, (m, name: string) => {
    const env = environment(game);
    const k = Object.keys(env).find((x) => x.toLowerCase() === name.toLowerCase());
    return k === undefined ? m : env[k];
  });

/** Splits a cmd line into words (double quotes group). */
const words = (line: string) => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);

/** One line at cmd.exe's prompt: its output (null for cls). */
export function runCmd(game: Shell, raw: string): string | null {
  game.recoverErrors();
  game.status = null;
  const line = expandVars(game, raw.trim());
  if (!line) return '';
  game.typedCommands++;
  game.commandLine = line;
  const [name, ...args] = words(line);
  const low = name.toLowerCase();
  const done = (out: string, code = 0) => {
    game.status = code;
    if (code) game.error(out);
    game.last = { line, commands: [[name, ...args]], output: out, errors: code ? [out] : [], redirection: null };
    windows(game).env = { ...(windows(game).env ?? {}) };
    return out;
  };
  const w = windows(game);
  switch (low) {
    case 'exit': {
      w.shells = (w.shells ?? ['cmd']).slice(0, -1);
      if (!w.shells.length) game.output = true;
      return done('');
    }
    case 'cls':
      return null;
    case 'cd':
    case 'chdir': {
      if (!args.length) return done(toWindows(game.cwd));
      const target = args.filter((a) => a.toLowerCase() !== '/d').join(' ');
      const where = resolveWindows(game, target);
      const n = where.exists ? game.find(where.path) : null;
      if (n?.type !== 'directory') return done('The system cannot find the path specified.', 1);
      if (!canNtfs(game, where.path, 'execute') && !canNtfs(game, where.path, 'list')) return done('Access is denied.', 1);
      game.cwd = where.path;
      return done('');
    }
    case 'dir': {
      const r = dir(game, args.filter((a) => !a.startsWith('/'))[0]);
      return done(r.out, r.code);
    }
    case 'type': {
      const where = resolveWindows(game, args.join(' '));
      const n = where.exists ? game.find(where.path) : null;
      if (!n || n.type !== 'file') return done('The system cannot find the file specified.', 1);
      if (!canNtfs(game, where.path, 'read')) return done('Access is denied.', 1);
      return done((game.read(where.path) ?? '').replace(/\r\n/g, '\n'));
    }
    case 'echo':
      return done(args.length ? line.slice(5) : 'ECHO is on.');
    case 'set': {
      const env = environment(game);
      if (!args.length) return done(Object.keys(env).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((k) => `${k}=${env[k]}`).join('\n'));
      const m = /^([^=]+)=(.*)$/.exec(line.slice(4));
      if (m) {
        w.env = { ...(w.env ?? {}), [m[1]]: m[2] };
        return done('');
      }
      const found = Object.keys(env).filter((k) => k.toLowerCase().startsWith(args[0].toLowerCase()));
      return found.length ? done(found.map((k) => `${k}=${env[k]}`).join('\n')) : done(`Environment variable ${args[0]} not defined`, 1);
    }
    case 'ver':
      return done('\nMicrosoft Windows [Version 10.0.20348.2700]');
    case 'mkdir':
    case 'md': {
      const where = resolveWindows(game, args.join(' '));
      if (where.exists) return done(`A subdirectory or file ${args.join(' ')} already exists.`, 1);
      const parentPath = where.path.replace(/\/[^/]+$/, '') || '/';
      const parent = game.find(parentPath);
      if (parent?.type !== 'directory') return done('The system cannot find the path specified.', 1);
      if (!canNtfs(game, parentPath, 'append')) return done('Access is denied.', 1);
      parent.children[where.path.split('/').at(-1)!] = { type: 'directory', children: {} };
      return done('');
    }
  }
  const native = nativeNamed(name);
  if (native) {
    const r = native.run(game, args, null);
    if (r.shell) (w.shells ??= ['cmd']).push(r.shell);
    const text = [r.out, r.err].filter(Boolean).join('\n').replace(/\n+$/, '');
    game.status = r.code;
    game.last = { line, commands: [[name, ...args]], output: text, errors: r.err ? [r.err] : [], redirection: null };
    if (r.err) game.error(r.err);
    return text;
  }
  return done(`'${name}' is not recognized as an internal or external command,\noperable program or batch file.`, 9009);
}

SHELL_HOOKS.cmd = (game, line) => runCmd(game, line) ?? '';
