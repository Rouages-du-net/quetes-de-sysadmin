// PowerShell's providers on a Windows machine: the FileSystem (C:\, D:\,
// case-insensitive, \ or /, relative paths, wildcards in the last part)
// and the Registry (HKLM:\, HKCU:\), with the Env: drive to read the
// environment. The item cmdlets work on both (Get-ChildItem, Get-Item,
// New-Item, Remove-Item, Test-Path, Set-Location); the content ones on
// files (Get-Content, Set-Content, Add-Content, Out-File, and >); the
// property ones on registry keys (Get-ItemProperty, Set-ItemProperty,
// New-ItemProperty, Remove-ItemProperty, Get-ItemPropertyValue). Every file
// operation checks the NTFS permissions of the session's account
// (windows-acl.ts) and the volume's free space; a new file or folder
// inherits its parent's permissions and belongs to its creator (the
// Administrators group when the creator is an administrator, the default on
// Windows Server). reg.exe (query, add, delete) reads the same registry.
// Sources (Microsoft Learn, PowerShell 5.1, Microsoft.PowerShell.Management):
// Get-ChildItem, Get-Item, Get-Content, Set-Content, Add-Content, New-Item,
// Remove-Item, Copy-Item, Move-Item, Rename-Item, Test-Path, Set-Location,
// Get-Location, Push-Location, Pop-Location, Get-ItemProperty,
// Set-ItemProperty, New-ItemProperty, Remove-ItemProperty,
// Get-ItemPropertyValue; Out-File (Microsoft.PowerShell.Utility);
// about_FileSystem_Provider, about_Registry_Provider,
// about_Environment_Provider; "Default owner for objects created by members
// of the Administrators group"
// (https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/system-objects-default-owner-for-objects-created-by-members-of-the-administrators-group);
// reg (https://learn.microsoft.com/windows-server/administration/windows-commands/reg).
// Differences (docs/SCENARIOS.md): Out-File and > write plain text (UTF-16
// in 5.1), no file attributes but hidden, Move-Item recomputes inherited
// permissions at the new place, reg add overwrites without asking.

import type { Shell } from '../shell';
import type { Directory, File, Node } from '../world';
import { hidden, resolveWindows, shortDate, toWindows, volumeFree, windows } from '../windows';
import { canNtfs, descriptor, token } from '../windows-acl';
import { heldOpen } from '../windows-services';
import { createKey, driveName, findKey, fullName, isRegistryPath, parseRegPath, REG_TYPE, registry, removeKey, removeValue, valueText, writeValue, type RegKey, type RegKind, type RegValue } from '../windows-registry';
import { PSDate, arr, isObject, str, text, values, wildcard, type Cmdlet, type Failure, type Native, type PSObject, type Run, type View } from '../powershell';

const MGMT = 'Microsoft.PowerShell.Management';
const DAY = 86_400_000;

// ——— Where a typed path leads ———

export type Where =
  | { kind: 'fs'; path: string; exists: boolean; win: string }
  | { kind: 'reg'; hive: 'HKLM' | 'HKCU'; parts: string[]; exists: boolean; win: string }
  | { kind: 'env'; name: string; exists: boolean; win: string };

/** A path typed in PowerShell: a file, a registry key, or an environment variable. */
export function locate(game: Shell, typed: string): Where {
  const t = typed.trim();
  const w = windows(game);
  if (/^env:/i.test(t)) {
    const name = t.replace(/^env:\\?/i, '');
    return { kind: 'env', name, exists: true, win: `Env:\\${name}` };
  }
  const regBase = w.location && !/^[A-Za-z]:/.test(t) && !/^~/.test(t) ? w.location : null;
  if (isRegistryPath(t) || regBase) {
    const p = parseRegPath(t, regBase);
    if (p) return { kind: 'reg', hive: p.hive, parts: p.parts, exists: !!findKey(game, p.hive, p.parts), win: driveName(p.hive, p.parts).replace(/\\$/, '\\') };
  }
  const r = resolveWindows(game, t);
  return { kind: 'fs', path: r.path, exists: r.exists, win: toWindows(r.path) };
}

const notFound = (r: Run, cmdlet: string, win: string) =>
  r.fail({ message: `Cannot find path '${win}' because it does not exist.`, category: 'ObjectNotFound', target: `${win}:String`, exception: 'ItemNotFoundException', id: `PathNotFound,Microsoft.PowerShell.Commands.${cmdlet}Command` });

const denied = (r: Run, win: string, id: string, target = `${win}:String`, message = `Access to the path '${win}' is denied.`) =>
  r.fail({ message, category: 'PermissionDenied', target, exception: 'UnauthorizedAccessException', id });

/** The paths a typed path names (a wildcard in its last part: each match); [] if none (an error is given). */
function expand(r: Run, typed: string, cmdlet: string, force = false): Where[] {
  const last = typed.split(/[\\/]/).at(-1) ?? '';
  if (!/[*?]/.test(last)) {
    const w = locate(r.game, typed);
    if (!w.exists) {
      notFound(r, cmdlet, w.win);
      return [];
    }
    return [w];
  }
  const parentTyped = typed.slice(0, typed.length - last.length) || '.';
  const parent = locate(r.game, parentTyped);
  const re = wildcard(last);
  if (parent.kind === 'fs') {
    const node = parent.exists ? r.game.find(parent.path) : null;
    if (node?.type !== 'directory') return [];
    return Object.keys(node.children)
      .filter((n) => re.test(n) && (force || !hidden(n)))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((n) => ({ kind: 'fs', path: `${parent.path === '/' ? '' : parent.path}/${n}`, exists: true, win: toWindows(`${parent.path}/${n}`) }));
  }
  if (parent.kind === 'reg') {
    const k = findKey(r.game, parent.hive, parent.parts);
    return k ? Object.values(k.keys).filter((x) => re.test(x.name)).map((x) => ({ kind: 'reg', hive: parent.hive, parts: [...parent.parts, x.name], exists: true, win: driveName(parent.hive, [...parent.parts, x.name]) })) : [];
  }
  return [];
}

// ——— File objects ———

export function fileItem(game: Shell, path: string, n: Node): PSObject {
  const name = path.split('/').at(-1)!;
  const parent = path.replace(/\/[^/]+$/, '') || '/';
  const dir = n.type === 'directory';
  const mtime = (n as { mtime?: number }).mtime ?? windows(game).clock - 9 * DAY;
  const h = hidden(name);
  const mode = dir ? `d--${h ? 'hs' : '--'}-` : `-a${h ? '-h' : '--'}--`;
  const win = toWindows(path);
  return {
    type: 'FileSystemInfo',
    fullType: dir ? 'System.IO.DirectoryInfo' : 'System.IO.FileInfo',
    group: toWindows(parent),
    text: name,
    props: {
      Mode: mode,
      LastWriteTime: new PSDate(mtime),
      ...(dir ? {} : { Length: game.size(n) }),
      Name: name,
      FullName: win,
      Extension: dir || !name.includes('.') ? '' : name.slice(name.lastIndexOf('.')),
      ...(dir ? { Parent: toWindows(parent).split('\\').filter(Boolean).at(-1) ?? '', Root: `${win.slice(0, 2)}\\` } : { DirectoryName: toWindows(parent), Directory: toWindows(parent) }),
      CreationTime: new PSDate(mtime),
      LastAccessTime: new PSDate(mtime),
      Attributes: dir ? (h ? 'Hidden, System, Directory' : 'Directory') : h ? 'Hidden, Archive' : 'Archive',
      PSPath: `Microsoft.PowerShell.Core\\FileSystem::${win}`,
      PSIsContainer: dir,
    },
  };
}

const sortedChildren = (d: Directory) =>
  Object.entries(d.children).sort(([a, x], [b, y]) => (x.type === y.type ? a.toLowerCase().localeCompare(b.toLowerCase()) : x.type === 'directory' ? -1 : 1));

// ——— Registry objects ———

function keyItem(hive: 'HKLM' | 'HKCU', parts: string[], k: RegKey): PSObject {
  const full = fullName(hive, parts);
  return {
    type: 'RegistryKey',
    fullType: 'Microsoft.Win32.RegistryKey',
    group: fullName(hive, parts.slice(0, -1)),
    text: full,
    data: k,
    props: {
      Name: full,
      Property: Object.keys(k.values),
      SubKeyCount: Object.keys(k.keys).length,
      ValueCount: Object.keys(k.values).length,
      PSChildName: parts.at(-1) ?? full,
      PSPath: `Microsoft.PowerShell.Core\\Registry::${full}`,
      PSParentPath: `Microsoft.PowerShell.Core\\Registry::${fullName(hive, parts.slice(0, -1))}`,
      PSDrive: hive,
      PSProvider: 'Microsoft.PowerShell.Core\\Registry',
    },
  };
}

function propertiesItem(hive: 'HKLM' | 'HKCU', parts: string[], k: RegKey, names?: string[]): PSObject {
  const full = fullName(hive, parts);
  const vals = Object.entries(k.values).filter(([n]) => !names || names.some((x) => wildcard(x).test(n)));
  return {
    type: 'RegistryProperties',
    fullType: 'System.Management.Automation.PSCustomObject',
    props: {
      ...Object.fromEntries(vals.map(([n, v]) => [n === '' ? '(default)' : n, v.kind === 'MultiString' || v.kind === 'Binary' ? v.data : v.data])),
      PSPath: `Microsoft.PowerShell.Core\\Registry::${full}`,
      PSParentPath: `Microsoft.PowerShell.Core\\Registry::${fullName(hive, parts.slice(0, -1))}`,
      PSChildName: parts.at(-1) ?? full,
      PSDrive: hive,
      PSProvider: 'Microsoft.PowerShell.Core\\Registry',
    },
  };
}

const keyPropertyText = (k: RegKey) => {
  const entries = Object.entries(k.values);
  if (!entries.length) return '';
  const w = Math.max(...entries.map(([n]) => (n || '(default)').length));
  return entries.map(([n, v]) => `${(n || '(default)').padEnd(w)} : ${valueText(v)}`).join('\n');
};

// ——— Permissions and space ———

/** The owner of what this account creates: the Administrators group for an administrator (Windows Server's default). */
export function creatorOwner(game: Shell, user = game.who): string {
  if (user === 'SYSTEM') return 'NT AUTHORITY\\SYSTEM';
  const ids = token(game, user);
  if (ids.has('BUILTIN\\Administrators')) return 'BUILTIN\\Administrators';
  return [...ids].find((x) => x.toLowerCase().endsWith(`\\${user.toLowerCase()}`)) ?? user;
}

/** Puts a new node in its parent, owned by its creator (permissions inherited), if the parent has permissions. */
function placeNode(game: Shell, parentPath: string, name: string, n: Node): void {
  const parent = game.find(parentPath) as Directory;
  if (descriptor(game, parentPath)) n.acl = { owner: creatorOwner(game), aces: [] };
  parent.children[name] = n;
}

const letterOf = (path: string) => path.split('/').filter(Boolean)[0] ?? 'C';

const noSpace = (cmdlet: string): Failure => ({ message: 'There is not enough space on the disk.', category: 'NotSpecified', target: ':', exception: 'IOException', id: `System.IO.IOException,Microsoft.PowerShell.Commands.${cmdlet}Command` });

/** Writes a file's text (Set-Content, Add-Content, Out-File, >): a Failure, or null. */
export function writeFile(game: Shell, path: string, content: string, append: boolean, cmdlet: string): Failure | null {
  const win = toWindows(path);
  const node = game.find(path);
  const parentPath = path.replace(/\/[^/]+$/, '') || '/';
  const parent = game.find(parentPath);
  if (node?.type === 'directory')
    return { message: `Access to the path '${win}' is denied.`, category: 'PermissionDenied', target: `${win}:String`, exception: 'UnauthorizedAccessException', id: `GetContentWriterUnauthorizedAccessError,Microsoft.PowerShell.Commands.${cmdlet}Command` };
  if (parent?.type !== 'directory')
    return { message: `Could not find a part of the path '${win}'.`, category: 'ObjectNotFound', target: `${toWindows(parentPath)}:String`, exception: 'DirectoryNotFoundException', id: `GetContentWriterDirectoryNotFoundError,Microsoft.PowerShell.Commands.${cmdlet}Command` };
  const allowedWrite = node ? canNtfs(game, path, append ? 'append' : 'write') : canNtfs(game, parentPath, 'write');
  if (!allowedWrite)
    return { message: `Access to the path '${win}' is denied.`, category: 'PermissionDenied', target: `${win}:String`, exception: 'UnauthorizedAccessException', id: `GetContentWriterUnauthorizedAccessError,Microsoft.PowerShell.Commands.${cmdlet}Command` };
  const old = node?.type === 'file' ? (game.read(path) ?? '') : '';
  const text = append && old ? `${old.replace(/\r?\n$/, '')}\r\n${content}` : content;
  const grow = text.length - (node ? game.size(node) : 0);
  if (grow > volumeFree(game, letterOf(path))) return noSpace(cmdlet);
  if (node?.type === 'file') {
    node.content = text;
    delete node.size;
    delete node.onDisk;
    node.mtime = windows(game).clock;
  } else placeNode(game, parentPath, path.split('/').at(-1)!, { type: 'file', content: text, lines: true, mtime: windows(game).clock });
  return null;
}

/** Out-File and >: the formatted output to a file. */
export function outFile(game: Shell, typed: string, content: string, append: boolean): Failure | null {
  const w = resolveWindows(game, typed);
  return writeFile(game, w.path, content.replace(/^\n+/, ''), append, 'OutFile');
}

// ——— Cmdlets ———

function getChildItem(r: Run): unknown[] {
  const { game, p } = r;
  const out: unknown[] = [];
  const paths = arr(p.Path).length ? arr(p.Path) : arr(p.LiteralPath).length ? arr(p.LiteralPath) : ['.'];
  const filter = p.Filter ? wildcard(str(p.Filter)) : null;
  const include = arr(p.Include).map(wildcard);
  const exclude = arr(p.Exclude).map(wildcard);
  const force = !!p.Force;
  const depth = p.Depth !== undefined ? Number(p.Depth) : p.Recurse ? Infinity : 0;
  for (const typed of paths) {
    const last = typed.split(/[\\/]/).at(-1) ?? '';
    const wild = /[*?]/.test(last);
    const where = locate(game, wild ? typed.slice(0, typed.length - last.length) || '.' : typed);
    if (where.kind === 'env') {
      const env = environmentOf(game);
      const re = where.name ? wildcard(where.name) : null;
      out.push(...Object.entries(env).filter(([k]) => !re || re.test(k)).sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase())).map(([k, v]) => envItem(k, v)));
      continue;
    }
    if (where.kind === 'reg') {
      const k = findKey(game, where.hive, where.parts);
      if (!k) {
        notFound(r, 'GetChildItem', where.win);
        continue;
      }
      const re = wild ? wildcard(last) : null;
      const walk = (parts: string[], key: RegKey, level: number) => {
        for (const sub of Object.values(key.keys).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))) {
          const kp = [...parts, sub.name];
          const full = findKey(game, where.hive, kp) ?? sub;
          if (!re || level > 0 || re.test(sub.name)) out.push(keyItem(where.hive, kp, full));
          if (level < depth) walk(kp, full, level + 1);
        }
      };
      walk(where.parts, k, 0);
      continue;
    }
    const node = where.exists ? game.find(where.path) : null;
    if (!node) {
      notFound(r, 'GetChildItem', where.win);
      continue;
    }
    if (node.type === 'file') {
      if (!canNtfs(game, where.path.replace(/\/[^/]+$/, '') || '/', 'list') && !canNtfs(game, where.path, 'read')) {
        denied(r, where.win, 'ItemExistsUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetChildItemCommand');
        continue;
      }
      out.push(fileItem(game, where.path, node));
      continue;
    }
    const pattern = wild ? wildcard(last) : null;
    const walk = (path: string, d: Directory, level: number, rel: string) => {
      if (!canNtfs(game, path || '/', 'list')) {
        denied(r, toWindows(path || '/'), 'DirUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetChildItemCommand');
        return;
      }
      const kids = sortedChildren(d).filter(([n]) => force || !hidden(n));
      for (const [n, c] of kids) {
        if ((pattern && level === 0 && !pattern.test(n)) || (filter && !filter.test(n))) continue;
        if ((include.length && !include.some((x) => x.test(n))) || exclude.some((x) => x.test(n))) continue;
        if ((p.File && c.type !== 'file') || (p.Directory && c.type !== 'directory')) continue;
        out.push(p.Name ? `${rel}${n}` : fileItem(game, `${path}/${n}`, c));
      }
      if (level >= depth) return;
      for (const [n, c] of kids) if (c.type === 'directory' && (!pattern || level > 0 || pattern.test(n))) walk(`${path}/${n}`, c, level + 1, `${rel}${n}\\`);
    };
    walk(where.path === '/' ? '' : where.path, node, 0, '');
  }
  return out;
}

const environmentOf = (game: Shell): Record<string, string> => ENV_HOOK.get?.(game) ?? {};
/** The interpreter gives the environment (commands/powershell.ts). */
export const ENV_HOOK: { get: ((game: Shell) => Record<string, string>) | null } = { get: null };
const envItem = (k: string, v: string): PSObject => ({ type: 'EnvEntry', fullType: 'System.Collections.DictionaryEntry', props: { Name: k, Value: v, Key: k } });

function getItem(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const typed of arr(r.p.Path)) {
    for (const w of expand(r, typed, 'GetItem', !!r.p.Force)) {
      if (w.kind === 'env') {
        const env = environmentOf(r.game);
        const k = Object.keys(env).find((x) => x.toLowerCase() === w.name.toLowerCase());
        if (k === undefined) notFound(r, 'GetItem', w.win);
        else out.push(envItem(k, env[k]));
      } else if (w.kind === 'reg') out.push(keyItem(w.hive, w.parts, findKey(r.game, w.hive, w.parts)!));
      else {
        const n = r.game.find(w.path)!;
        out.push(fileItem(r.game, w.path, n));
      }
    }
  }
  return out;
}

function getContent(r: Run): unknown[] {
  const { game, p } = r;
  const out: unknown[] = [];
  for (const typed of arr(p.Path)) {
    const ws = expand(r, typed, 'GetContent');
    for (const where of ws) {
      if (where.kind === 'env') {
        out.push(environmentOf(game)[Object.keys(environmentOf(game)).find((k) => k.toLowerCase() === where.name.toLowerCase()) ?? ''] ?? '');
        continue;
      }
      if (where.kind === 'reg') {
        r.fail({ message: 'The method or operation is not implemented.', category: 'NotSpecified', target: ':', exception: 'NotImplementedException', id: 'System.NotImplementedException,Microsoft.PowerShell.Commands.GetContentCommand' });
        continue;
      }
      const n = game.find(where.path)!;
      if (n.type === 'directory' || !canNtfs(game, where.path, 'read')) {
        denied(r, where.win, 'GetContentReaderUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetContentCommand');
        continue;
      }
      const raw = (game.read(where.path) ?? '').replace(/\r\n/g, '\n');
      if (p.Raw) {
        out.push(raw);
        continue;
      }
      let lines = raw.split('\n');
      if (lines.length > 1 && lines.at(-1) === '') lines.pop();
      if (p.TotalCount !== undefined) lines = lines.slice(0, Number(p.TotalCount));
      if (p.Tail !== undefined) lines = Number(p.Tail) === 0 ? [] : lines.slice(-Number(p.Tail));
      out.push(...lines);
    }
  }
  return out;
}

/** The text a content cmdlet writes: -Value, or what came through the pipe (one line per object). */
const contentOf = (r: Run) => (r.p.Value !== undefined ? values(r.p.Value) : (r.input ?? [])).map((x) => (isObject(x) ? text(x) : text(x))).join('\r\n');

function setContent(r: Run, append: boolean): unknown[] {
  const cmdlet = append ? 'AddContent' : 'SetContent';
  for (const typed of arr(r.p.Path)) {
    const w = locate(r.game, typed);
    if (w.kind !== 'fs') {
      r.fail({ message: 'The method or operation is not implemented.', category: 'NotSpecified', target: ':', exception: 'NotImplementedException', id: `System.NotImplementedException,Microsoft.PowerShell.Commands.${cmdlet}Command` });
      continue;
    }
    if (!r.should(append ? 'Add Content' : 'Set Content', `Path: ${w.win}`)) continue;
    const f = writeFile(r.game, w.path, contentOf(r), append, cmdlet);
    if (f) r.fail(f);
  }
  return [];
}

function newItem(r: Run): unknown[] {
  const { game, p } = r;
  const type = str(p.ItemType).toLowerCase();
  const out: unknown[] = [];
  const paths = arr(p.Path).length ? arr(p.Path) : ['.'];
  for (const base of paths) {
    const typed = p.Name !== undefined ? `${base.replace(/[\\/]+$/, '')}\\${str(p.Name)}` : base;
    const w = locate(game, typed);
    if (w.kind === 'reg') {
      if (w.exists && !p.Force) {
        r.fail({ message: `A key at this path already exists.`, category: 'ResourceExists', target: `${fullName(w.hive, w.parts)}:String`, exception: 'IOException', id: 'System.IO.IOException,Microsoft.PowerShell.Commands.NewItemCommand' });
        continue;
      }
      if (!r.should('New Item', `Item: ${fullName(w.hive, w.parts)}`)) continue;
      let k: RegKey | null = null;
      for (let i = 1; i <= w.parts.length; i++) {
        const exists = findKey(game, w.hive, w.parts.slice(0, i));
        if (exists) k = exists;
        else if (i === w.parts.length || p.Force) k = createKey(game, w.hive, w.parts.slice(0, i));
        else k = null;
        if (!k) break;
      }
      if (!k) {
        notFound(r, 'NewItem', driveName(w.hive, w.parts.slice(0, -1)));
        continue;
      }
      if (p.Value !== undefined) writeValue(game, w.hive, w.parts, '', { kind: 'String', data: str(p.Value) });
      out.push(keyItem(w.hive, w.parts, k));
      continue;
    }
    if (w.kind !== 'fs') continue;
    const parentPath = w.path.replace(/\/[^/]+$/, '') || '/';
    const name = w.path.split('/').at(-1)!;
    const dir = type === 'directory' || type === 'container';
    if (w.exists && !(p.Force && !dir && game.find(w.path)?.type === 'file') && !(p.Force && dir)) {
      r.fail({ message: `An item with the specified name ${w.win} already exists.`, category: 'ResourceExists', target: `${w.win}:String`, exception: 'IOException', id: `${dir ? 'DirectoryExist' : 'NewItemIOError'},Microsoft.PowerShell.Commands.NewItemCommand` });
      continue;
    }
    if (type && !['directory', 'container', 'file'].includes(type)) {
      r.fail({ message: `The type is not a known type for the file system. Only "file","directory" or "symboliclink" can be specified.`, category: 'InvalidArgument', target: `${w.win}:String`, exception: 'PSArgumentException', id: 'Argument,Microsoft.PowerShell.Commands.NewItemCommand' });
      continue;
    }
    // Missing parents: created with -Force (and always for a folder, like New-Item -ItemType Directory).
    const parts = parentPath.split('/').filter(Boolean);
    let at = '';
    let ok = true;
    for (const seg of parts) {
      const next = `${at}/${seg}`;
      const n = game.find(next);
      if (!n) {
        if (!p.Force && !dir) {
          r.fail({ message: `Could not find a part of the path '${toWindows(next)}'.`, category: 'WriteError', target: `${toWindows(next)}:String`, exception: 'DirectoryNotFoundException', id: 'NewItemIOError,Microsoft.PowerShell.Commands.NewItemCommand' });
          ok = false;
          break;
        }
        if (!canNtfs(game, at || '/', 'append')) {
          denied(r, toWindows(next), 'CreateDirectoryUnauthorizedAccessError,Microsoft.PowerShell.Commands.NewItemCommand');
          ok = false;
          break;
        }
        placeNode(game, at || '/', seg, { type: 'directory', children: {} });
      }
      at = next;
    }
    if (!ok) continue;
    if (!r.should(dir ? 'Create Directory' : 'Create File', `Destination: ${w.win}`)) continue;
    if (dir) {
      if (game.find(w.path)?.type !== 'directory') {
        if (!canNtfs(game, parentPath, 'append')) {
          denied(r, w.win, 'CreateDirectoryUnauthorizedAccessError,Microsoft.PowerShell.Commands.NewItemCommand');
          continue;
        }
        placeNode(game, parentPath, name, { type: 'directory', children: {}, mtime: windows(game).clock } as Directory);
      }
    } else {
      const f = writeFile(game, w.path, p.Value !== undefined ? str(p.Value) : '', false, 'NewItem');
      if (f) {
        r.fail(f);
        continue;
      }
    }
    out.push(fileItem(game, w.path, game.find(w.path)!));
  }
  return out;
}

function removeItem(r: Run): unknown[] {
  const { game, p } = r;
  for (const typed of arr(p.Path).length ? arr(p.Path) : targetsOf(r)) {
    for (const w of expand(r, typed, 'RemoveItem', !!p.Force)) {
      if (w.kind === 'reg') {
        const k = findKey(game, w.hive, w.parts)!;
        if (Object.keys(k.keys).length && !p.Recurse && !r.confirm('Confirm', `The item at ${w.win} has children and the Recurse parameter was not specified. If you continue, all children will be removed with the item. Are you sure you want to continue?`)) continue;
        if (!r.should('Remove Key', `Item: ${fullName(w.hive, w.parts)}`)) continue;
        removeKey(game, w.hive, w.parts);
        continue;
      }
      if (w.kind !== 'fs') continue;
      const n = game.find(w.path)!;
      const dir = n.type === 'directory';
      if (hidden(w.path.split('/').at(-1)!) && !p.Force) {
        r.fail({ message: `You do not have sufficient access rights to perform this operation.`, category: 'PermissionDenied', target: `${w.win}:${dir ? 'DirectoryInfo' : 'FileInfo'}`, exception: 'IOException', id: `RemoveFileSystemItemUnAuthorizedAccess,Microsoft.PowerShell.Commands.RemoveItemCommand` });
        continue;
      }
      if (dir && Object.keys((n as Directory).children).length && !p.Recurse && !r.confirm('Confirm', `The item at ${w.win} has children and the Recurse parameter was not specified. If you continue, all children will be removed with the item. Are you sure you want to continue?`)) continue;
      if (!r.should(dir ? 'Remove Directory' : 'Remove File', w.win)) continue;
      // Each file below must be deletable too.
      const blocked = (path: string, node: Node): string | null => {
        if (!canNtfs(game, path, 'delete')) return path;
        if (node.type === 'directory') for (const [c, x] of Object.entries(node.children)) {
          const b = blocked(`${path}/${c}`, x);
          if (b) return b;
        }
        return null;
      };
      // A file a running service holds open (its log): "being used by another process".
      const held = heldOpen(game, w.path);
      if (held) {
        r.fail({ message: `Cannot remove item ${held.file}: The process cannot access the file '${held.file}' because it is being used by another process.`, category: 'WriteError', target: `${held.file}:FileInfo`, exception: 'IOException', id: 'RemoveFileSystemItemIOError,Microsoft.PowerShell.Commands.RemoveItemCommand' });
        if (dir) removeAllBut(game, w.path, held.file);
        continue;
      }
      const b = blocked(w.path, n);
      if (b) {
        const bn = game.find(b)!;
        r.fail({ message: `Cannot remove item ${toWindows(b)}: Access to the path '${toWindows(b)}' is denied.`, category: 'PermissionDenied', target: `${toWindows(b)}:${bn.type === 'directory' ? 'DirectoryInfo' : 'FileInfo'}`, exception: 'UnauthorizedAccessException', id: `${bn.type === 'directory' ? 'RemoveFileSystemItemUnAuthorizedAccess' : 'RemoveFileSystemItemUnAuthorizedAccess'},Microsoft.PowerShell.Commands.RemoveItemCommand` });
        continue;
      }
      const parent = game.find(w.path.replace(/\/[^/]+$/, '') || '/') as Directory;
      delete parent.children[w.path.split('/').at(-1)!];
    }
  }
  return [];
}

/** Remove-Item -Recurse of a folder holding an open file: the rest goes, the folder and that file stay. */
function removeAllBut(game: Shell, path: string, keep: string): void {
  const keepLow = keep.toLowerCase();
  const walk = (p: string, d: Directory): boolean => {
    let kept = false;
    for (const [c, x] of Object.entries(d.children)) {
      const child = `${p}/${c}`;
      const win = toWindows(child).toLowerCase();
      if (win === keepLow) kept = true;
      else if (x.type === 'directory' && keepLow.startsWith(`${win}\\`)) kept = walk(child, x) || kept;
      else if (canNtfs(game, child, 'delete')) delete d.children[c];
    }
    return kept;
  };
  const n = game.find(path);
  if (n?.type === 'directory') walk(path, n);
}

const targetsOf = (r: Run) => (r.input ?? []).map((x) => (isObject(x) ? text(x.props.FullName ?? x.props.PSPath ?? x.props.Name) : text(x)));

/** A copy of a node: new permissions (inherited at the destination), owned by who copies. */
function copyNode(n: Node): Node {
  if (n.type === 'file') {
    const { acl: _acl, ...rest } = n as File;
    void _acl;
    return { ...rest };
  }
  const { acl: _acl, ...rest } = n as Directory;
  void _acl;
  return { ...rest, children: Object.fromEntries(Object.entries(n.children).map(([k, c]) => [k, copyNode(c)])) } as Directory;
}

function copyOrMove(r: Run, move: boolean): unknown[] {
  const { game, p } = r;
  const cmdlet = move ? 'MoveItem' : 'CopyItem';
  const dest = locate(game, str(p.Destination) || '.');
  const out: unknown[] = [];
  for (const typed of arr(p.Path).length ? arr(p.Path) : targetsOf(r)) {
    for (const w of expand(r, typed, cmdlet, !!p.Force)) {
      if (w.kind !== 'fs' || dest.kind !== 'fs') continue;
      const n = game.find(w.path)!;
      const name = w.path.split('/').at(-1)!;
      const destNode = dest.exists ? game.find(dest.path) : null;
      const into = destNode?.type === 'directory';
      const target = into ? `${dest.path === '/' ? '' : dest.path}/${name}` : dest.path;
      const targetParent = target.replace(/\/[^/]+$/, '') || '/';
      const tp = game.find(targetParent);
      const win = toWindows(target);
      if (tp?.type !== 'directory') {
        r.fail({ message: `Could not find a part of the path '${win}'.`, category: 'WriteError', target: `${w.win}:String`, exception: 'DirectoryNotFoundException', id: `${move ? 'MoveDirectoryItemIOError' : 'CopyFileInfoItemIOError'},Microsoft.PowerShell.Commands.${cmdlet}Command` });
        continue;
      }
      if (!r.should(move ? (n.type === 'directory' ? 'Move Directory' : 'Move File') : n.type === 'directory' ? 'Copy Directory' : 'Copy File', `Item: ${w.win} Destination: ${win}`)) continue;
      // Reading the source, writing the destination.
      const unreadable = (path: string, node: Node): string | null => {
        if (!canNtfs(game, path, node.type === 'directory' ? 'list' : 'read')) return path;
        if (node.type === 'directory' && move) for (const [c, x] of Object.entries(node.children)) {
          const u = unreadable(`${path}/${c}`, x);
          if (u) return u;
        }
        return null;
      };
      const u = unreadable(w.path, n);
      if (u) {
        denied(r, toWindows(u), `${move ? 'MoveFileInfoItemUnauthorizedAccessError' : n.type === 'directory' ? 'CopyDirectoryInfoItemUnauthorizedAccessError' : 'CopyFileInfoItemUnauthorizedAccessError'},Microsoft.PowerShell.Commands.${cmdlet}Command`);
        continue;
      }
      if (!canNtfs(game, targetParent, n.type === 'directory' ? 'append' : 'write') || (game.find(target) && !canNtfs(game, target, 'write'))) {
        denied(r, win, `${move ? 'MoveFileInfoItemUnauthorizedAccessError' : 'CopyFileInfoItemUnauthorizedAccessError'},Microsoft.PowerShell.Commands.${cmdlet}Command`);
        continue;
      }
      const held = move ? heldOpen(game, w.path) : null;
      if (held) {
        r.fail({ message: `The process cannot access the file because it is being used by another process.`, category: 'WriteError', target: `${w.win}:${n.type === 'directory' ? 'DirectoryInfo' : 'FileInfo'}`, exception: 'IOException', id: 'MoveFileInfoItemIOError,Microsoft.PowerShell.Commands.MoveItemCommand' });
        continue;
      }
      if (move && !canNtfs(game, w.path, 'delete')) {
        denied(r, w.win, `MoveFileInfoItemUnauthorizedAccessError,Microsoft.PowerShell.Commands.${cmdlet}Command`);
        continue;
      }
      const existing = game.find(target);
      // Copy-Item -Recurse of a folder: what can be read is copied (into the existing folder, if any),
      // each item it can't read is a non-terminating error of its own.
      if (!move && n.type === 'directory' && p.Recurse) {
        copyTree(r, w.path, n as Directory, targetParent, target.split('/').at(-1)!);
        if (p.PassThru) out.push(fileItem(game, target, game.find(target)!));
        continue;
      }
      if (existing && move && !p.Force) {
        r.fail({ message: `Cannot create a file when that file already exists.`, category: 'WriteError', target: `${w.win}:FileInfo`, exception: 'IOException', id: 'MoveFileInfoItemIOError,Microsoft.PowerShell.Commands.MoveItemCommand' });
        continue;
      }
      const sameVolume = letterOf(w.path) === letterOf(target);
      if (!(move && sameVolume) && game.size(n) - (existing ? game.size(existing) : 0) > volumeFree(game, letterOf(target))) {
        r.fail(noSpace(cmdlet));
        continue;
      }
      const copy: Node = move ? n : n.type === 'directory' && !p.Recurse ? ({ type: 'directory', children: {} } as Directory) : copyNode(n);
      if (move) {
        const parent = game.find(w.path.replace(/\/[^/]+$/, '') || '/') as Directory;
        delete parent.children[name];
        (game.find(targetParent) as Directory).children[target.split('/').at(-1)!] = copy;
      } else {
        placeNode(game, targetParent, target.split('/').at(-1)!, copy);
        // Below the copied folder, each new node belongs to who copied.
        const own = (x: Node) => {
          if (x !== copy && descriptor(game, targetParent)) x.acl = { owner: creatorOwner(game), aces: [] };
          if (x.type === 'directory') Object.values(x.children).forEach(own);
        };
        own(copy);
      }
      if (p.PassThru) out.push(fileItem(game, target, copy));
    }
  }
  return out;
}

/** Copies a readable tree into a folder (merging with what is there), skipping, with an error each, what it can't read. */
function copyTree(r: Run, src: string, d: Directory, parentPath: string, name: string): void {
  const game = r.game;
  const id = (dir: boolean) => `${dir ? 'CopyDirectoryInfoItemUnauthorizedAccessError' : 'CopyFileInfoItemUnauthorizedAccessError'},Microsoft.PowerShell.Commands.CopyItemCommand`;
  // What it will write, to check the space first.
  const readable = (path: string, x: Node): number => {
    if (x.type === 'file') return canNtfs(game, path, 'read') ? game.size(x) : 0;
    if (!canNtfs(game, path, 'list')) return 0;
    return Object.entries(x.children).reduce((sum, [c, y]) => sum + readable(`${path}/${c}`, y), 0);
  };
  const dest = `${parentPath === '/' ? '' : parentPath}/${name}`;
  const already = game.find(dest);
  if (readable(src, d) - (already ? game.size(already) : 0) > volumeFree(game, letterOf(dest))) {
    r.fail(noSpace('CopyItem'));
    return;
  }
  const walk = (from: string, dir: Directory, toParent: string, toName: string) => {
    const to = `${toParent === '/' ? '' : toParent}/${toName}`;
    let target = game.find(to);
    if (target?.type !== 'directory') {
      placeNode(game, toParent, toName, { type: 'directory', children: {} } as Directory);
      target = game.find(to)!;
    }
    for (const [c, x] of Object.entries(dir.children)) {
      const path = `${from}/${c}`;
      if (!canNtfs(game, path, x.type === 'directory' ? 'list' : 'read')) {
        denied(r, toWindows(path), id(x.type === 'directory'));
        continue;
      }
      if (x.type === 'directory') walk(path, x, to, c);
      else {
        const { acl: _acl, ...rest } = x as File;
        void _acl;
        placeNode(game, to, c, { ...rest });
      }
    }
  };
  walk(src, d, parentPath, name);
}

function renameItem(r: Run): unknown[] {
  const { game, p } = r;
  const w = locate(game, str(p.Path));
  if (!w.exists) {
    notFound(r, 'RenameItem', w.win);
    return [];
  }
  if (w.kind !== 'fs') return [];
  const newName = str(p.NewName).split(/[\\/]/).at(-1)!;
  const parentPath = w.path.replace(/\/[^/]+$/, '') || '/';
  const parent = game.find(parentPath) as Directory;
  const target = `${parentPath === '/' ? '' : parentPath}/${newName}`;
  if (game.find(target) && newName.toLowerCase() !== w.path.split('/').at(-1)!.toLowerCase()) {
    r.fail({ message: 'Cannot create a file when that file already exists.', category: 'WriteError', target: `${w.win}:String`, exception: 'IOException', id: 'RenameItemIOError,Microsoft.PowerShell.Commands.RenameItemCommand' });
    return [];
  }
  if (!canNtfs(game, w.path, 'delete')) {
    denied(r, w.win, 'RenameItemUnauthorizedAccessError,Microsoft.PowerShell.Commands.RenameItemCommand');
    return [];
  }
  if (!r.should(game.find(w.path)!.type === 'directory' ? 'Rename Directory' : 'Rename File', `Item: ${w.win} Destination: ${toWindows(target)}`)) return [];
  const n = parent.children[w.path.split('/').at(-1)!];
  delete parent.children[w.path.split('/').at(-1)!];
  parent.children[newName] = n;
  return p.PassThru ? [fileItem(game, target, n)] : [];
}

function testPath(r: Run): unknown[] {
  return arr(r.p.Path).map((typed) => {
    if (/[*?]/.test(typed)) {
      const quiet = { ...r, fail: () => {} } as Run;
      return expand(quiet, typed, 'TestPath', true).length > 0;
    }
    const w = locate(r.game, typed);
    if (!w.exists || w.kind === 'env') return w.kind === 'env' ? Object.keys(environmentOf(r.game)).some((k) => k.toLowerCase() === w.name.toLowerCase()) : false;
    const type = str(r.p.PathType).toLowerCase();
    if (w.kind === 'reg') return type !== 'leaf';
    const n = r.game.find(w.path)!;
    return type === 'leaf' ? n.type === 'file' : type === 'container' ? n.type === 'directory' : true;
  });
}

function setLocation(r: Run): unknown[] {
  const { game, p } = r;
  const typed = str(p.Path) || '~';
  const w = locate(game, typed);
  const win = windows(game);
  if (w.kind === 'reg') {
    if (!w.exists) {
      notFound(r, 'SetLocation', w.win);
      return [];
    }
    win.location = driveName(w.hive, w.parts);
    return [];
  }
  if (w.kind !== 'fs') return [];
  const n = w.exists ? game.find(w.path) : null;
  if (n?.type !== 'directory') {
    notFound(r, 'SetLocation', w.win);
    return [];
  }
  if (!canNtfs(game, w.path, 'execute') && !canNtfs(game, w.path, 'list')) {
    denied(r, w.win, 'SetLocationUnauthorizedAccess,Microsoft.PowerShell.Commands.SetLocationCommand');
    return [];
  }
  game.old = game.cwd;
  game.cwd = w.path;
  win.location = null;
  return p.PassThru ? [{ type: 'PathInfo', props: { Path: w.win }, text: w.win }] : [];
}

const here = (game: Shell) => windows(game).location ?? toWindows(game.cwd);

function getItemProperty(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const typed of arr(r.p.Path)) {
    for (const w of expand(r, typed, 'GetItemProperty')) {
      if (w.kind === 'fs') {
        out.push(fileItem(r.game, w.path, r.game.find(w.path)!));
        continue;
      }
      if (w.kind !== 'reg') continue;
      const k = findKey(r.game, w.hive, w.parts)!;
      const names = arr(r.p.Name);
      if (names.length && names.some((n) => !/[*?]/.test(n) && !Object.keys(k.values).some((v) => v.toLowerCase() === n.toLowerCase()))) {
        const missing = names.find((n) => !Object.keys(k.values).some((v) => v.toLowerCase() === n.toLowerCase()))!;
        r.fail({ message: `Property ${missing} does not exist at path ${fullName(w.hive, w.parts)}.`, category: 'InvalidArgument', target: `${missing}:String`, exception: 'PSArgumentException', id: 'System.Management.Automation.PSArgumentException,Microsoft.PowerShell.Commands.GetItemPropertyCommand' });
        continue;
      }
      out.push(propertiesItem(w.hive, w.parts, k, names.length ? names : undefined));
    }
  }
  return out;
}

function getItemPropertyValue(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const typed of arr(r.p.Path)) {
    const w = locate(r.game, typed);
    if (w.kind !== 'reg' || !w.exists) {
      notFound(r, 'GetItemPropertyValue', w.win);
      continue;
    }
    const k = findKey(r.game, w.hive, w.parts)!;
    for (const n of arr(r.p.Name)) {
      const v = Object.entries(k.values).find(([x]) => x.toLowerCase() === n.toLowerCase());
      if (!v) r.fail({ message: `Property ${n} does not exist at path ${fullName(w.hive, w.parts)}.`, category: 'InvalidArgument', target: `${n}:String`, exception: 'PSArgumentException', id: 'System.Management.Automation.PSArgumentException,Microsoft.PowerShell.Commands.GetItemPropertyValueCommand' });
      else out.push(v[1].data);
    }
  }
  return out;
}

const KINDS: Record<string, RegKind> = { string: 'String', expandstring: 'ExpandString', dword: 'DWord', qword: 'QWord', multistring: 'MultiString', binary: 'Binary', reg_sz: 'String', reg_expand_sz: 'ExpandString', reg_dword: 'DWord', reg_qword: 'QWord', reg_multi_sz: 'MultiString', reg_binary: 'Binary' };

function regValue(kind: RegKind, v: unknown): RegValue {
  if (kind === 'DWord' || kind === 'QWord') return { kind, data: Number(Array.isArray(v) ? v[0] : v) || 0 };
  if (kind === 'MultiString') return { kind, data: values(v).map(text) };
  if (kind === 'Binary') return { kind, data: values(v).map((x) => Number(x) || 0) };
  return { kind, data: text(v) };
}

function setItemProperty(r: Run, create: boolean): unknown[] {
  const out: unknown[] = [];
  const cmdlet = create ? 'NewItemProperty' : 'SetItemProperty';
  for (const typed of arr(r.p.Path)) {
    const w = locate(r.game, typed);
    if (!w.exists) {
      notFound(r, cmdlet, w.win);
      continue;
    }
    if (w.kind !== 'reg') {
      r.fail({ message: `The property ${str(r.p.Name)} cannot be found on this object.`, category: 'InvalidArgument', target: ':', exception: 'PSArgumentException', id: `System.Management.Automation.PSArgumentException,Microsoft.PowerShell.Commands.${cmdlet}Command` });
      continue;
    }
    const k = findKey(r.game, w.hive, w.parts)!;
    const name = str(r.p.Name);
    const existing = Object.entries(k.values).find(([n]) => n.toLowerCase() === name.toLowerCase());
    if (create && existing && !r.p.Force) {
      r.fail({ message: 'The property already exists.', category: 'ResourceExists', target: `${fullName(w.hive, w.parts)}:String`, exception: 'IOException', id: 'System.IO.IOException,Microsoft.PowerShell.Commands.NewItemPropertyCommand' });
      continue;
    }
    const typedKind = str(r.p.PropertyType ?? r.p.Type).toLowerCase();
    if (typedKind && !KINDS[typedKind]) {
      r.fail({ message: `Cannot bind parameter '${create ? 'PropertyType' : 'Type'}'. Cannot convert value "${typedKind}" to type "Microsoft.Win32.RegistryValueKind".`, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: `CannotConvertArgumentNoMessage,Microsoft.PowerShell.Commands.${cmdlet}Command` });
      continue;
    }
    const kind = KINDS[typedKind] ?? existing?.[1].kind ?? (typeof r.p.Value === 'number' && !create ? 'DWord' : 'String');
    if (!r.should(create ? 'New Property' : 'Set Property', `Item: ${fullName(w.hive, w.parts)} Property: ${name}`)) continue;
    writeValue(r.game, w.hive, w.parts, name, regValue(kind, r.p.Value));
    const after = findKey(r.game, w.hive, w.parts)!;
    if (create || r.p.PassThru) out.push(propertiesItem(w.hive, w.parts, after, [name]));
  }
  return out;
}

function removeItemProperty(r: Run): unknown[] {
  for (const typed of arr(r.p.Path)) {
    const w = locate(r.game, typed);
    if (w.kind !== 'reg' || !w.exists) {
      notFound(r, 'RemoveItemProperty', w.win);
      continue;
    }
    for (const n of arr(r.p.Name)) {
      if (!r.should('Remove Property', `Item: ${fullName(w.hive, w.parts)} Property: ${n}`)) continue;
      if (!removeValue(r.game, w.hive, w.parts, n))
        r.fail({ message: `Property ${n} does not exist at path ${fullName(w.hive, w.parts)}.`, category: 'InvalidArgument', target: `${n}:String`, exception: 'PSArgumentException', id: 'System.Management.Automation.PSArgumentException,Microsoft.PowerShell.Commands.RemoveItemPropertyCommand' });
    }
  }
  return [];
}

function pushLocation(r: Run): unknown[] {
  ((r.game.state.psLocations ??= []) as string[]).push(here(r.game));
  return r.p.Path !== undefined ? setLocation(r) : [];
}

function popLocation(r: Run): unknown[] {
  const stack = (r.game.state.psLocations ??= []) as string[];
  const to = stack.pop();
  if (to === undefined) return [];
  return setLocation({ ...r, p: { Path: to } });
}

function outFileCmdlet(r: Run): unknown[] {
  const typed = str(r.p.FilePath);
  if (!r.should('Output to File', typed)) return [];
  const f = outFile(r.game, typed, RENDER.fn ? RENDER.fn(r.input ?? []) : (r.input ?? []).map(text).join('\n'), !!r.p.Append);
  if (f) r.fail(f);
  return [];
}
// ——— CSV: Export-Csv, ConvertTo-Csv, Import-Csv (Windows PowerShell 5.1) ———
// Sources: https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1,
// import-csv and convertto-csv (same module, 5.1): a #TYPE line unless
// -NoTypeInformation, the first object's properties as the header, every
// value in double quotes (a null one left empty), a comma by default.

/** An object's CSV type name (#TYPE Selected.Microsoft.ActiveDirectory.Management.ADAccount). */
const csvType = (x: unknown) => (isObject(x) ? (x.type.startsWith('Selected.') ? x.type : (x.fullType ?? x.type)) : typeof x === 'number' ? 'System.Int32' : 'System.String');

/** The CSV lines of objects: the header from the first one, a value per column. */
function csvLines(items: unknown[], delimiter: string, typeInfo: boolean): string[] {
  if (!items.length) return [];
  const first = items[0];
  const columns = isObject(first) ? Object.keys(first.props) : typeof first === 'string' ? ['Length'] : [];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const t = Array.isArray(v) ? 'System.Object[]' : text(v);
    return `"${t.replace(/"/g, '""')}"`;
  };
  const value = (x: unknown, k: string) => (isObject(x) ? x.props[Object.keys(x.props).find((p) => p.toLowerCase() === k.toLowerCase()) ?? k] : k === 'Length' && typeof x === 'string' ? x.length : undefined);
  return [...(typeInfo ? [`#TYPE ${csvType(first)}`] : []), columns.map((c) => `"${c}"`).join(delimiter), ...items.map((x) => columns.map((c) => cell(value(x, c))).join(delimiter))];
}

/** -Delimiter, or a comma (-UseCulture: the en-US list separator, a comma too). */
const delimiterOf = (r: Run) => (r.p.Delimiter !== undefined ? str(r.p.Delimiter).slice(0, 1) || ',' : ',');

function exportCsv(r: Run): unknown[] {
  const typed = r.p.Path !== undefined || r.p.LiteralPath !== undefined ? str(r.p.Path ?? r.p.LiteralPath) : r.read('Path: ', false);
  const items = r.input ?? (r.p.InputObject !== undefined ? values(r.p.InputObject) : []);
  const where = resolveWindows(r.game, typed);
  if (r.p.NoClobber && where.exists && !r.p.Append) {
    r.fail({ message: `The file '${toWindows(where.path)}' already exists.`, category: 'ResourceExists', target: `${toWindows(where.path)}:String`, exception: 'IOException', id: 'NoClobber,Microsoft.PowerShell.Commands.ExportCsvCommand' });
    return [];
  }
  if (!r.should('Export-Csv', toWindows(where.path))) return [];
  const appending = !!r.p.Append && where.exists && (r.game.read(where.path) ?? '').trim() !== '';
  // -Append to a file that has its header: only the rows (the columns of the file's header).
  let lines = csvLines(items, delimiterOf(r), !r.p.NoTypeInformation && !appending);
  if (appending) lines = lines.filter((l) => !l.startsWith('#TYPE')).slice(1);
  const f = writeFile(r.game, where.path, lines.join('\r\n') + (lines.length ? '\r\n' : ''), appending, 'ExportCsv');
  if (f) r.fail(f);
  return [];
}

/** Splits a CSV line (quotes, doubled quotes inside). */
function csvSplit(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** The objects a CSV's text describes (Import-Csv, ConvertFrom-Csv): strings, the #TYPE line read as the type's name. */
export function csvObjects(content: string, delimiter = ','): PSObject[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines[0]?.startsWith('#TYPE ')) lines.shift();
  if (!lines.length) return [];
  const header = csvSplit(lines.shift()!, delimiter).map((h, i) => h || `H${i + 1}`);
  return lines.map((l) => {
    const cells = csvSplit(l, delimiter);
    return { type: 'PSCustomObject', fullType: 'System.Management.Automation.PSCustomObject', props: Object.fromEntries(header.map((h, i) => [h, cells[i] ?? null])) } satisfies PSObject;
  });
}

function importCsv(r: Run): unknown[] {
  const out: unknown[] = [];
  for (const typed of arr(r.p.Path ?? r.p.LiteralPath)) {
    const where = resolveWindows(r.game, typed);
    const node = r.game.find(where.path);
    if (node?.type !== 'file') {
      r.fail({ message: `Could not find file '${toWindows(where.path)}'.`, category: 'OpenError', target: ':', exception: 'FileNotFoundException', id: 'FileOpenFailure,Microsoft.PowerShell.Commands.ImportCsvCommand' });
      continue;
    }
    const objects = csvObjects(r.game.read(where.path) ?? '', delimiterOf(r));
    if (r.p.Header !== undefined) {
      const header = arr(r.p.Header);
      const all = csvObjects([header.map((h) => `"${h}"`).join(delimiterOf(r)), ...(r.game.read(where.path) ?? '').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#TYPE'))].join('\n'), delimiterOf(r));
      out.push(...all);
    } else out.push(...objects);
  }
  return out;
}

/** Out-Default's rendering (given by the interpreter). */
export const RENDER: { fn: ((items: unknown[]) => string) | null } = { fn: null };

const PATH: Cmdlet['params'][number] = { name: 'Path', list: true, aliases: ['PSPath', 'FullName'] };

export const FILE_CMDLETS: Cmdlet[] = [
  {
    name: 'Get-ChildItem', module: MGMT, version: '3.1.0.0', positional: ['Path', 'Filter'],
    params: [PATH, { name: 'LiteralPath', list: true }, { name: 'Filter', type: 'System.String' }, { name: 'Include', list: true }, { name: 'Exclude', list: true }, { name: 'Recurse', switch: true, aliases: ['s'] }, { name: 'Depth', type: 'System.UInt32' }, { name: 'Force', switch: true }, { name: 'Name', switch: true }, { name: 'File', switch: true }, { name: 'Directory', switch: true, aliases: ['ad'] }, { name: 'Hidden', switch: true }],
    run: getChildItem,
  },
  { name: 'Get-Item', module: MGMT, version: '3.1.0.0', positional: ['Path'], params: [PATH, { name: 'Force', switch: true }], run: getItem },
  {
    name: 'Get-Content', module: MGMT, version: '3.1.0.0', positional: ['Path'],
    params: [PATH, { name: 'TotalCount', aliases: ['First', 'Head'], type: 'System.Int64' }, { name: 'Tail', aliases: ['Last'], type: 'System.Int32' }, { name: 'Raw', switch: true }, { name: 'Encoding', type: 'Microsoft.PowerShell.Commands.FileSystemCmdletProviderEncoding' }],
    run: getContent,
  },
  { name: 'Set-Content', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Value'], params: [PATH, { name: 'Value', list: true, type: 'System.Object[]' }, { name: 'Encoding', type: 'Microsoft.PowerShell.Commands.FileSystemCmdletProviderEncoding' }, { name: 'Force', switch: true }, { name: 'NoNewline', switch: true }], run: (r) => setContent(r, false) },
  { name: 'Add-Content', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Value'], params: [PATH, { name: 'Value', list: true, type: 'System.Object[]' }, { name: 'Encoding', type: 'Microsoft.PowerShell.Commands.FileSystemCmdletProviderEncoding' }, { name: 'Force', switch: true }], run: (r) => setContent(r, true) },
  {
    name: 'New-Item', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path'],
    params: [PATH, { name: 'Name', type: 'System.String' }, { name: 'ItemType', aliases: ['Type'], type: 'System.String' }, { name: 'Value', type: 'System.Object' }, { name: 'Force', switch: true }],
    run: newItem,
  },
  { name: 'Remove-Item', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path'], params: [PATH, { name: 'Recurse', switch: true, aliases: ['r'] }, { name: 'Force', switch: true }, { name: 'Include', list: true }, { name: 'Exclude', list: true }], run: removeItem },
  { name: 'Copy-Item', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Destination'], params: [PATH, { name: 'Destination', type: 'System.String' }, { name: 'Recurse', switch: true }, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }], run: (r) => copyOrMove(r, false) },
  { name: 'Move-Item', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Destination'], params: [PATH, { name: 'Destination', type: 'System.String' }, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }], run: (r) => copyOrMove(r, true) },
  { name: 'Rename-Item', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'NewName'], params: [{ name: 'Path', type: 'System.String', aliases: ['PSPath'] }, { name: 'NewName', type: 'System.String' }, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }], run: renameItem },
  { name: 'Test-Path', module: MGMT, version: '3.1.0.0', positional: ['Path'], params: [PATH, { name: 'PathType', type: 'Microsoft.PowerShell.Commands.TestPathType' }, { name: 'IsValid', switch: true }], run: testPath },
  { name: 'Set-Location', module: MGMT, version: '3.1.0.0', positional: ['Path'], params: [{ name: 'Path', type: 'System.String' }, { name: 'PassThru', switch: true }], run: setLocation },
  { name: 'Get-Location', module: MGMT, version: '3.1.0.0', params: [], run: ({ game }) => [{ type: 'PathInfo', props: { Path: here(game) }, text: here(game) }] },
  { name: 'Push-Location', module: MGMT, version: '3.1.0.0', positional: ['Path'], params: [{ name: 'Path', type: 'System.String' }], run: pushLocation },
  { name: 'Pop-Location', module: MGMT, version: '3.1.0.0', params: [], run: popLocation },
  { name: 'Get-ItemProperty', module: MGMT, version: '3.1.0.0', positional: ['Path', 'Name'], params: [PATH, { name: 'Name', list: true }], run: getItemProperty },
  { name: 'Get-ItemPropertyValue', module: MGMT, version: '3.1.0.0', positional: ['Path', 'Name'], params: [PATH, { name: 'Name', list: true }], run: getItemPropertyValue },
  { name: 'Set-ItemProperty', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Name', 'Value'], params: [PATH, { name: 'Name', type: 'System.String' }, { name: 'Value', type: 'System.Object' }, { name: 'Type', type: 'Microsoft.Win32.RegistryValueKind' }, { name: 'PassThru', switch: true }, { name: 'Force', switch: true }], run: (r) => setItemProperty(r, false) },
  { name: 'New-ItemProperty', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Name'], params: [PATH, { name: 'Name', type: 'System.String' }, { name: 'Value', type: 'System.Object' }, { name: 'PropertyType', aliases: ['Type'], type: 'System.String' }, { name: 'Force', switch: true }], run: (r) => setItemProperty(r, true) },
  { name: 'Remove-ItemProperty', module: MGMT, version: '3.1.0.0', writes: true, positional: ['Path', 'Name'], params: [PATH, { name: 'Name', list: true }, { name: 'Force', switch: true }], run: removeItemProperty },
  { name: 'Export-Csv', module: 'Microsoft.PowerShell.Utility', version: '3.1.0.0', writes: true, positional: ['Path', 'Delimiter'], params: [{ name: 'Path', type: 'System.String' }, { name: 'LiteralPath', type: 'System.String' }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }, { name: 'Delimiter', type: 'System.Char' }, { name: 'NoTypeInformation', switch: true, aliases: ['NTI'] }, { name: 'Append', switch: true }, { name: 'Force', switch: true }, { name: 'NoClobber', switch: true, aliases: ['NoOverwrite'] }, { name: 'Encoding', type: 'System.String' }, { name: 'UseCulture', switch: true }], run: exportCsv },
  { name: 'ConvertTo-Csv', module: 'Microsoft.PowerShell.Utility', version: '3.1.0.0', positional: ['InputObject', 'Delimiter'], params: [{ name: 'InputObject', type: 'System.Management.Automation.PSObject' }, { name: 'Delimiter', type: 'System.Char' }, { name: 'NoTypeInformation', switch: true, aliases: ['NTI'] }, { name: 'UseCulture', switch: true }], run: (r) => csvLines(r.input ?? values(r.p.InputObject), delimiterOf(r), !r.p.NoTypeInformation) },
  { name: 'Import-Csv', module: 'Microsoft.PowerShell.Utility', version: '3.1.0.0', positional: ['Path', 'Delimiter'], params: [{ name: 'Path', list: true, type: 'System.String[]' }, { name: 'LiteralPath', list: true, type: 'System.String[]' }, { name: 'Delimiter', type: 'System.Char' }, { name: 'Header', list: true, type: 'System.String[]' }, { name: 'Encoding', type: 'System.String' }, { name: 'UseCulture', switch: true }], run: importCsv },
  { name: 'Out-File', module: 'Microsoft.PowerShell.Utility', version: '3.1.0.0', writes: true, positional: ['FilePath'], params: [{ name: 'FilePath', type: 'System.String', aliases: ['Path'] }, { name: 'Append', switch: true }, { name: 'Encoding', type: 'System.String' }, { name: 'Force', switch: true }], run: outFileCmdlet },
];

export const FILE_VIEWS: Record<string, View> = {
  FileSystemInfo: {
    group: (o) => `    Directory: ${o.group}`,
    columns: [
      { label: 'Mode', value: (o) => o.props.Mode },
      { label: 'LastWriteTime', value: (o) => shortDate((o.props.LastWriteTime as PSDate).ms), right: true },
      { label: 'Length', value: (o) => o.props.Length ?? null, right: true },
      { label: 'Name', value: (o) => o.props.Name },
    ],
    listProps: (o) => (o.props.PSIsContainer ? ['Name', 'CreationTime', 'LastWriteTime', 'LastAccessTime', 'Mode'] : ['Name', 'Length', 'CreationTime', 'LastWriteTime', 'LastAccessTime', 'Mode']),
  },
  RegistryKey: {
    group: (o) => `    Hive: ${o.group}`,
    columns: [
      { label: 'Name', value: (o) => o.props.PSChildName, width: 30 },
      { label: 'Property', value: (o) => keyPropertyText(o.data as RegKey), wrap: true },
    ],
  },
  EnvEntry: { columns: [{ label: 'Name', value: (o) => o.props.Name, width: 30 }, { label: 'Value', value: (o) => o.props.Value }] },
};

// ——— reg.exe ———

const regError = (message = 'ERROR: The system was unable to find the specified registry key or value.') => ({ out: '', err: message, code: 1 });

/** reg query KEY [/v NAME] [/s], reg add KEY [/v NAME] [/t TYPE] [/d DATA] [/f], reg delete KEY [/v NAME] [/f]. */
function reg(game: Shell, args: string[]) {
  const [op, keyText, ...rest] = args;
  const flag = (f: string) => rest.findIndex((a) => a.toLowerCase() === f);
  const value = (f: string) => (flag(f) >= 0 ? rest[flag(f) + 1] : undefined);
  if (!op || op === '/?') return { out: game.t('reg-usage'), code: 0 };
  if (!registry(game)) return regError();
  const p = keyText ? parseRegPath(keyText.replace(/^\\\\[^\\]+\\/, '')) : null;
  if (!p) return regError('ERROR: Invalid key name.\nType "REG ' + op.toUpperCase() + ' /?" for usage.');
  const full = fullName(p.hive, p.parts);
  switch (op.toLowerCase()) {
    case 'query': {
      const k = findKey(game, p.hive, p.parts);
      if (!k) return regError();
      const name = value('/v');
      const line = (n: string, v: RegValue) => `    ${n || '(Default)'}    ${REG_TYPE[v.kind]}    ${valueText(v, true)}`;
      if (name !== undefined) {
        const v = Object.entries(k.values).find(([n]) => n.toLowerCase() === name.toLowerCase());
        if (!v) return regError();
        return { out: `\n${full}\n${line(v[0], v[1])}\n`, code: 0 };
      }
      const out: string[] = [''];
      const walk = (parts: string[], key: RegKey) => {
        out.push(fullName(p.hive, parts), ...Object.entries(key.values).map(([n, v]) => line(n, v)), '');
        for (const sub of Object.values(key.keys)) {
          if (flag('/s') >= 0) walk([...parts, sub.name], findKey(game, p.hive, [...parts, sub.name]) ?? sub);
          else out.push(fullName(p.hive, [...parts, sub.name]));
        }
      };
      walk(p.parts, k);
      return { out: out.join('\n'), code: 0 };
    }
    case 'add': {
      let k = findKey(game, p.hive, p.parts);
      if (!k) for (let i = 1; i <= p.parts.length; i++) k = findKey(game, p.hive, p.parts.slice(0, i)) ?? createKey(game, p.hive, p.parts.slice(0, i));
      if (!k) return regError('ERROR: Access is denied.');
      const name = value('/v');
      if (name !== undefined || value('/d') !== undefined) {
        const kind = KINDS[(value('/t') ?? 'REG_SZ').toLowerCase()];
        if (!kind) return regError(`ERROR: Invalid syntax.\nType "REG ADD /?" for usage.`);
        writeValue(game, p.hive, p.parts, name ?? '', regValue(kind, kind === 'MultiString' ? (value('/d') ?? '').split('\\0') : (value('/d') ?? '')));
      }
      return { out: 'The operation completed successfully.', code: 0 };
    }
    case 'delete': {
      const name = value('/v');
      if (name !== undefined) return removeValue(game, p.hive, p.parts, name) ? { out: 'The operation completed successfully.', code: 0 } : regError();
      return removeKey(game, p.hive, p.parts) ? { out: 'The operation completed successfully.', code: 0 } : regError();
    }
  }
  return regError(`ERROR: Invalid syntax.\nType "REG /?" for usage.`);
}

// ——— compact.exe: NTFS compression ———

// How much NTFS compression (LZNT1) shrinks a text log, and anything else (already compressed).
const TEXT_RATIO = 6.7;
const thousands = (n: number) => n.toLocaleString('en-US');

/**
 * compact [/c | /u] [/s[:DIR]] [/i] [/q] [FILES]: compresses (/c) or
 * uncompresses (/u) files, or lists their state. A text log shrinks about
 * 6.7 to 1, a zip or a picture hardly at all; a file a service holds open
 * can't be compressed ([ERR], the error stops unless /i). The file keeps
 * its Length: only the space it takes on the volume changes.
 * Source: https://learn.microsoft.com/windows-server/administration/windows-commands/compact
 */
function compact(game: Shell, args: string[]) {
  const flag = (f: string) => args.some((a) => a.toLowerCase() === f);
  const sub = args.find((a) => /^\/s(:|$)/i.test(a));
  const bad = args.find((a) => a.startsWith('/') && !/^\/(c|u|s(:.*)?|i|q|f|a)$/i.test(a));
  if (bad) return { out: '', err: `Invalid parameter - ${bad.slice(1)}`, code: 1 };
  const mode = flag('/c') ? 'c' : flag('/u') ? 'u' : 'list';
  const specs = args.filter((a) => !a.startsWith('/'));
  const base = sub && sub.includes(':') ? sub.slice(3) : '.';
  const groups: { dir: string; files: [string, File][] }[] = [];
  for (const spec of specs.length ? specs : ['*']) {
    const typed = /[\\/]/.test(spec) || /^[A-Za-z]:/.test(spec) ? spec : `${base}\\${spec}`;
    const last = typed.split(/[\\/]/).at(-1) ?? '*';
    const where = resolveWindows(game, typed);
    const isDir = where.exists && game.find(where.path)?.type === 'directory';
    const dirPath = isDir ? where.path : resolveWindows(game, typed.slice(0, typed.length - last.length) || '.').path;
    const re = wildcard(isDir ? '*' : last);
    const walk = (path: string) => {
      const d = game.find(path);
      if (d?.type !== 'directory') return;
      groups.push({ dir: path, files: Object.entries(d.children).filter(([n, c]) => c.type === 'file' && re.test(n)).map(([n, c]) => [n, c as File]) });
      if (sub) for (const [n, c] of Object.entries(d.children)) if (c.type === 'directory') walk(`${path}/${n}`);
    };
    walk(dirPath);
  }
  const out: string[] = [];
  let files = 0;
  let dirs = 0;
  let total = 0;
  let stored = 0;
  const ratio = (a: number, b: number) => (b ? (a / b).toFixed(1) : '1.0');
  for (const g of groups) {
    out.push('', ` ${mode === 'c' ? 'Compressing files in' : mode === 'u' ? 'Uncompressing files in' : 'Listing'} ${toWindows(g.dir)}\\`, '');
    dirs++;
    for (const [name, f] of g.files) {
      const path = `${g.dir}/${name}`;
      const size = game.size(f);
      if (mode !== 'list') {
        const held = heldOpen(game, path);
        if (held || !canNtfs(game, path, 'write')) {
          out.push(`${name} [ERR]`, `${toWindows(path)}: ${held ? 'The process cannot access the file because it is being used by another process.' : 'Access is denied.'}`);
          if (!flag('/i')) return { out: out.join('\n'), code: 1 };
          continue;
        }
        if (mode === 'c') f.onDisk = Math.ceil(size / (f.lines ? TEXT_RATIO : 1.02));
        else delete f.onDisk;
      }
      const disk = f.onDisk ?? size;
      files++;
      total += size;
      stored += disk;
      if (mode === 'list') out.push(`${String(size).padStart(15)} : ${String(disk).padStart(15)} = ${ratio(size, disk)} to 1 ${f.onDisk !== undefined ? 'C' : ' '} ${name}`);
      else if (!flag('/q')) out.push(`${name.padEnd(28)} ${String(size).padStart(12)} : ${String(disk).padStart(12)} = ${ratio(size, disk)} to 1 [OK]`);
    }
  }
  const verb = mode === 'c' ? 'compressed' : mode === 'u' ? 'uncompressed' : null;
  out.push('', verb ? `${files} files within ${dirs} directories were ${verb}.` : `Of ${files} files within ${dirs} directories`, ...(verb ? [] : [`${groups.flatMap((g) => g.files).filter(([, f]) => f.onDisk !== undefined).length} are compressed and ${groups.flatMap((g) => g.files).filter(([, f]) => f.onDisk === undefined).length} are not compressed.`]), `${thousands(total)} total bytes of data are stored in ${thousands(stored)} bytes.`, `The compression ratio is ${ratio(total, stored)} to 1.`);
  return { out: out.join('\n'), code: 0 };
}

export const FILE_NATIVES: Native[] = [
  { name: 'reg.exe', page: 'reg', run: (game, args) => reg(game, args) },
  { name: 'compact.exe', page: 'compact', run: (game, args) => compact(game, args) },
];
