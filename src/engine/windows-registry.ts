// The registry of a Windows machine, as PowerShell's Registry provider and
// reg.exe see it: two hives (HKEY_LOCAL_MACHINE as the drive HKLM:,
// HKEY_CURRENT_USER as HKCU:), keys holding subkeys and values (REG_SZ,
// REG_EXPAND_SZ, REG_DWORD, REG_QWORD, REG_MULTI_SZ, REG_BINARY), names
// compared without case. The services' keys
// (HKLM\SYSTEM\CurrentControlSet\Services\NAME) are read from the services
// themselves, and writing their Start or ObjectName changes the service.
// Sources (Microsoft Learn): about_Registry_Provider
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_registry_provider?view=powershell-5.1),
// "Registry value types" (https://learn.microsoft.com/windows/win32/sysinfo/registry-value-types),
// reg query (https://learn.microsoft.com/windows-server/administration/windows-commands/reg-query),
// "OpenSSH Server configuration for Windows" (HKLM:\SOFTWARE\OpenSSH, DefaultShell).
// Simplifications: one HKCU (the session's user), no permissions on keys,
// no HKCR/HKU/HKCC hives, the services' keys hold only a few values.

import type { Game } from './shell';
import { windows, type WinService } from './windows';

export type RegKind = 'String' | 'ExpandString' | 'DWord' | 'QWord' | 'MultiString' | 'Binary';
export interface RegValue {
  kind: RegKind;
  data: string | number | string[] | number[];
}
export interface RegKey {
  name: string;
  values: Record<string, RegValue>;
  keys: Record<string, RegKey>;
}
export interface Registry {
  HKLM: RegKey;
  HKCU: RegKey;
}

export const HIVES: Record<string, { drive: 'HKLM' | 'HKCU'; full: string }> = {
  hklm: { drive: 'HKLM', full: 'HKEY_LOCAL_MACHINE' },
  hkey_local_machine: { drive: 'HKLM', full: 'HKEY_LOCAL_MACHINE' },
  hkcu: { drive: 'HKCU', full: 'HKEY_CURRENT_USER' },
  hkey_current_user: { drive: 'HKCU', full: 'HKEY_CURRENT_USER' },
};

/** An empty key. */
export const key = (name: string, values: Record<string, RegValue> = {}, keys: RegKey[] = []): RegKey => ({ name, values, keys: Object.fromEntries(keys.map((k) => [k.name, k])) });
export const sz = (data: string): RegValue => ({ kind: 'String', data });
export const dword = (data: number): RegValue => ({ kind: 'DWord', data });
export const expand = (data: string): RegValue => ({ kind: 'ExpandString', data });

export const registry = (game: Game): Registry | null => (windows(game).registry as Registry | undefined) ?? null;

/** A registry path in any of its forms → hive and key names; null if it isn't one. */
export function parseRegPath(typed: string, base?: string | null): { hive: 'HKLM' | 'HKCU'; parts: string[] } | null {
  let p = typed.trim().replace(/\//g, '\\').replace(/^(Microsoft\.PowerShell\.Core\\)?Registry::/i, '');
  // A relative path, from the current registry location.
  if (base && !/^[A-Za-z_]+:/.test(p) && !/^HKEY_/i.test(p) && !/^HK(LM|CU)\\/i.test(p) && !/^[A-Za-z]:/.test(p)) {
    const b = parseRegPath(base);
    if (!b) return null;
    const parts = [...b.parts];
    for (const seg of p.split('\\').filter(Boolean)) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return { hive: b.hive, parts };
  }
  const m = /^([A-Za-z_]+):?(?:\\(.*))?$/.exec(p.replace(/^([A-Za-z_]+):(?!\\)/, '$1:\\'));
  if (!m) return null;
  const hive = HIVES[m[1].toLowerCase()];
  if (!hive) return null;
  const parts: string[] = [];
  for (const seg of (m[2] ?? '').split('\\').filter(Boolean)) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return { hive: hive.drive, parts };
}

/** Is this typed path a registry path (HKLM:\…, Registry::…)? */
export const isRegistryPath = (typed: string) => /^(Microsoft\.PowerShell\.Core\\)?Registry::/i.test(typed.trim()) || /^HK(LM|CU):/i.test(typed.trim());

const SERVICE_START: Record<WinService['start'], number> = { Automatic: 2, Manual: 3, Disabled: 4 };

/** The key of a service, built from the service (HKLM\SYSTEM\CurrentControlSet\Services\NAME). */
function serviceKey(game: Game, s: WinService): RegKey {
  return key(s.name, {
    DisplayName: sz(s.display),
    ...(s.description ? { Description: sz(s.description) } : {}),
    ErrorControl: dword(1),
    ImagePath: expand(s.path ?? '%SystemRoot%\\System32\\svchost.exe -k netsvcs -p'),
    ObjectName: sz(s.account ?? 'LocalSystem'),
    Start: dword(SERVICE_START[s.start]),
    Type: dword(s.process ? 16 : 32),
    ...(s.dependsOn?.length ? { DependOnService: { kind: 'MultiString', data: s.dependsOn } as RegValue } : {}),
  });
}

const findChild = (k: RegKey, name: string) => Object.values(k.keys).find((x) => x.name.toLowerCase() === name.toLowerCase());

/** The key at a path (services' keys built on the fly); null if missing. */
export function findKey(game: Game, hive: 'HKLM' | 'HKCU', parts: string[]): RegKey | null {
  const reg = registry(game);
  if (!reg) return null;
  let k: RegKey = reg[hive];
  for (const [i, seg] of parts.entries()) {
    // The services: their keys come from the Service Control Manager's table.
    if (hive === 'HKLM' && i === 3 && /^system\\currentcontrolset\\services$/i.test(parts.slice(0, 3).join('\\'))) {
      const s = windows(game).services.find((x) => x.name.toLowerCase() === seg.toLowerCase());
      if (!s) return null;
      k = serviceKey(game, s);
      continue;
    }
    const next = findChild(k, seg);
    if (!next) return null;
    k = next;
  }
  if (hive === 'HKLM' && parts.length === 3 && /^system\\currentcontrolset\\services$/i.test(parts.join('\\')))
    return { ...k, keys: { ...k.keys, ...Object.fromEntries(windows(game).services.map((s) => [s.name, serviceKey(game, s)])) } };
  return k;
}

/** A value, read like Get-ItemPropertyValue (undefined if missing). */
export function registryValue(game: Game, path: string, name: string): RegValue['data'] | undefined {
  const p = parseRegPath(path);
  const k = p && findKey(game, p.hive, p.parts);
  if (!k) return undefined;
  const v = Object.entries(k.values).find(([n]) => n.toLowerCase() === name.toLowerCase());
  return v?.[1].data;
}

/** Writes a value (New-ItemProperty, Set-ItemProperty, reg add); a service's Start and ObjectName change the service. */
export function writeValue(game: Game, hive: 'HKLM' | 'HKCU', parts: string[], name: string, value: RegValue): boolean {
  if (hive === 'HKLM' && parts.length === 4 && /^system\\currentcontrolset\\services$/i.test(parts.slice(0, 3).join('\\'))) {
    const s = windows(game).services.find((x) => x.name.toLowerCase() === parts[3].toLowerCase());
    if (!s) return false;
    if (/^start$/i.test(name)) s.start = Number(value.data) === 4 ? 'Disabled' : Number(value.data) === 3 ? 'Manual' : 'Automatic';
    else if (/^objectname$/i.test(name)) s.account = String(value.data);
    else if (/^displayname$/i.test(name)) s.display = String(value.data);
    else if (/^description$/i.test(name)) s.description = String(value.data);
    return true;
  }
  const k = findKey(game, hive, parts);
  if (!k) return false;
  const existing = Object.keys(k.values).find((n) => n.toLowerCase() === name.toLowerCase());
  k.values[existing ?? name] = value;
  return true;
}

/** Creates a key (its parent must exist); returns it, or null. */
export function createKey(game: Game, hive: 'HKLM' | 'HKCU', parts: string[]): RegKey | null {
  const parent = findKey(game, hive, parts.slice(0, -1));
  if (!parent || !parts.length) return null;
  const name = parts.at(-1)!;
  return findChild(parent, name) ?? (parent.keys[name] = key(name));
}

/** Removes a value; false if it wasn't there. */
export function removeValue(game: Game, hive: 'HKLM' | 'HKCU', parts: string[], name: string): boolean {
  const k = findKey(game, hive, parts);
  const existing = k && Object.keys(k.values).find((n) => n.toLowerCase() === name.toLowerCase());
  if (!k || !existing) return false;
  delete k.values[existing];
  return true;
}

/** Removes a key. */
export function removeKey(game: Game, hive: 'HKLM' | 'HKCU', parts: string[]): boolean {
  const parent = findKey(game, hive, parts.slice(0, -1));
  const k = parent && findChild(parent, parts.at(-1)!);
  if (!parent || !k) return false;
  delete parent.keys[k.name];
  return true;
}

/** The full name (HKEY_LOCAL_MACHINE\SOFTWARE\OpenSSH) and the drive form (HKLM:\SOFTWARE\OpenSSH). */
export const fullName = (hive: 'HKLM' | 'HKCU', parts: string[]) => [hive === 'HKLM' ? 'HKEY_LOCAL_MACHINE' : 'HKEY_CURRENT_USER', ...parts].join('\\');
export const driveName = (hive: 'HKLM' | 'HKCU', parts: string[]) => `${hive}:\\${parts.join('\\')}`;

/** reg.exe's type names. */
export const REG_TYPE: Record<RegKind, string> = { String: 'REG_SZ', ExpandString: 'REG_EXPAND_SZ', DWord: 'REG_DWORD', QWord: 'REG_QWORD', MultiString: 'REG_MULTI_SZ', Binary: 'REG_BINARY' };

/** A value as reg query and Get-ItemProperty show it. */
export function valueText(v: RegValue, reg = false): string {
  if (v.kind === 'DWord' || v.kind === 'QWord') return reg ? `0x${Number(v.data).toString(16)}` : String(v.data);
  if (v.kind === 'MultiString') return reg ? (v.data as string[]).join('\\0') : `{${(v.data as string[]).join(', ')}}`;
  if (v.kind === 'Binary') return reg ? (v.data as number[]).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('') : `{${(v.data as number[]).join(', ')}}`;
  return String(v.data);
}
