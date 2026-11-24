// AppArmor's commands, on the model of ../apparmor.ts: aa-status,
// apparmor_parser (-r, -a, -R, -Q, -N, -C, -v, -V), aa-enforce, aa-complain,
// aa-disable, aa-autodep, aa-logprof and aa-genprof (their questions as a
// deterministic subset: Allow, Deny, Ignore, Glob, Glob with Extension, New,
// Owner, Abort, Finish; Inherit, Unconfined and Deny for an exec; Save and
// View for the changes), and the apparmor.d(5) page.
// After apparmor 4.1.0 (Debian trixie): binutils/aa_status.c (its lines and
// exit codes), parser/parser_main.c ("Replacement succeeded for", "Unable to
// replace … Permission denied; attempted to load a profile while
// confined?"), utils/apparmor/tools.py and aa.py ("Setting %s to complain
// mode.", "Disabling %s.", "Profile for %s not found, skipping", "Writing
// updated profile for %s.", "Can't find system log", the disable/ symlink,
// apparmor_parser -r after a mode change), utils/apparmor/ui.py (the menu's
// words), the man pages aa-status(8), apparmor_parser(8), aa-enforce(8),
// aa-complain(8), aa-disable(8), aa-autodep(8), aa-logprof(8),
// aa-genprof(8), apparmor.d(5): https://manpages.debian.org/trixie/apparmor/
// and https://manpages.debian.org/trixie/apparmor-utils/.
// Differences: a question is answered with a letter and Enter (the real
// tools read one key); aa-logprof adds its rules at the end of the profile
// instead of rewriting it in order; the parser's syntax errors are fewer and
// their wording approximated (see docs/SCENARIOS.md).

import type { Shell } from '../shell';
import type { Command } from './index';
import {
  AUDIT_LOG, DIR, MODES, apparmor, globToRegex, fileFor, loadProfile, parseFile, parserMessage, permits, capAllowed, readerOf, removeProfile, withFlags, writeFile, type Mode, type Profile,
} from '../apparmor';
import { systemd } from '../systemd';

const page = { section: 5, launch: () => '' };

const isRoot = (game: Shell) => game.who === 'root';

// ——— aa-status ———

function aaStatus(game: Shell, args: string[]): string {
  const known = ['--enabled', '--profiled', '--enforced', '--complaining', '--kill', '--prompt', '--special-unconfined', '--process-mixed', '--json', '--pretty-json', '--verbose', '--quiet', '--count', '-v', '-q'];
  const bad = args.find((a) => a.startsWith('-') && !known.includes(a) && !/^--show=(profiles|processes|all)$/.test(a) && !/^--filter\./.test(a));
  if (bad) return game.error(`aa-status: unrecognized option '${bad}'\nUsage: aa-status [OPTIONS]\nDisplays various information about the currently loaded AppArmor policy.`, 1);
  // --enabled: only the exit code (0: AppArmor is enabled).
  if (args.includes('--enabled')) return '';
  if (!isRoot(game)) {
    if (!args.includes('--quiet') && !args.includes('-q')) game.error('You do not have enough privilege to read the profile set.');
    game.status = 4;
    return '';
  }
  const a = apparmor(game);
  const profiles = Object.values(a.profiles).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  const byMode = (m: Mode) => profiles.filter((p) => p.mode === m).map((p) => p.name);
  // The processes: those confined, and those unconfined whose program is a profile's name.
  const tasks = Object.entries(a.tasks)
    .map(([pid, t]) => ({ pid: Number(pid), ...t }))
    .sort((x, y) => (x.exe < y.exe ? -1 : x.exe > y.exe ? 1 : x.pid - y.pid));
  const confined = tasks.filter((t) => t.label && a.profiles[t.label]);
  const special = tasks.filter((t) => !t.label && a.profiles[t.exe]);
  const procMode = (m: Mode) => confined.filter((t) => a.profiles[t.label!].mode === m);
  const line = (t: (typeof tasks)[number]) => `   ${t.exe} (${t.pid}) ${t.label === t.exe ? '' : (t.label ?? '')}`.trimEnd();
  const legacy: Record<string, () => number> = {
    '--profiled': () => profiles.length,
    '--enforced': () => byMode('enforce').length,
    '--complaining': () => byMode('complain').length,
    '--kill': () => byMode('kill').length,
    '--prompt': () => byMode('prompt').length,
    '--special-unconfined': () => byMode('unconfined').length,
    '--process-mixed': () => 0,
  };
  const one = args.find((x) => legacy[x]);
  if (one) return String(legacy[one]());
  if (args.includes('--json') || args.includes('--pretty-json')) {
    const data = {
      version: '2',
      profiles: Object.fromEntries(profiles.map((p) => [p.name, p.mode])),
      processes: Object.fromEntries(
        [...new Set([...confined, ...special].map((t) => t.exe))].map((exe) => [exe, [...confined, ...special].filter((t) => t.exe === exe).map((t) => ({ profile: t.label ?? exe, pid: String(t.pid), status: t.label ? a.profiles[t.label].mode : 'unconfined' }))]),
      ),
    };
    return args.includes('--pretty-json') ? JSON.stringify(data, null, '\t') : JSON.stringify(data);
  }
  const show = /^--show=(\w+)$/.exec(args.find((x) => x.startsWith('--show=')) ?? '')?.[1] ?? 'all';
  const out: string[] = ['apparmor module is loaded.'];
  if (show !== 'processes') {
    out.push(`${profiles.length} profiles are loaded.`);
    for (const m of MODES) {
      const names = byMode(m);
      out.push(`${names.length} profiles are in ${m} mode.`, ...names.map((n) => `   ${n}`));
    }
  }
  if (show !== 'profiles') {
    out.push(`${confined.length} processes have profiles defined.`);
    for (const m of ['enforce', 'complain', 'prompt', 'kill'] as Mode[]) {
      const list = procMode(m);
      out.push(`${list.length} processes are in ${m} mode.`, ...list.map(line));
    }
    out.push(`${special.length} processes are unconfined but have a profile defined.`, ...special.map(line));
    out.push('0 processes are in mixed mode.');
  }
  if (args.includes('--count')) return String(show === 'processes' ? confined.length : profiles.length);
  return out.join('\n');
}

// ——— apparmor_parser ———

const PARSER_VERSION = 'AppArmor parser version 4.1.0\nCopyright (C) 1999-2008 Novell Inc.\nCopyright 2009-2018 Canonical Ltd.';

function parser(game: Shell, args: string[]): string {
  let action: 'add' | 'replace' | 'remove' = 'add';
  let verbose = false;
  let skipLoad = false;
  let names = false;
  let complain = false;
  let preprocess = false;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-r' || a === '--replace') action = 'replace';
    else if (a === '-a' || a === '--add') action = 'add';
    else if (a === '-R' || a === '--remove') action = 'remove';
    else if (a === '-v' || a === '--verbose') verbose = true;
    else if (a === '-Q' || a === '--skip-kernel-load' || a === '-S' || a === '--stdout' || a === '-o') skipLoad = true;
    else if (a === '-N' || a === '--names') names = true;
    else if (a === '-C' || a === '--Complain') complain = true;
    else if (a === '-p' || a === '--preprocess') preprocess = true;
    else if (a === '-V' || a === '--version') return PARSER_VERSION;
    else if (['-K', '--skip-cache', '-T', '--skip-read-cache', '-W', '--write-cache', '-k', '--show-cache'].includes(a)) continue;
    else if (a === '-I' || a === '--Include' || a === '-b' || a === '--base' || a === '-L' || a === '--cache-loc' || a === '-M' || a === '--features-file') i++;
    else if (/^-(I|b|L)\S|^--(Include|base|cache-loc|features-file)=/.test(a)) continue;
    else if (/^-[rRaQvNCKTW]{2,}$/.test(a)) {
      for (const c of a.slice(1)) {
        if (c === 'r') action = 'replace';
        if (c === 'R') action = 'remove';
        if (c === 'a') action = 'add';
        if (c === 'Q') skipLoad = true;
        if (c === 'v') verbose = true;
        if (c === 'N') names = true;
        if (c === 'C') complain = true;
      }
    } else if (a.startsWith('-')) return game.error(`apparmor_parser: unrecognized option '${a}'\nUse --help for more information.`, 1);
    else files.push(a);
  }
  if (!files.length) return game.error('apparmor_parser: no input file given (reading the profile from standard input is not simulated)', 1);
  const io = readerOf(game);
  const out: string[] = [];
  let failed = false;
  const before = game.who;
  for (const f of files) {
    const path = game.resolve(f);
    const n = game.find(path);
    if (n?.type === 'directory') {
      game.error(`apparmor_parser: ${path} is a directory: give the profile files themselves`);
      failed = true;
      continue;
    }
    if (n?.type !== 'file' || (before !== 'root' && !game.can(n, 'r'))) {
      game.error(`File ${f} not found, skipping...`);
      failed = true;
      continue;
    }
    const r = parseFile(path, io);
    if (r.error) {
      game.error(parserMessage(path, r.error));
      failed = true;
      continue;
    }
    if (preprocess) {
      out.push(game.read(path) ?? '');
      continue;
    }
    if (names) {
      out.push(...r.profiles.flatMap((p) => [p.name, ...p.children]));
      continue;
    }
    if (skipLoad) continue;
    for (const p of r.profiles) {
      const verb = action === 'remove' ? 'remove' : action === 'add' ? 'add' : 'replace';
      if (!isRoot(game)) {
        game.error(`apparmor_parser: Unable to ${verb} "${p.name}".  Permission denied; attempted to load a profile while confined?`);
        failed = true;
        continue;
      }
      const pid = game.nextPid();
      if (action === 'remove') {
        if (!removeProfile(game, p.name, pid)) {
          game.error(`apparmor_parser: Unable to remove "${p.name}".  Profile doesn't exist`);
          failed = true;
        } else if (verbose) out.push(`Removal succeeded for "${p.name}".`);
        continue;
      }
      if (action === 'add' && apparmor(game).profiles[p.name]) {
        game.error(`apparmor_parser: Unable to add "${p.name}".  Profile already exists`);
        failed = true;
        continue;
      }
      loadProfile(game, p, { pid, complain });
      if (verbose) out.push(`${action === 'add' ? 'Addition' : 'Replacement'} succeeded for "${p.name}".`);
    }
  }
  if (failed) game.status = 1;
  return out.join('\n');
}

// ——— aa-enforce, aa-complain, aa-disable ———

/** The path of a program as which(1) finds it (root's PATH). */
function which(game: Shell, name: string): string | null {
  for (const d of ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin']) if (game.find(`${d}/${name}`)?.type === 'file') return `${d}/${name}`;
  return null;
}

const cantFind = (name: string) =>
  `Can't find ${name} in the system path list. If the name of the application\nis correct, please run 'which ${name}' as a user with correct PATH\nenvironment set up in order to find the fully-qualified path and\nuse the full path as parameter.`;

/** What a tool's argument names: a profile file, or a program and the file of its profile (tools.py's get_next_to_profile). */
function target(game: Shell, arg: string, dir: string): { file: string | null; program: string | null; shown: string } | { error: string } {
  if (!arg.includes('/')) {
    if (game.find(`${dir}/${arg}`)?.type === 'file') return { file: `${dir}/${arg}`, program: null, shown: `${dir}/${arg}` };
    const w = which(game, arg);
    if (!w) return { error: cantFind(arg) };
    arg = w;
  }
  const path = game.resolve(arg);
  if (path.startsWith(`${dir}/`)) return { file: game.find(path)?.type === 'file' ? path : null, program: null, shown: path };
  if (!game.find(path)) return { error: `${arg} does not exist, please double-check the path.` };
  const f = fileFor(game, path);
  return { file: f?.path ?? null, program: path, shown: path };
}

const PERMISSION = (dir: string) => `ERROR: [Errno 13] Permission denied: '${dir}'`;

/** apparmor_parser -r on a profile file, after a mode change (aa.py's reload_profile). */
function reload(game: Shell, file: string): string | null {
  const r = parseFile(file, readerOf(game));
  if (r.error) return parserMessage(file, r.error);
  const pid = game.nextPid();
  for (const p of r.profiles) loadProfile(game, p, { pid });
  return null;
}

function modeTool(game: Shell, args: string[], tool: 'enforce' | 'complain' | 'disable'): string {
  let dir = DIR;
  let noReload = false;
  const targets: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-d' || a === '--dir') dir = game.resolve(args[++i] ?? DIR);
    else if (a === '--no-reload' || a === '-r' || a === '--remove') {
      if (a === '--no-reload') noReload = true;
    } else if (a.startsWith('-')) return game.error(`usage: aa-${tool} [-h] [-d DIR] [--no-reload] program [program ...]\naa-${tool}: error: unrecognized arguments: ${a}`, 2);
    else targets.push(a);
  }
  if (!targets.length) return game.error(`usage: aa-${tool} [-h] [-d DIR] [--no-reload] program [program ...]\naa-${tool}: error: the following arguments are required: program`, 2);
  const out: string[] = [];
  for (const arg of targets) {
    const t = target(game, arg, dir);
    if ('error' in t) {
      out.push(t.error);
      continue;
    }
    if (!t.file) {
      out.push(`Profile for ${t.shown} not found, skipping`);
      continue;
    }
    const file = t.file;
    const name = file.slice(dir.length + 1);
    if (tool === 'disable') {
      out.push(`Disabling ${t.program ?? file}.`);
      if (!isRoot(game)) {
        game.error(PERMISSION(`${dir}/disable`), 1);
        return out.join('\n');
      }
      const disable = game.find(`${dir}/disable`);
      if (disable?.type === 'directory' && !disable.children[name]) disable.children[name] = { type: 'file', content: '', link: file, owner: 'root' };
      if (!noReload) {
        const r = parseFile(file, readerOf(game));
        const pid = game.nextPid();
        for (const p of r.profiles) removeProfile(game, p.name, pid);
      }
      continue;
    }
    out.push(`Setting ${t.program ?? file} to ${tool} mode.`);
    if (!isRoot(game)) {
      game.error(PERMISSION(file), 1);
      return out.join('\n');
    }
    for (const sub of tool === 'enforce' ? ['force-complain', 'disable'] : ['disable']) {
      const d = game.find(`${dir}/${sub}`);
      if (d?.type === 'directory') delete d.children[name];
    }
    const text = game.read(file) ?? '';
    const drop = ['enforce', 'kill', 'unconfined', 'prompt', 'default_allow', ...(tool === 'enforce' ? ['complain'] : [])];
    writeFile(game, file, withFlags(text, (flags) => [...flags.filter((f) => !drop.includes(f)), ...(tool === 'complain' && !flags.includes('complain') ? ['complain'] : [])]));
    if (!noReload) {
      const e = reload(game, file);
      if (e) {
        out.push(e);
        game.status = 1;
      }
    }
  }
  return out.join('\n');
}

// ——— aa-autodep ———

const INTERPRETERS: Record<string, string> = { '/bin/sh': '/usr/bin/dash', '/usr/bin/sh': '/usr/bin/dash', '/bin/dash': '/usr/bin/dash', '/usr/bin/dash': '/usr/bin/dash', '/bin/bash': '/usr/bin/bash', '/usr/bin/bash': '/usr/bin/bash' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** time.asctime(): Tue Jan 18 10:24:03 2033. */
function asctime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}
const now = (game: Shell) => systemd(game)?.clock ?? 0;

/** The profile aa-autodep writes for a program (aa.py's create_new_profile): complain mode, base, a script's interpreter. */
export function autodepProfile(game: Shell, program: string): string {
  const first = (game.read(program) ?? '').split('\n')[0];
  const hashbang = /^#!\s*(\S+)/.exec(first)?.[1];
  const interpreter = hashbang ? (INTERPRETERS[hashbang] ?? hashbang) : null;
  const abstraction = interpreter && /\/(ba|da)?sh$/.test(interpreter) ? 'abstractions/bash' : null;
  const includes = ['abstractions/base', ...(abstraction ? [abstraction] : [])];
  const rules = interpreter ? [`${interpreter} ix,`, `${program} r,`] : [`${program} mr,`];
  return [
    `# Last Modified: ${asctime(now(game))}`,
    'abi <abi/4.0>,',
    '',
    'include <tunables/global>',
    '',
    `${program} flags=(complain) {`,
    ...includes.map((i) => `  include <${i}>`),
    '',
    ...rules.sort().map((r) => `  ${r}`),
    '',
    '}',
  ].join('\n');
}

const profileFileName = (program: string) => `${DIR}/${program.replace(/^\//, '').replace(/\//g, '.')}`;

function autodep(game: Shell, args: string[]): string {
  const force = args.includes('-f') || args.includes('--force');
  const programs = args.filter((a) => !a.startsWith('-'));
  if (!programs.length) return game.error('usage: aa-autodep [-h] [-d DIR] [-f] [-m] program [program ...]\naa-autodep: error: the following arguments are required: program', 2);
  const out: string[] = [];
  for (const arg of programs) {
    const program = arg.includes('/') ? game.resolve(arg) : which(game, arg);
    if (!program) {
      out.push(cantFind(arg));
      continue;
    }
    if (!game.find(program)) {
      out.push(`${arg} does not exist, please double-check the path.`);
      continue;
    }
    if (program.startsWith(`${DIR}/`)) {
      out.push(`Please pass an application to generate a profile for, not a profile itself - skipping ${program}.`);
      continue;
    }
    const file = profileFileName(program);
    if ((game.find(file) || fileFor(game, program)) && !force) {
      out.push(`Profile for ${program} already exists - skipping.`);
      continue;
    }
    if (!isRoot(game)) {
      game.error(PERMISSION(DIR), 1);
      return out.join('\n');
    }
    writeFile(game, file, autodepProfile(game, program), { mode: 'rw-r--r--' });
    out.push(`Writing updated profile for ${program}.`);
    reload(game, file);
  }
  return out.join('\n');
}

// ——— aa-logprof and aa-genprof ———

interface Event {
  kind: string;
  operation: string;
  profile: string;
  name: string;
  mask: string;
  owner: boolean;
  capname?: string;
  serial: number;
}

/** The AppArmor records of a log (audit.log, the kernel's log, journalctl's output). */
export function readEvents(text: string): Event[] {
  const out: Event[] = [];
  for (const line of text.split('\n')) {
    if (!/apparmor="(ALLOWED|DENIED)"/.test(line)) continue;
    const field = (k: string) => new RegExp(`\\b${k}=(?:"([^"]*)"|(\\S+))`).exec(line);
    const v = (k: string) => {
      const m = field(k);
      return m ? (m[1] ?? m[2]) : '';
    };
    const serial = Number(/audit\(\d+\.\d+:(\d+)\)/.exec(line)?.[1] ?? 0);
    out.push({ kind: v('apparmor'), operation: v('operation'), profile: v('profile'), name: v('name'), mask: v('requested_mask'), owner: v('fsuid') !== '' && v('fsuid') === v('ouid'), capname: v('capname') || undefined, serial });
  }
  return out;
}

type Question =
  | { type: 'exec'; profile: string; path: string; kind: string }
  | { type: 'cap'; profile: string; cap: string; kind: string }
  | { type: 'file'; profile: string; path: string; mask: string; owner: boolean; kind: string };

// Abstractions logprof proposes for a path (the game's set, see the world's abstractions).
const ABSTRACTIONS: [RegExp, string][] = [
  [/^\/etc\/(passwd|group|nsswitch\.conf|hosts|host\.conf|resolv\.conf|gai\.conf)$/, 'abstractions/nameservice'],
  [/^\/etc\/(bash\.bashrc|profile|inputrc)$|^\/usr\/share\/terminfo\//, 'abstractions/bash'],
  [/^\/etc\/ssl\/certs\//, 'abstractions/ssl_certs'],
];
// severity.db's ratings for what this story meets (others: unknown).
const SEVERITY: [RegExp, string][] = [
  [/^\/etc\/(shadow|gshadow)/, '9'],
  [/^\/etc\/(passwd|group)$/, '4'],
  [/^\/root\//, '8'],
];
const CAP_SEVERITY: Record<string, string> = { dac_read_search: '7', dac_override: '9', chown: '9', setuid: '9', setgid: '9', kill: '8', net_admin: '8', sys_admin: '10' };
const CAP_NUMBERS: Record<string, number> = { chown: 0, dac_override: 1, dac_read_search: 2, fowner: 3, kill: 5, setgid: 6, setuid: 7, net_admin: 12, sys_admin: 21 };
export const capNumber = (cap: string) => CAP_NUMBERS[cap] ?? 0;

/** The next glob of a path (aa.py's glob_path, glob_path_withext). */
export function globPath(path: string, ext = false): string {
  if (ext) {
    const m = /^(.*\/)([^/]*?)(\.[^./]+)$/.exec(path);
    if (!m) return path;
    if (m[2] === '*') return `${m[1]}**${m[3]}`;
    if (m[2] === '**') return path;
    return `${m[1]}*${m[3]}`;
  }
  if (path.endsWith('/')) {
    const parts = path.slice(0, -1).split('/');
    const last = parts.at(-1);
    if (last === '**' && parts.length > 2) return `${parts.slice(0, -2).join('/')}/**/`;
    if (last === '*') return `${parts.slice(0, -1).join('/')}/**/`;
    return `${parts.slice(0, -1).join('/')}/*/`;
  }
  const i = path.lastIndexOf('/');
  const dir = path.slice(0, i);
  const last = path.slice(i + 1);
  if (last === '**') {
    const j = dir.lastIndexOf('/');
    return j > 0 ? `${dir.slice(0, j)}/**` : '/**';
  }
  if (last === '*') return `${dir}/**`;
  return `${dir}/*`;
}

interface Session {
  who: string;
  // The working copy of each profile changed: its file, its rules added (in order).
  changes: Map<string, { file: string; lines: string[] }>;
  questions: Question[];
  // Printed once: "Complain-mode changes:" / "Enforce-mode changes:".
  headed: Set<string>;
  // After the save (or abort): what runs next (aa-genprof's loop), else null.
  then: ((out: string) => string) | null;
}

/** The working profile: the file's profile with the rules added so far. */
function working(game: Shell, s: Session, name: string): Profile | null {
  const f = fileFor(game, name);
  if (!f) return null;
  const added = s.changes.get(name)?.lines ?? [];
  if (!added.length) return f.profile;
  const text = insertRules(game.read(f.path) ?? '', added);
  const io = readerOf(game);
  const r = parseFile(f.path, { read: (p) => (p === f.path ? text : io.read(p)), list: io.list });
  return r.profiles.find((p) => p.name === name) ?? f.profile;
}

/** The rules added before the profile's closing brace. */
export function insertRules(text: string, rules: string[]): string {
  const lines = text.split('\n');
  let close = -1;
  for (let i = lines.length - 1; i >= 0; i--)
    if (lines[i].trim() === '}') {
      close = i;
      break;
    }
  if (close < 0) return text;
  const blank = lines[close - 1]?.trim() === '' ? close - 1 : close;
  return [...lines.slice(0, blank), ...rules.map((r) => (r.startsWith('include ') ? `  ${r}` : `  ${r},`)), ...lines.slice(blank)].join('\n');
}

function covered(game: Shell, s: Session, q: Question): boolean {
  const p = working(game, s, q.profile);
  if (!p) return true;
  if (q.type === 'cap') return capAllowed(p, q.cap) || p.caps.some((c) => c.deny && c.name === q.cap);
  if (q.type === 'exec') return p.files.some((r) => r.re.test(q.path) && (r.exec || (r.deny && r.exec)));
  if (permits(p, q.path, q.mask, q.owner)) return true;
  return p.files.some((r) => r.deny && r.re.test(q.path) && [...q.mask.replace(/c/g, 'w')].some((c) => r.perms.includes(c)));
}

function questionsFrom(game: Shell, events: Event[]): Question[] {
  const qs: Question[] = [];
  const key = (q: Question) => JSON.stringify(q);
  const seen = new Set<string>();
  const push = (q: Question) => {
    if (!seen.has(key(q))) {
      seen.add(key(q));
      qs.push(q);
    }
  };
  // Execs, then capabilities, then files (merged per path).
  for (const e of events) if (e.operation === 'exec') push({ type: 'exec', profile: e.profile, path: e.name, kind: e.kind });
  for (const e of events) if (e.operation === 'capable' && e.capname) push({ type: 'cap', profile: e.profile, cap: e.capname, kind: e.kind });
  const files = new Map<string, Question & { type: 'file' }>();
  for (const e of events) {
    if (e.operation === 'exec' || e.operation === 'capable' || !e.name) continue;
    const k = `${e.profile}\u0000${e.name}`;
    const mask = e.mask.replace(/c/g, 'w').replace(/d/g, 'w');
    const old = files.get(k);
    if (old) {
      old.mask = [...new Set([...old.mask, ...mask])].join('');
      old.owner = old.owner && e.owner;
    } else files.set(k, { type: 'file', profile: e.profile, path: e.name, mask, owner: e.owner, kind: e.kind });
  }
  for (const q of files.values()) {
    q.mask = ['r', 'w', 'a', 'l', 'k', 'm'].filter((c) => q.mask.includes(c)).join('');
    push(q);
  }
  return qs.filter((q) => !!fileFor(game, q.profile));
}

const asRoot = <T,>(game: Shell, who: string, f: () => T): T => {
  const before = game.who;
  game.who = who;
  try {
    return f();
  } finally {
    game.who = before;
  }
};

/** The questions, one after the other; then the save. */
function ask(game: Shell, s: Session, out: string[]): string {
  while (s.questions.length && covered(game, s, s.questions[0])) s.questions.shift();
  const q = s.questions[0];
  if (!q) return save(game, s, out);
  const header = q.kind === 'ALLOWED' ? 'Complain-mode changes:' : 'Enforce-mode changes:';
  if (!s.headed.has(header)) {
    s.headed.add(header);
    out.push(header, '');
  }
  if (q.type === 'exec') return askExec(game, s, q, out);
  if (q.type === 'cap') return askCap(game, s, q, out);
  return askFile(game, s, q, out);
}

const add = (s: Session, profile: string, file: string, rule: string) => {
  const c = s.changes.get(profile) ?? { file, lines: [] };
  c.lines.push(rule);
  s.changes.set(profile, c);
};

const fileOf = (game: Shell, name: string) => fileFor(game, name)?.path ?? '';

function next(game: Shell, s: Session, out: string[]): string {
  s.questions.shift();
  out.push('');
  return ask(game, s, out);
}

function abort(game: Shell, s: Session, out: string[], back: () => string): string {
  game.ask('Are you sure you want to abandon this set of profile changes and exit? (y/[n]) ', (r) =>
    asRoot(game, s.who, () => {
      if (/^y/i.test(r)) {
        const done = 'Abandoning all changes.';
        return s.then ? s.then(done) : done;
      }
      return back();
    }),
  );
  return out.join('\n');
}

function askExec(game: Shell, s: Session, q: Question & { type: 'exec' }, out: string[]): string {
  out.push(`Profile:  ${q.profile}`, `Execute:  ${q.path}`, 'Severity: unknown', '');
  const menu = '[(I)nherit] / (C)hild / (N)amed / (U)nconfined / (X) ix On / (D)eny / Abo(r)t / (F)inish';
  game.ask(menu + ' ', (r) =>
    asRoot(game, s.who, () => {
      const k = (r || 'i').toLowerCase()[0];
      const o: string[] = [];
      if (k === 'i' || k === 'x') add(s, q.profile, fileOf(game, q.profile), `${q.path} ix`);
      else if (k === 'u') {
        o.push('', 'Launching processes in an unconfined state is a very', 'dangerous operation and can cause serious security holes.', '');
        add(s, q.profile, fileOf(game, q.profile), `${q.path} ux`);
      } else if (k === 'd') add(s, q.profile, fileOf(game, q.profile), `deny ${q.path} x`);
      else if (k === 'r') return abort(game, s, [], () => askExec(game, s, q, []));
      else if (k === 'f') return save(game, s, []);
      else return askExec(game, s, q, ['Child and named profiles are not simulated here: choose (I)nherit, (U)nconfined or (D)eny.', '']);
      return next(game, s, o);
    }),
  );
  return out.join('\n');
}

function askCap(game: Shell, s: Session, q: Question & { type: 'cap' }, out: string[]): string {
  const allow = q.kind === 'ALLOWED';
  out.push(`Profile:    ${q.profile}`, `Capability: ${q.cap}`, `Severity:   ${CAP_SEVERITY[q.cap] ?? 'unknown'}`, '', ` [1 - capability ${q.cap},]`);
  const menu = `${allow ? '[(A)llow]' : '(A)llow'} / ${allow ? '(D)eny' : '[(D)eny]'} / (I)gnore / Audi(t) / Abo(r)t / (F)inish`;
  game.ask(menu + ' ', (r) =>
    asRoot(game, s.who, () => {
      const k = (r || (allow ? 'a' : 'd')).toLowerCase()[0];
      const o: string[] = [];
      if (k === 'a') {
        add(s, q.profile, fileOf(game, q.profile), `capability ${q.cap}`);
        o.push(`Adding capability ${q.cap} to profile.`);
      } else if (k === 'd') {
        add(s, q.profile, fileOf(game, q.profile), `deny capability ${q.cap}`);
        o.push(`Adding deny capability ${q.cap} to profile.`);
      } else if (k === 'r') return abort(game, s, [], () => askCap(game, s, q, []));
      else if (k === 'f') return save(game, s, []);
      else if (k !== 'i') return askCap(game, s, q, []);
      return next(game, s, o);
    }),
  );
  return out.join('\n');
}

function askFile(game: Shell, s: Session, q: Question & { type: 'file' }, out: string[], state?: { paths: string[]; selected: number; owner: boolean; includes: string[] }): string {
  const abstraction = ABSTRACTIONS.find(([re]) => re.test(q.path))?.[1];
  const st = state ?? { paths: [q.path], selected: 0, owner: q.owner, includes: abstraction && game.find(`${DIR}/${abstraction}`) ? [abstraction] : [] };
  const allow = q.kind === 'ALLOWED';
  const options = [...st.includes.map((i) => `include <${i}>`), ...st.paths.map((p) => `${st.owner ? 'owner ' : ''}${p} ${q.mask},`)];
  const severity = SEVERITY.find(([re]) => re.test(q.path))?.[1] ?? 'unknown';
  out.push(`Profile:  ${q.profile}`, `Path:     ${q.path}`, `New Mode: ${st.owner ? 'owner ' : ''}${q.mask}`, `Severity: ${severity}`, '');
  options.forEach((o, i) => out.push(i === st.selected ? ` [${i + 1} - ${o}]` : `  ${i + 1} - ${o}`));
  const menu = `${allow ? '[(A)llow]' : '(A)llow'} / ${allow ? '(D)eny' : '[(D)eny]'} / (I)gnore / (G)lob / Glob with (E)xtension / (N)ew / Audi(t) / (O)wner permissions ${st.owner ? 'off' : 'on'} / Abo(r)t / (F)inish`;
  const chosenPath = () => st.paths[Math.max(0, st.selected - st.includes.length)];
  game.ask(menu + ' ', (r) =>
    asRoot(game, s.who, () => {
      const answer = r.trim();
      if (/^\d+$/.test(answer)) {
        const i = Number(answer) - 1;
        if (i >= 0 && i < options.length) st.selected = i;
        return askFile(game, s, q, [], st);
      }
      const k = (answer || (allow ? 'a' : 'd')).toLowerCase()[0];
      const file = fileOf(game, q.profile);
      if (k === 'a' || k === 'd') {
        const deny = k === 'd';
        const include = st.selected < st.includes.length ? st.includes[st.selected] : null;
        const rule = include && !deny ? `include <${include}>` : `${deny ? 'deny ' : ''}${st.owner ? 'owner ' : ''}${chosenPath()} ${q.mask}`;
        add(s, q.profile, file, rule);
        return next(game, s, [`Adding ${rule} to profile.`]);
      }
      if (k === 'i') return next(game, s, []);
      if (k === 'g' || k === 'e') {
        const g = globPath(chosenPath(), k === 'e');
        if (!st.paths.includes(g)) st.paths.push(g);
        st.selected = st.includes.length + st.paths.indexOf(g);
        return askFile(game, s, q, [], st);
      }
      if (k === 'o') {
        st.owner = !st.owner;
        return askFile(game, s, q, [], st);
      }
      if (k === 'n') {
        game.ask('Enter new path: ', (typed) =>
          asRoot(game, s.who, () => {
            const p = typed.trim();
            const o: string[] = [];
            if (p) {
              if (!fileFor(game, q.profile)) return '';
              if (!globMatches(p, q.path)) o.push('The specified path does not match this log entry:', '', `  Log Entry: ${q.path}`, `  Entered Path:  ${p}`, '');
              else {
                if (!st.paths.includes(p)) st.paths.push(p);
                st.selected = st.includes.length + st.paths.indexOf(p);
              }
            }
            return askFile(game, s, q, o, st);
          }),
        );
        return '';
      }
      if (k === 'r') return abort(game, s, [], () => askFile(game, s, q, [], st));
      if (k === 'f') return save(game, s, []);
      return askFile(game, s, q, [], st);
    }),
  );
  return out.join('\n');
}

const globMatches = (glob: string, path: string) => globToRegex(glob).test(path);

function save(game: Shell, s: Session, out: string[]): string {
  const changed = [...s.changes.entries()].filter(([, c]) => c.lines.length);
  if (!changed.length) {
    const text = out.join('\n');
    return s.then ? s.then(text) : text;
  }
  out.push('= Changed Local Profiles =', '', 'The following local profiles were changed. Would you like to save them?', '');
  changed.forEach(([name], i) => out.push(i === 0 ? ` [${i + 1} - ${name}]` : `  ${i + 1} - ${name}`));
  game.ask('(S)ave Changes / Save Selec(t)ed Profile / [(V)iew Changes] / View Changes b/w (C)lean profiles / Abo(r)t ', (r) =>
    asRoot(game, s.who, () => {
      const k = (r || 'v').toLowerCase()[0];
      if (k === 's' || k === 't') {
        const o: string[] = [];
        for (const [name, c] of k === 't' ? changed.slice(0, 1) : changed) {
          const text = (game.read(c.file) ?? '').replace(/^# Last Modified: .*$/m, `# Last Modified: ${asctime(now(game))}`);
          writeFile(game, c.file, insertRules(text, c.lines));
          o.push(`Writing updated profile for ${name}.`);
          const e = reload(game, c.file);
          if (e) o.push(e);
          s.changes.delete(name);
        }
        const done = o.join('\n');
        return s.then ? s.then(done) : done;
      }
      if (k === 'v' || k === 'c') {
        const o: string[] = [];
        for (const [, c] of changed) {
          o.push(`--- ${c.file}`, `+++ ${c.file}`, ...c.lines.map((l) => (l.startsWith('include ') ? `+  ${l}` : `+  ${l},`)));
        }
        o.push('');
        return save(game, s, o);
      }
      if (k === 'r') return abort(game, s, [], () => save(game, s, []));
      return save(game, s, []);
    }),
  );
  return out.join('\n');
}

const LOGFILES = [AUDIT_LOG, '/var/log/syslog', '/var/log/messages'];

/** The log aa-logprof reads (-f, or the first of logprof.conf's logfiles that exists). */
function logText(game: Shell, file: string | null): { text: string; name: string } | { error: string } {
  if (file) {
    const path = game.resolve(file);
    const n = game.find(path);
    if (n?.type !== 'file') return { error: `The logfile ${file} does not exist. Please check the path.` };
    return { text: game.read(path) ?? '', name: path };
  }
  for (const l of LOGFILES) {
    const n = game.find(l);
    if (n?.type === 'file' && (isRoot(game) || game.can(n, 'r'))) return { text: game.read(l) ?? '', name: l };
  }
  return { error: `Can't find system log "${LOGFILES.join(' ')}". Please check permissions.` };
}

function logprof(game: Shell, args: string[], mark = 0, then: Session['then'] = null): string {
  let file: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-f' || args[i] === '--file') file = args[++i] ?? null;
    else if (args[i] === '-d' || args[i] === '--dir' || args[i] === '-m' || args[i] === '--logmark') i++;
    else if (args[i].startsWith('-')) return game.error(`usage: aa-logprof [-h] [-d DIR] [-f FILE] [-m MARK]\naa-logprof: error: unrecognized arguments: ${args[i]}`, 2);
  }
  if (!isRoot(game)) return game.error(PERMISSION(DIR), 1);
  const log = logText(game, file);
  if ('error' in log) return game.error(`ERROR: ${log.error}`, 1);
  const out = [`Reading log entries from ${log.name}.`, `Updating AppArmor profiles in ${DIR}.`];
  const events = readEvents(log.text).filter((e) => e.serial > mark);
  const s: Session = { who: game.who, changes: new Map(), questions: questionsFrom(game, events), headed: new Set(), then };
  return ask(game, s, out);
}

function genprof(game: Shell, args: string[]): string {
  const arg = args.find((a) => !a.startsWith('-'));
  if (!arg) return game.error('usage: aa-genprof [-h] [-d DIR] [-f FILE] program\naa-genprof: error: the following arguments are required: program', 2);
  if (!isRoot(game)) return game.error(PERMISSION(DIR), 1);
  const program = arg.includes('/') ? game.resolve(arg) : which(game, arg);
  if (!program) return game.error(cantFind(arg), 1);
  if (!game.find(program)) return game.error(`${arg} does not exist, please double-check the path.`, 1);
  const out: string[] = [];
  let found = fileFor(game, program);
  if (!found) {
    out.push(autodep(game, [program]));
    found = fileFor(game, program);
  }
  if (!found) return out.join('\n');
  out.push(modeTool(game, [found.path], 'complain'));
  const who = game.who;
  const a = apparmor(game);
  const mark = a.serial;
  out.push(
    '',
    'Before you begin, you may wish to check if a',
    'profile already exists for the application you',
    'wish to confine. See the following wiki page for',
    'more information:',
    'https://gitlab.com/apparmor/apparmor/wikis/Profiles',
    '',
    `Profiling: ${program}`,
    '',
    'Please start the application to be profiled in',
    'another window and exercise its functionality now.',
    '',
    'Once completed, select the "Scan" option below in',
    'order to scan the system logs for AppArmor events.',
    '',
    'For each AppArmor event, you will be given the',
    'opportunity to choose whether the access should be',
    'allowed or denied.',
    '',
  );
  const loop = (before: string): string => {
    game.ask('[(S)can system log for AppArmor events] / (F)inish ', (r) =>
      asRoot(game, who, () => {
        const k = (r || 's').toLowerCase()[0];
        if (k === 'f') {
          const done = modeTool(game, [found!.path], 'enforce');
          return [
            done,
            '',
            'Reloaded AppArmor profiles in enforce mode.',
            '',
            'Please consider contributing your new profile!',
            'See the following wiki page for more information:',
            'https://gitlab.com/apparmor/apparmor/wikis/Profiles',
            '',
            `Finished generating profile for ${program}.`,
          ].join('\n');
        }
        return logprof(game, [], mark, (text) => loop(text));
      }),
    );
    return before;
  };
  return loop(out.join('\n'));
}

export const APPARMOR_COMMANDS: Record<string, Command> = {
  'aa-status': { ownOptions: true, section: 8, launch: ({ args, game }) => aaStatus(game, args) },
  apparmor_parser: { ownOptions: true, section: 8, launch: ({ args, game }) => parser(game, args) },
  'aa-enforce': { ownOptions: true, section: 8, launch: ({ args, game }) => modeTool(game, args, 'enforce') },
  'aa-complain': { ownOptions: true, section: 8, launch: ({ args, game }) => modeTool(game, args, 'complain') },
  'aa-disable': { ownOptions: true, section: 8, launch: ({ args, game }) => modeTool(game, args, 'disable') },
  'aa-autodep': { ownOptions: true, section: 8, launch: ({ args, game }) => autodep(game, args) },
  'aa-logprof': { ownOptions: true, section: 8, launch: ({ args, game }) => logprof(game, args) },
  'aa-genprof': { ownOptions: true, section: 8, launch: ({ args, game }) => genprof(game, args) },
  'apparmor.d': page,
};

