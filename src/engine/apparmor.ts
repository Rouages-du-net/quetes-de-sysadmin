// AppArmor on a Debian 13 machine (apparmor 4.1.0-1): the profiles of
// /etc/apparmor.d read like apparmor_parser reads them, the policy loaded in
// the kernel (state.apparmor), what each process is confined by, the
// decision on a file access, an exec or a capability, and the audit lines
// the kernel writes for it (apparmor="DENIED" in enforce mode, "ALLOWED" in
// complain mode) to its log (dmesg, journalctl -k) or, when auditd runs, to
// /var/log/audit/audit.log.
// What the game reads of a profile: abi, include (<…> and "…", `if exists`,
// a directory includes its files), variables (@{VAR}=, +=), the profile's
// header (profile NAME ATTACHMENT flags=(…) {, or ATTACHMENT {), file rules
// ([audit] [deny] [owner] [file] PATH MODE, or MODE PATH), capability rules;
// the other rules (network, signal, unix, dbus, mount, change_profile,
// userns…) are read and accepted without effect; hats and subprofiles are
// listed by aa-status but not entered.
// Globbing (apparmor.d(5), "Globbing"): * (anything but /, at least one
// character for a whole path component), ** (anything, / included), ?,
// [abc], {a,b}, @{VAR}.
// A profile is attached when a program is executed (its path matches the
// attachment): a running process keeps the profile it had, and a profile
// replaced (apparmor_parser -r) changes for the processes it confines; a
// profile removed leaves them unconfined, and a profile added later doesn't
// reach them until they are executed again (a service restarted).
// Sources: apparmor.d(5), apparmor_parser(8), aa-status(8) and
// binutils/aa_status.c, https://apparmor.net,
// https://gitlab.com/apparmor/apparmor/-/wikis/QuickProfileLanguage,
// https://wiki.debian.org/AppArmor/HowToUse (apparmor 4.1.0, Debian trixie).

import type { Game, Shell } from './shell';
import type { Directory, File, Node } from './world';
import { content } from './tools';
import { kernel } from './memory';
import { systemd, writeLog } from './systemd';

export const DIR = '/etc/apparmor.d';
export const AUDIT_LOG = '/var/log/audit/audit.log';
export type Mode = 'enforce' | 'complain' | 'unconfined' | 'kill' | 'prompt';
export const MODES: Mode[] = ['enforce', 'complain', 'prompt', 'kill', 'unconfined'];
// The directories of /etc/apparmor.d that hold no profile (apparmor.systemd skips them).
const NOT_PROFILES = ['abi', 'abstractions', 'tunables', 'local', 'disable', 'force-complain', 'cache', 'apache2.d'];

export interface FileRule {
  glob: string;
  re: RegExp;
  // The access letters (r w a l k m) and the exec mode (ix, px, ux, cx… or x in a deny rule).
  perms: string;
  exec: string | null;
  owner: boolean;
  deny: boolean;
  audit: boolean;
}
export interface Profile {
  name: string;
  attach: string | null;
  attachRe: RegExp | null;
  flags: string[];
  files: FileRule[];
  caps: { name: string; deny: boolean }[];
  // Subprofiles and hats (name//child), listed by aa-status.
  children: string[];
  // The file it was read from.
  source: string;
}
export interface Loaded extends Profile {
  mode: Mode;
}
export interface Task {
  exe: string;
  comm: string;
  // The profile it is confined by (its name), or null: unconfined.
  label: string | null;
}
export interface AppArmor {
  profiles: Record<string, Loaded>;
  tasks: Record<number, Task>;
  // The audit records' serial number.
  serial: number;
  // auditd installed and running: the records go to audit.log (and the journal), not to the kernel's log.
  auditd: boolean;
  // Every decision recorded, for the story (what was denied or allowed, when).
  records: AuditRecord[];
}
export interface AuditRecord {
  at: number;
  kind: 'DENIED' | 'ALLOWED' | 'STATUS';
  operation: string;
  profile: string;
  name: string;
  mask: string;
  pid: number;
  comm: string;
  fsuid: number;
  ouid: number;
  capname?: string;
  // The line as written (after "audit(…): ").
  text: string;
}

export const apparmor = (j: Game): AppArmor => (j.state.apparmor ??= { profiles: {}, tasks: {}, serial: 100, auditd: false, records: [] });

// ——— Globbing ———

/** The values of the variables a profile set reads (@{HOME}, @{PROC}…). */
export type Variables = Record<string, string[]>;

/** @{VAR} replaced by {value1,value2}, recursively. */
export function expandVariables(text: string, vars: Variables, depth = 0): string {
  if (depth > 8) return text;
  return text.replace(/@\{([A-Za-z_][\w]*)\}/g, (all, name: string) => {
    const v = vars[name];
    if (!v) return all;
    const each = v.map((x) => expandVariables(x, vars, depth + 1));
    return each.length === 1 ? each[0] : `{${each.join(',')}}`;
  });
}

/** {a,b} alternatives spelled out, nested ones too ([a,b] is a character class, not an alternative). */
export function expandBraces(glob: string): string[] {
  let depth = 0;
  let open = -1;
  let inClass = false;
  const commas: number[] = [];
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (c === ',' && depth === 1) commas.push(i);
    else if (c === '}' && depth > 0) {
      depth--;
      if (depth > 0) continue;
      const cuts = [open, ...commas, i];
      const out: string[] = [];
      for (let k = 0; k < cuts.length - 1; k++) out.push(...expandBraces(glob.slice(0, open) + glob.slice(cuts[k] + 1, cuts[k + 1]) + glob.slice(i + 1)));
      return out;
    }
  }
  return [glob];
}

/** An AppArmor path glob (variables already expanded) → a regular expression; repeated slashes count as one. */
export function globToRegex(glob: string): RegExp {
  const alternatives = [...new Set(expandBraces(glob).map((g) => g.replace(/\/{2,}/g, '/')))];
  return new RegExp('^(?:' + alternatives.map(oneGlob).join('|') + ')$');
}

function oneGlob(glob: string): string {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const prev = glob[i - 1];
    if (c === '*') {
      const double = glob[i + 1] === '*';
      if (double) i++;
      const next = glob[i + 1];
      // A whole path component (after / and up to / or the end): at least one character.
      const whole = prev === '/' && (next === undefined || next === '/');
      if (double) re += whole ? '[^/].*' : '.*';
      else re += whole ? '[^/]+' : '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = glob.indexOf(']', i + 1);
      if (end < 0) re += '\\[';
      else {
        re += '[' + glob.slice(i + 1, end).replace(/^\^/, '^').replace(/\\/g, '\\\\') + ']';
        i = end;
      }
    } else if (c === '\\' && i + 1 < glob.length) re += '\\' + glob[++i];
    else re += c.replace(/[.+^$()|{}\\/]/g, '\\$&');
  }
  return re;
}

// ——— Reading a profile file ———

interface Line {
  text: string;
  file: string;
  line: number;
}
export interface ParseError {
  file: string;
  line: number;
  message: string;
}
export interface Parsed {
  profiles: Profile[];
  error: ParseError | null;
}

type Reader = (path: string) => string | null;
type Lister = (path: string) => string[] | null;

/** The world's files as the parser reads them (as root). */
export function readerOf(game: Shell): { read: Reader; list: Lister } {
  return {
    read: (p) => {
      const n = game.find(p);
      return n?.type === 'file' ? content(n, game) : null;
    },
    list: (p) => {
      const n = game.find(p);
      return n?.type === 'directory' ? Object.keys(n.children).sort() : null;
    },
  };
}

/** A comment: # not followed by include (the old #include form). */
const stripComment = (l: string) => {
  const m = /(^|\s)#(?!include\b)/.exec(l);
  return (m ? l.slice(0, m.index) : l).trim();
};

const INCLUDE = /^#?include\s+(if\s+exists\s+)?(?:<([^>]+)>|"([^"]+)")\s*$/;

/** The file's lines with its includes put in place (each line keeps its file and number). */
function expand(file: string, io: { read: Reader; list: Lister }, depth = 0): { lines: Line[]; error: ParseError | null } {
  const text = io.read(file);
  if (text === null) return { lines: [], error: { file, line: 0, message: `Could not open '${file}'` } };
  const lines: Line[] = [];
  const raw = text.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const l = stripComment(raw[i]);
    const inc = INCLUDE.exec(l);
    if (!inc) {
      if (l) lines.push({ text: l, file, line: i + 1 });
      continue;
    }
    const optional = !!inc[1];
    const target = inc[2] ? `${DIR}/${inc[2]}` : inc[3].startsWith('/') ? inc[3] : `${file.slice(0, file.lastIndexOf('/'))}/${inc[3]}`;
    const children = io.list(target);
    const targets = children ? children.map((c) => `${target}/${c}`) : io.read(target) !== null ? [target] : null;
    if (!targets) {
      if (optional) continue;
      return { lines, error: { file, line: i + 1, message: `Could not open '${inc[2] ?? inc[3]}'` } };
    }
    if (depth > 20) return { lines, error: { file, line: i + 1, message: 'Exceeded maximum include recursion depth' } };
    for (const t of targets) {
      const sub = expand(t, io, depth + 1);
      lines.push(...sub.lines);
      if (sub.error) return { lines, error: sub.error };
    }
  }
  return { lines, error: null };
}

const OTHER_RULES = /^(network|signal|ptrace|unix|dbus|mount|remount|umount|pivot_root|change_profile|change_hat|userns|mqueue|io_uring|set\s+rlimit|rlimit|all|link)\b/;
const EXEC = /(?:[pPcC][iuU]?|[iuU])x/;

/** A mode (rw, ix, mrk…): its letters and its exec part, or the parser's complaint. */
export function readMode(mode: string, deny: boolean): { perms: string; exec: string | null } | string {
  if (!/^[rwaklmixpucPUCx]+$/.test(mode)) return 'syntax error, unexpected TOK_ID, expecting TOK_END_OF_RULE';
  const ex = EXEC.exec(mode);
  let rest = ex ? mode.replace(ex[0], '') : mode;
  let exec = ex ? ex[0] : null;
  if (rest.includes('x')) {
    if (!deny) return "Invalid mode, 'x' must be preceded by exec qualifier 'i', 'p', or 'u'";
    rest = rest.replace(/x/g, '');
    exec = 'x';
  }
  if (/[iupcPUC]/.test(rest)) return "Invalid mode, 'x' must be preceded by exec qualifier 'i', 'p', or 'u'";
  if (rest.includes('a') && rest.includes('w')) return "Conflict 'a' and 'w' perms are mutually exclusive.";
  return { perms: [...new Set(rest)].join(''), exec };
}

const HEADER = /^(?:profile\s+(\S+?)(?:\s+((?:\/|@\{)\S*?))?|((?:\/|@\{)\S*?))(?:\s+flags\s*=\s*\(([^)]*)\))?\s*\{$/;

/** Reads a profile file and what it includes (apparmor_parser's view of it). */
export function parseFile(file: string, io: { read: Reader; list: Lister }): Parsed {
  const { lines, error } = expand(file, io);
  const profiles: Profile[] = [];
  if (error) return { profiles, error };
  const vars: Variables = {};
  const fail = (l: Line | undefined, message: string): Parsed => ({ profiles, error: { file: l?.file ?? file, line: l?.line ?? 0, message } });
  let current: Profile | null = null;
  // Nested blocks inside a profile (hats, subprofiles, conditionals): their depth.
  let nested = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.text;
    // A variable: @{NAME}=values or +=.
    const v = /^@\{([A-Za-z_]\w*)\}\s*(\+?=)\s*(.*)$/.exec(t);
    if (v && !current) {
      const values = v[3].split(/\s+/).filter(Boolean).map((x) => x.replace(/^"|"$/g, ''));
      vars[v[1]] = v[2] === '+=' ? [...(vars[v[1]] ?? []), ...values] : values;
      continue;
    }
    if (!current) {
      if (/^abi\s+[<"][^>"]+[>"]\s*,$/.test(t)) continue;
      if (/^alias\s/.test(t)) continue;
      const h = HEADER.exec(t);
      if (h) {
        const name = h[1] ?? h[3];
        const attach = h[2] ?? (h[3] ? h[3] : name.startsWith('/') ? name : null);
        const expanded = attach ? expandVariables(attach, vars) : null;
        current = {
          name,
          attach,
          attachRe: expanded ? globToRegex(expanded) : null,
          flags: (h[4] ?? '').split(/[\s,]+/).filter(Boolean),
          files: [],
          caps: [],
          children: [],
          source: file,
        };
        continue;
      }
      if (/^[/@]\S*\s+[rwaklmixpucPUC]+\s*,?$/.test(t)) return fail(l, 'syntax error, unexpected TOK_MODE, expecting TOK_OPEN');
      return fail(l, 'syntax error, unexpected TOK_ID');
    }
    if (nested > 0) {
      if (t.endsWith('{')) nested++;
      else if (t === '}') nested--;
      continue;
    }
    if (t === '}') {
      profiles.push(current);
      current = null;
      continue;
    }
    if (t.endsWith('{')) {
      const child = /^(?:profile\s+(\S+)|\^(\S+))/.exec(t);
      if (child) current.children.push(`${current.name}//${child[1] ?? child[2]}`);
      nested = 1;
      continue;
    }
    if (!t.endsWith(',')) {
      const next = lines[i + 1];
      return fail(next ?? l, `syntax error, unexpected ${next?.text === '}' ? 'TOK_CLOSE' : next ? 'TOK_ID' : '$end'}, expecting TOK_END_OF_RULE`);
    }
    const rule = t.slice(0, -1).trim();
    // An abstraction names its ABI too, inside the profile it is included in.
    if (/^abi\s+[<"][^>"]+[>"]$/.test(rule)) continue;
    let words = rule.split(/\s+/);
    let audit = false;
    let deny = false;
    let owner = false;
    while (['audit', 'deny', 'allow', 'owner', 'other', 'priority'].includes(words[0]) || /^priority=/.test(words[0])) {
      if (words[0] === 'audit') audit = true;
      if (words[0] === 'deny') deny = true;
      if (words[0] === 'owner') owner = true;
      words = words.slice(1);
    }
    const body = words.join(' ');
    if (/^capability\b/.test(body)) {
      const names = words.slice(1);
      for (const n of names.length ? names : ['ALL']) current.caps.push({ name: n, deny });
      continue;
    }
    if (OTHER_RULES.test(body) || body === '') continue;
    if (words[0] === 'file') words = words.slice(1);
    if (!words.length) continue;
    // PATH MODE [-> target], or MODE PATH.
    let path: string;
    let mode: string;
    if (/^[/@"]/.test(words[0])) {
      path = words[0];
      mode = words[1] ?? '';
    } else if (/^[/@"]/.test(words[1] ?? '')) {
      mode = words[0];
      path = words[1];
    } else return fail(l, 'syntax error, unexpected TOK_ID, expecting TOK_MODE');
    if (!mode) return fail(l, 'syntax error, unexpected TOK_END_OF_RULE, expecting TOK_MODE');
    const m = readMode(mode, deny);
    if (typeof m === 'string') return fail(l, m);
    path = path.replace(/^"|"$/g, '');
    current.files.push({ glob: path, re: globToRegex(expandVariables(path, vars)), perms: m.perms, exec: m.exec, owner, deny, audit });
  }
  if (current) return fail(lines.at(-1), 'syntax error, unexpected $end, expecting TOK_CLOSE');
  return { profiles, error: null };
}

/** The parser's message for an error, as apparmor_parser prints it. */
export const parserMessage = (main: string, e: ParseError) =>
  e.line === 0 ? `File ${main} not found, skipping...` : `AppArmor parser error for ${main} in profile ${e.file} at line ${e.line}: ${e.message}`;

/** The mode a profile's flags give. */
export function modeOf(p: Profile): Mode {
  for (const m of ['complain', 'unconfined', 'kill', 'prompt'] as Mode[]) if (p.flags.includes(m)) return m;
  return 'enforce';
}

/** The profile files of /etc/apparmor.d (its own directories left out), and whether each is disabled. */
export function profileFiles(game: Shell): { path: string; disabled: boolean }[] {
  const dir = game.find(DIR);
  if (dir?.type !== 'directory') return [];
  const disabled = game.find(`${DIR}/disable`);
  const off = disabled?.type === 'directory' ? Object.keys(disabled.children) : [];
  return Object.entries(dir.children)
    .filter(([name, n]) => n.type === 'file' && !NOT_PROFILES.includes(name) && !name.startsWith('.') && !/(~|\.dpkg-\w+)$/.test(name))
    .map(([name]) => ({ path: `${DIR}/${name}`, disabled: off.includes(name) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

// ——— The kernel's policy ———

const secondsOf = (ms: number) => `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}`;

/** An audit record: to the kernel's log, or to auditd's (and the journal through its audit socket). */
export function auditLine(j: Game, r: Omit<AuditRecord, 'at' | 'text'>, fields: string) {
  const a = apparmor(j);
  const sd = systemd(j);
  const at = sd?.clock ?? 0;
  const serial = ++a.serial;
  const stamp = `audit(${secondsOf(at)}:${serial})`;
  a.records.push({ ...r, at, text: fields });
  if (!a.auditd) {
    kernel(j, `audit: type=1400 ${stamp}: ${fields}`);
    return;
  }
  const g = j as Shell;
  const log = g.find(AUDIT_LOG);
  const line = `type=AVC msg=${stamp}: ${fields}`;
  if (log?.type === 'file') {
    const before = content(log, g);
    log.content = before ? `${before}\n${line}` : line;
    log.lines = true;
    delete log.size;
  }
  if (sd) writeLog(sd, '', 'audit', r.pid, `AVC ${fields}`, 5, false);
}

/** Loads (or replaces) a profile in the kernel; the STATUS record the kernel writes. */
export function loadProfile(j: Game, p: Profile, by: { pid: number; complain?: boolean }): 'load' | 'replace' {
  const a = apparmor(j);
  const old = a.profiles[p.name];
  const mode = by.complain ? 'complain' : modeOf(p);
  const replace = !!old;
  a.profiles[p.name] = { ...p, mode };
  for (const c of p.children) a.profiles[c] = { ...p, name: c, attach: null, attachRe: null, children: [], mode };
  const op = replace ? 'profile_replace' : 'profile_load';
  auditLine(j, { kind: 'STATUS', operation: op, profile: 'unconfined', name: p.name, mask: '', pid: by.pid, comm: 'apparmor_parser', fsuid: 0, ouid: 0 }, `apparmor="STATUS" operation="${op}" profile="unconfined" name="${p.name}" pid=${by.pid} comm="apparmor_parser"`);
  return replace ? 'replace' : 'load';
}

/** Removes a profile from the kernel: the processes it confined become unconfined. */
export function removeProfile(j: Game, name: string, pid: number): boolean {
  const a = apparmor(j);
  const p = a.profiles[name];
  if (!p) return false;
  for (const c of [name, ...p.children]) delete a.profiles[c];
  for (const t of Object.values(a.tasks)) if (t.label === name) t.label = null;
  auditLine(j, { kind: 'STATUS', operation: 'profile_remove', profile: 'unconfined', name, mask: '', pid, comm: 'apparmor_parser', fsuid: 0, ouid: 0 }, `apparmor="STATUS" operation="profile_remove" profile="unconfined" name="${name}" pid=${pid} comm="apparmor_parser"`);
  return true;
}

/** The profile a program executed now attaches to (the longest attachment wins, as the kernel's most specific match). */
export function attachFor(j: Game, exe: string): Loaded | null {
  const found = Object.values(apparmor(j).profiles).filter((p) => p.attachRe?.test(exe));
  if (!found.length) return null;
  // A literal attachment beats a glob.
  return found.sort((a, b) => Number(/[*?{[@]/.test(a.attach ?? '')) - Number(/[*?{[@]/.test(b.attach ?? '')) || (b.attach ?? '').length - (a.attach ?? '').length)[0];
}

/** A program is executed: its process takes the profile that attaches to it. */
export function execTask(j: Game, pid: number, exe: string, comm: string): Task {
  const p = attachFor(j, exe);
  const t: Task = { exe, comm, label: p?.name ?? null };
  apparmor(j).tasks[pid] = t;
  return t;
}

export const endTask = (j: Game, pid: number) => delete apparmor(j).tasks[pid];

// ——— Decisions ———

const needs = (mask: string) =>
  [...mask].map((c) => (c === 'c' || c === 'd' ? 'w' : c));

/** What a profile allows for this path: the letters, and the exec modes; owner rules only for the owner. */
export function allowedBy(p: Profile, path: string, isOwner: boolean): { allow: Set<string>; deny: Set<string>; exec: string | null; denyExec: boolean } {
  const allow = new Set<string>();
  const deny = new Set<string>();
  let exec: string | null = null;
  let denyExec = false;
  for (const r of p.files) {
    if (r.owner && !isOwner) continue;
    if (!r.re.test(path)) continue;
    if (r.deny) {
      for (const c of r.perms) deny.add(c);
      if (r.exec) denyExec = true;
    } else {
      for (const c of r.perms) allow.add(c);
      if (r.exec) exec = r.exec;
    }
  }
  return { allow, deny, exec, denyExec };
}

/** Whether a profile allows an access (mask: r, w, c, a, m, k, l, x). */
export function permits(p: Profile, path: string, mask: string, isOwner: boolean): boolean {
  const { allow, deny, exec, denyExec } = allowedBy(p, path, isOwner);
  for (const c of needs(mask)) {
    if (c === 'x') {
      if (denyExec || !exec) return false;
      continue;
    }
    if (deny.has(c)) return false;
    if (c === 'a' ? !(allow.has('a') || allow.has('w')) : !allow.has(c)) return false;
  }
  return true;
}

/** Whether an explicit deny rule covers it (deny rules hold in complain mode too, and stay quiet). */
function denied(p: Profile, path: string, mask: string, isOwner: boolean): boolean {
  const { deny, denyExec } = allowedBy(p, path, isOwner);
  return needs(mask).some((c) => (c === 'x' ? denyExec : deny.has(c)));
}

export const capAllowed = (p: Profile, cap: string) => !p.caps.some((c) => c.deny && (c.name === cap || c.name === 'ALL')) && p.caps.some((c) => !c.deny && (c.name === cap || c.name === 'ALL'));

export interface Access {
  pid: number;
  operation: 'open' | 'mknod' | 'exec' | 'capable' | 'unlink' | 'mkdir';
  path?: string;
  mask?: string;
  fsuid: number;
  ouid?: number;
  cap?: string;
  capnum?: number;
  comm?: string;
}

/** The kernel's decision on an access by a process: true if it may; the audit record when the profile has no rule for it. */
export function check(j: Game, x: Access): boolean {
  const a = apparmor(j);
  const task = a.tasks[x.pid];
  if (!task?.label) return true;
  const p = a.profiles[task.label];
  if (!p || p.mode === 'unconfined') return true;
  const comm = x.comm ?? task.comm;
  if (x.operation === 'capable') {
    const cap = x.cap!;
    const explicitDeny = p.caps.some((c) => c.deny && (c.name === cap || c.name === 'ALL'));
    if (capAllowed(p, cap)) return true;
    if (explicitDeny) return false;
    const kind = p.mode === 'complain' ? 'ALLOWED' : 'DENIED';
    auditLine(
      j,
      { kind, operation: 'capable', profile: p.name, name: '', mask: '', pid: x.pid, comm, fsuid: x.fsuid, ouid: x.fsuid, capname: cap },
      `apparmor="${kind}" operation="capable" class="cap" profile="${p.name}" pid=${x.pid} comm="${comm}" capability=${x.capnum ?? 0}  capname="${cap}"`,
    );
    return p.mode === 'complain';
  }
  const path = x.path!;
  const mask = x.mask!;
  const ouid = x.ouid ?? x.fsuid;
  const isOwner = ouid === x.fsuid;
  if (permits(p, path, mask, isOwner)) return true;
  if (denied(p, path, mask, isOwner)) return false;
  const kind = p.mode === 'complain' ? 'ALLOWED' : 'DENIED';
  auditLine(
    j,
    { kind, operation: x.operation, profile: p.name, name: path, mask, pid: x.pid, comm, fsuid: x.fsuid, ouid },
    `apparmor="${kind}" operation="${x.operation}" class="file" profile="${p.name}" name="${path}" pid=${x.pid} comm="${comm}" requested_mask="${mask}" denied_mask="${mask}" fsuid=${x.fsuid} ouid=${ouid}`,
  );
  return p.mode === 'complain';
}

// ——— Loading the policy from the files ———

/** apparmor.service: every profile of /etc/apparmor.d not disabled (at boot, and on systemctl reload apparmor). */
export function loadAll(game: Shell, pid = 1): string[] {
  const errors: string[] = [];
  const io = readerOf(game);
  for (const { path, disabled } of profileFiles(game)) {
    if (disabled) continue;
    const r = parseFile(path, io);
    if (r.error) {
      errors.push(parserMessage(path, r.error));
      continue;
    }
    for (const p of r.profiles) {
      const old = apparmor(game).profiles[p.name];
      // Already loaded and the same: the kernel skips it (no record).
      if (old && sameProfile(old, p)) continue;
      loadProfile(game, p, { pid });
    }
  }
  return errors;
}

export const sameProfile = (a: Profile & { mode?: Mode }, b: Profile) =>
  a.attach === b.attach &&
  a.flags.join() === b.flags.join() &&
  (a.mode === undefined || a.mode === modeOf(b)) &&
  JSON.stringify(a.files.map((r) => [r.glob, r.perms, r.exec, r.owner, r.deny])) === JSON.stringify(b.files.map((r) => [r.glob, r.perms, r.exec, r.owner, r.deny])) &&
  JSON.stringify(a.caps) === JSON.stringify(b.caps);

/** The profile file (in /etc/apparmor.d) that defines this profile name, or attaches to this program. */
export function fileFor(game: Shell, target: string): { path: string; profile: Profile } | null {
  const io = readerOf(game);
  for (const { path } of profileFiles(game)) {
    const r = parseFile(path, io);
    for (const p of r.profiles) if (p.name === target || p.attachRe?.test(target)) return { path, profile: p };
  }
  return null;
}

// ——— Writing the flags of a profile (aa-complain, aa-enforce: change_profile_flags) ———

/** The file with the header of each profile it defines given these flags (the rest of the file as it was). */
export function withFlags(text: string, change: (flags: string[]) => string[]): string {
  return text
    .split('\n')
    .map((line) => {
      const t = stripComment(line);
      const h = HEADER.exec(t);
      if (!h) return line;
      const indent = /^\s*/.exec(line)![0];
      const flags = change((h[4] ?? '').split(/[\s,]+/).filter(Boolean));
      const head = t.replace(/\s+flags\s*=\s*\([^)]*\)/, '').replace(/\s*\{$/, '');
      return `${indent}${head}${flags.length ? ` flags=(${flags.join(', ')})` : ''} {`;
    })
    .join('\n');
}

// ——— World helpers ———

/** A file of the world (created with its directories) written as root. */
export function writeFile(game: Shell, path: string, text: string, rights: Partial<File> = {}): void {
  const parts = path.split('/').filter(Boolean);
  let n: Node = game.root;
  for (const p of parts.slice(0, -1)) {
    if (n.type !== 'directory') return;
    n = (n.children[p] ??= { type: 'directory', children: {}, owner: 'root' } as Directory);
  }
  if (n.type !== 'directory') return;
  const name = parts.at(-1)!;
  const old = n.children[name];
  if (old?.type === 'file' && old.link === undefined) {
    old.content = text;
    old.lines = true;
    delete old.size;
    return;
  }
  n.children[name] = { type: 'file', content: text, lines: true, owner: 'root', ...rights };
}
