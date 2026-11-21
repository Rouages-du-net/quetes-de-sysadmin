// Simulated git: a repository keeps "commits", that is snapshots of all
// tracked files, with a message, an author and a date. The messages are
// git's own (as in its French translation).
//
// Remote repositories are folders of the machine (bare repositories,
// created by git init --bare): git push sends the commits there and runs
// their hooks (hooks/pre-receive, hooks/post-receive), interpreted by
// script.ts; git --work-tree=place checkout -f extracts the files there
// (https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur,
// https://git-scm.com/docs/githooks).
//
// Deliberate differences: a single branch (main); only the files placed
// directly in the repository's folder are tracked (no subfolders, no hidden
// file but .gitattributes, whose text and eol attributes normalise CR LF); IDs are
// computed by the game (git uses SHA-1 or SHA-256); git commit without -m
// would open a text editor: here, -m is required; no remote repository
// over the network (ssh://, https://), only paths.
//
//   state.git = { '/path/of/repo': Repo } (a bare repository: its own folder)
//   state.author = 'Name <address>'; state.date = 'Tue Oct 13 21:04:00 2026 +0200'

import type { Directory, File, Node } from '../world';
import type { Shell } from '../shell';
import { content } from '../tools';
import { pack } from '../compression';
import { runScript } from '../script';
import { systemd } from '../systemd';
import type { Command } from './index';
import { colourise, readColour, sgr } from '../colours';
import { publicFor } from '../access';
import { keyFingerprint } from '../machines';
import { allowedFor, isPrivateKey, principalsFor } from '../sshsig';
import { forgeReceive, forgeReceived, forgeRemote, type RefUpdate } from '../forge';

export interface Commit {
  id: string;
  parent: string | null;
  message: string;
  author: string;
  date: string;
  files: Record<string, string>;
  // A signed commit (git commit -S, gpg.format = ssh): the signer's public key.
  signature?: GitSignature;
}
// A commit's or a tag's signature: with gpg.format = ssh, the key that
// signed (ssh-keygen -Y sign -n git), see ../sshsig.ts.
export interface GitSignature {
  format: 'ssh';
  key: string;
}
// A tag: lightweight (a name for a commit) or annotated (an object with
// its tagger, date, message, and possibly a signature: git tag -s).
export interface Tag {
  commit: string;
  annotated: boolean;
  message?: string;
  tagger?: string;
  date?: string;
  signature?: GitSignature;
}
// A reflog entry (git reflog): where the branch pointed, and why.
export interface ReflogEntry {
  id: string;
  message: string;
  date: string;
}
export interface Repo {
  commits: Commit[];
  index: Record<string, string>;
  // A bare repository (without a working copy), like a server's.
  bare?: boolean;
  // The remote repositories: name → path.
  remotes?: Record<string, string>;
  // What git --work-tree=… checkout wrote in each place (its index).
  excerpts?: Record<string, Record<string, string>>;
  // Subdirectories (and hidden files, but .git) are tracked too: names are
  // paths ("src/app.py", ".forgejo/workflows/ci.yml").
  deep?: boolean;
  tags?: Record<string, Tag>;
  // The branch's reflog, oldest first (a working copy always keeps one; a
  // bare repository only with core.logAllRefUpdates = true).
  reflog?: ReflogEntry[];
  logAllRefUpdates?: boolean;
  // Commits no branch leads to any more (after a reset or a forced push):
  // still in the object store, found by their ID, until git gc.
  objects?: Commit[];
}

// The global options (git --git-dir=… --work-tree=… -C place command).
let general: { gitDir?: string; workTree?: string; colour?: boolean } = {};

// git's colours (color.ui=auto, the default since git 1.8.4): on screen
// only; --color / --no-color on the subcommand. git's default colours:
// diff headers in bold, @@ in cyan, removed lines in red, added ones in
// green, commits in yellow; in status, the index in green, the rest in red.
// See https://git-scm.com/docs/git-config#Documentation/git-config.txt-colordiffltslotgt
const paint = (code: string, text: string) => (general.colour ? sgr(code, text) : text);
function colourDiff(text: string): string {
  return text
    .split('\n')
    .map((l) =>
      /^(diff --git|index |--- |\+\+\+ )/.test(l)
        ? paint('1', l)
        : l.startsWith('@@')
          ? paint('36', l)
          : l.startsWith('-')
            ? paint('31', l)
            : l.startsWith('+')
              ? paint('32', l)
              : /^commit [0-9a-f]{40}/.test(l)
                ? paint('33', l)
                : /^[0-9a-f]{7} /.test(l)
                  ? paint('33', l.slice(0, 7)) + l.slice(7)
                  : l,
    )
    .join('\n');
}

// Deterministic hash (FNV-1a), stretched over 40 hexadecimal digits.
export function fingerprint(text: string): string {
  let output = '';
  for (let turn = 0; output.length < 40; turn++) {
    let h = 0x811c9dc5;
    for (const c of `${text}|${turn}`) {
      h ^= c.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    output += h.toString(16).padStart(8, '0');
  }
  return output.slice(0, 40);
}

export function newCommit(parent: Commit | null, message: string, author: string, date: string, files: Record<string, string>, signature?: GitSignature): Commit {
  const id = fingerprint(JSON.stringify([parent?.id ?? null, message, author, date, files, ...(signature ? [signature.key] : [])]));
  return { id, parent: parent?.id ?? null, message, author, date, files: { ...files }, ...(signature ? { signature } : {}) };
}

/** Every commit a repository holds: its branch's, then the others still in its object store. */
export const allCommits = (d: Repo) => [...d.commits, ...(d.objects ?? [])];

/** A commit and its ancestors, oldest first (what a branch pointing at it contains). */
export function lineage(d: Repo, c: Commit, pool: Commit[] = allCommits(d)): Commit[] {
  const out: Commit[] = [];
  const byId = new Map(pool.map((x) => [x.id, x]));
  for (let x: Commit | undefined = c; x; x = x.parent ? byId.get(x.parent) : undefined) out.unshift(x);
  return out;
}

/** Points the branch at a commit: the commits left behind stay in the object store. */
export function moveBranch(d: Repo, c: Commit | null, pool: Commit[] = allCommits(d)): void {
  const next = c ? lineage(d, c, pool) : [];
  const kept = new Set(next.map((x) => x.id));
  const others = pool.filter((x, i) => !kept.has(x.id) && pool.findIndex((y) => y.id === x.id) === i);
  d.commits = next;
  d.objects = others.length ? others : undefined;
  if (!d.objects) delete d.objects;
}

/** Writes a reflog entry (a working copy always; a bare repository with core.logAllRefUpdates). */
export function logRef(d: Repo, id: string, message: string, date: string): void {
  if (d.bare && !d.logAllRefUpdates) return;
  (d.reflog ??= []).push({ id, message, date });
}

// Line-by-line diff (longest common subsequence), in unified format,
// with the whole file as context (the game's files are short).
export function diff(name: string, before: string | null, after: string | null): string {
  if (before === after) return '';
  const a = before === null || before === '' ? [] : before.split('\n');
  const b = after === null || after === '' ? [] : after.split('\n');
  const l = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(' ' + a[i]);
      i++;
      j++;
    } else if (i < a.length && (j === b.length || l[i + 1][j] >= l[i][j + 1])) lines.push('-' + a[i++]);
    else lines.push('+' + b[j++]);
  }
  return [
    `diff --git a/${name} b/${name}`,
    `--- ${before === null ? '/dev/null' : 'a/' + name}`,
    `+++ ${after === null ? '/dev/null' : 'b/' + name}`,
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...lines,
  ].join('\n');
}

function account(before: Record<string, string>, after: Record<string, string>) {
  let files = 0;
  let more = 0;
  let less = 0;
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const d = diff(name, before[name] ?? null, after[name] ?? null);
    if (!d) continue;
    files++;
    for (const l of d.split('\n').slice(4)) {
      if (l.startsWith('+')) more++;
      else if (l.startsWith('-')) less++;
    }
  }
  return { files, more, moins: less };
}

/** The repository of a path (a bare repository, or a folder containing .git). */
export function repoIn(game: Shell, path: string): Repo | null {
  const d: Repo | undefined = game.state.git?.[path];
  return d && (d.bare ? game.exists(path) : game.exists(`${path}/.git`)) ? d : null;
}

// The repository that contains the current place (going up towards the root), or the one of --git-dir.
function hereRepo(game: Shell): { path: string; repo: Repo } | null {
  if (general.gitDir) {
    const path = game.resolve(general.gitDir).replace(/\/\.git$/, '');
    const repo = repoIn(game, path);
    return repo ? { path, repo } : null;
  }
  let path = game.cwd;
  for (;;) {
    if (repoIn(game, path)) return { path, repo: repoIn(game, path)! };
    if (path === '/') return null;
    path = path.replace(/\/[^/]+$/, '') || '/';
  }
}

// The names a path argument stands for: in a repository that tracks
// subdirectories, the path from the repository's root (a directory: every
// file under it); otherwise the file's name.
function pathsOf(game: Shell, here: { path: string; repo: Repo }, arg: string, known: Record<string, string>): string[] {
  if (!here.repo.deep) return [game.name(arg)];
  const abs = game.resolve(arg);
  const rel = abs === here.path ? '' : abs.startsWith(`${here.path}/`) ? abs.slice(here.path.length + 1) : game.name(arg);
  if (!rel) return Object.keys(known);
  const under = Object.keys(known).filter((k) => k.startsWith(`${rel}/`));
  return under.length && !(rel in known) ? under : [rel];
}

/** A value of git's configuration: the repository's own (.git/config, or config in a bare one), then ~/.gitconfig (git config --get). */
export function configValue(game: Shell, key: string, repoPath?: string | null): string | null {
  const own = repoPath ? (game.state.git?.[repoPath]?.bare ? `${repoPath}/config` : `${repoPath}/.git/config`) : null;
  for (const file of [...(own ? [own] : []), `${game.resolve('~')}/.gitconfig`]) {
    const n = game.find(file);
    if (n?.type !== 'file') continue;
    const v = readConfig(content(n, game))[key.toLowerCase()];
    if (v !== undefined) return v.at(-1)!;
  }
  return null;
}

// A git configuration file ([section] or [section "sub"], then key = value):
// lower-case "section.sub.key" → its values, in order.
function readConfig(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/(^|\s)[#;].*$/, '').trim();
    const head = /^\[([^\]\s"]+)(?:\s+"([^"]*)")?\]$/.exec(line);
    if (head) {
      section = head[2] !== undefined ? `${head[1].toLowerCase()}.${head[2]}` : head[1].toLowerCase();
      continue;
    }
    const kv = /^([A-Za-z][\w-]*)\s*(?:=\s*(.*))?$/.exec(line);
    if (!kv || !section) continue;
    const key = `${section}.${kv[1].toLowerCase()}`;
    (out[key] ??= []).push((kv[2] ?? 'true').replace(/^"(.*)"$/, '$1'));
  }
  return out;
}

// Writes key = value into a configuration file (git config key value): in its section, or a new one.
function writeConfig(text: string, key: string, value: string | null, add = false): string {
  const parts = key.split('.');
  const name = parts.pop()!;
  const [sec, ...sub] = parts;
  const header = sub.length ? `[${sec} "${sub.join('.')}"]` : `[${sec}]`;
  const lines = text ? text.split('\n') : [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = /^\s*\[([^\]\s"]+)(?:\s+"([^"]*)")?\]\s*$/.exec(lines[i]);
    if (h && h[1].toLowerCase() === sec.toLowerCase() && (h[2] ?? '') === sub.join('.')) start = i;
  }
  const entry = `\t${name} = ${value}`;
  if (start < 0) return value === null ? text : [...lines, header, entry].join('\n');
  let end = start + 1;
  while (end < lines.length && !/^\s*\[/.test(lines[end])) end++;
  const same = (l: string) => new RegExp(`^\\s*${name}\\s*(=|$)`, 'i').test(l);
  const body = lines.slice(start + 1, end);
  const at = body.findIndex(same);
  let next: string[];
  if (value === null) next = body.filter((l) => !same(l));
  else if (at >= 0 && !add) next = body.map((l, i) => (i === at ? entry : l));
  else next = [...body, entry];
  return [...lines.slice(0, start + 1), ...next, ...lines.slice(end)].join('\n');
}

// .gitattributes (https://git-scm.com/docs/gitattributes): a file whose
// attributes say text (text, text=auto, eol=lf or eol=crlf; not -text nor
// binary) is normalised to LF when it goes into the repository, whatever
// its working copy ends its lines with. The last matching line wins.
export function textAttribute(game: Shell, path: string, name: string): boolean {
  let text = false;
  for (const raw of (game.read(`${path}/.gitattributes`) ?? '').split('\n')) {
    const [pattern, ...attrs] = raw.replace(/#.*/, '').trim().split(/\s+/);
    if (!pattern || !wildcardGit(pattern).test(name)) continue;
    for (const a of attrs) {
      if (a === 'text' || a === 'text=auto' || /^eol=(lf|crlf)$/.test(a)) text = true;
      else if (a === '-text' || a === 'binary') text = false;
    }
  }
  return text;
}
const wildcardGit = (pattern: string) => new RegExp(`^${pattern.replace(/^\//, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '.')}$`);

// The working copy's files (directly in the repository's folder), as git
// reads them (after the text attribute's normalisation); .gitattributes is
// the only hidden file tracked.
function travail(game: Shell, path: string, deep = !!game.state.git?.[path]?.deep): Record<string, string> {
  const place = game.find(path) as Directory;
  if (deep) {
    const out: Record<string, string> = {};
    const walk = (dir: Directory, prefix: string) => {
      for (const [name, n] of Object.entries(dir.children).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        if (name === '.git' && !prefix) continue;
        if (n.type === 'directory') walk(n, `${prefix}${name}/`);
        else if (n.type === 'file') {
          const text = content(n, game);
          out[`${prefix}${name}`] = textAttribute(game, path, `${prefix}${name}`) ? text.replace(/\r\n/g, '\n') : text;
        }
      }
    };
    walk(place, '');
    return out;
  }
  return Object.fromEntries(
    Object.entries(place.children)
      .filter(([name, n]) => n.type === 'file' && (!name.startsWith('.') || name === '.gitattributes'))
      .map(([name, n]) => {
        const text = content(n as File, game);
        return [name, textAttribute(game, path, name) ? text.replace(/\r\n/g, '\n') : text];
      }),
  );
}

const headRef = (d: Repo) => d.commits.at(-1) ?? null;

// The sample hooks git init puts in hooks/ (as .sample).
const EXAMPLES_CROCHETS = [
  'applypatch-msg',
  'commit-msg',
  'post-update',
  'pre-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'update',
];
const short = (c: Commit | null) => (c ? c.id.slice(0, 7) : '0000000');
const shortRef = (ref: string) => ref.replace(/^refs\/(heads|tags)\//, '');

// HEAD, HEAD~2, HEAD^, main, or the start of an ID (at least 4 characters).
function findCommit(d: Repo, ref: string): Commit | null {
  const pool = allCommits(d);
  // A suffix ~N or ^: that many parents back.
  const suffix = /((?:~\d*|\^+)*)$/.exec(ref)![1];
  const base = ref.slice(0, ref.length - suffix.length);
  let back = 0;
  for (const p of suffix.match(/~\d*|\^/g) ?? []) back += p === '^' ? 1 : Number(p.slice(1) || 1);
  let start: Commit | null = null;
  const reflog = /^(?:HEAD|main)@\{(\d+)\}$/.exec(base);
  if (base === 'HEAD' || base === 'main' || base === 'refs/heads/main') start = d.commits.at(-1) ?? null;
  else if (reflog) {
    const e = (d.reflog ?? [])[(d.reflog ?? []).length - 1 - Number(reflog[1])];
    start = e ? (pool.find((c) => c.id === e.id) ?? null) : null;
  } else if (d.tags?.[base.replace(/^refs\/tags\//, '')]) start = pool.find((c) => c.id === d.tags![base.replace(/^refs\/tags\//, '')].commit) ?? null;
  else if (/^[0-9a-f]{4,40}$/.test(base)) {
    const found = pool.filter((c, i) => c.id.startsWith(base) && pool.findIndex((x) => x.id === c.id) === i);
    start = found.length === 1 ? found[0] : null;
  }
  if (!start) return null;
  const chain = lineage(d, start, pool);
  return chain[chain.length - 1 - back] ?? null;
}

function write(game: Shell, path: string, text: string): string | null {
  const n = game.find(path);
  if (n?.type === 'file') {
    if (!game.can(n, 'w')) return game.t('git-write-permission', { file: game.name(path) });
    n.content = text;
    delete n.size;
    return null;
  }
  // A tracked file in a subdirectory: git creates its directories.
  const parts = path.split('/');
  for (let k = 2; k < parts.length; k++) {
    const dir = parts.slice(0, k).join('/');
    if (!game.exists(dir)) {
      const e = game.place('git', dir, { type: 'directory', children: {}, owner: game.who });
      if (e) return e;
    }
  }
  return game.place('git', path, { type: 'file', content: text, owner: game.who, lines: true });
}

// Removes a tracked file from the working copy (and the directories it leaves empty).
function remove(game: Shell, root: string, name: string): void {
  const parts = name.split('/');
  const dir = game.find([root, ...parts.slice(0, -1)].join('/'));
  if (dir?.type !== 'directory') return;
  delete dir.children[parts.at(-1)!];
  for (let k = parts.length - 1; k > 0; k--) {
    const up = game.find([root, ...parts.slice(0, k - 1)].join('/'));
    const here = game.find([root, ...parts.slice(0, k)].join('/'));
    if (up?.type === 'directory' && here?.type === 'directory' && !Object.keys(here.children).length) delete up.children[parts[k - 1]];
  }
}

// ——— Signing (gpg.format = ssh: https://git-scm.com/docs/git-config#Documentation/git-config.txt-gpgformat) ———

const tilde = (game: Shell, path: string) => path.replace(/^~(?=\/|$)/, game.resolve('~'));

/** Signs with the configured key: the signature, or git's error. */
function signWith(game: Shell, repoPath: string | null, keyId?: string): GitSignature | { error: string } {
  const format = (configValue(game, 'gpg.format', repoPath) ?? 'openpgp').toLowerCase();
  const failed = game.t('git-sign-failed');
  if (format !== 'ssh') {
    // gpg (openpgp, the default): no secret key for git in this game's keyrings.
    const who = configValue(game, 'user.email', repoPath) ?? game.player;
    return { error: `error: gpg failed to sign the data:\ngpg: skipped "${keyId ?? who}": No secret key\n[GNUPG:] INV_SGNR 9 ${keyId ?? who}\n[GNUPG:] FAILURE sign 17\ngpg: signing failed: No secret key\n\n${failed}` };
  }
  const key = keyId ?? configValue(game, 'user.signingkey', repoPath);
  if (!key) return { error: `error: ${game.t('git-sign-no-key')}\n${failed}` };
  // key::ssh-ed25519 AAAA… (a literal key: needs an agent holding it, not simulated).
  if (key.startsWith('key::') || key.startsWith('ssh-')) return { error: `error: Couldn't load public key ${key}: No such file or directory?\n\n${failed}` };
  const path = tilde(game, key);
  let priv = game.find(path)?.type === 'file' ? game.read(path) : null;
  if (!isPrivateKey(priv) && path.endsWith('.pub')) priv = game.find(path.slice(0, -4))?.type === 'file' ? game.read(path.slice(0, -4)) : null;
  if (!isPrivateKey(priv)) return { error: `error: Couldn't load public key ${path}: No such file or directory?\n\n${failed}` };
  return { format: 'ssh', key: publicFor(priv!) };
}

/** How git checks a signature: gpg.ssh.allowedSignersFile, the committer's address as principal. */
export function checkSignature(game: Shell, repoPath: string | null, sig: GitSignature | undefined, identity: string): { good: boolean; lines: string[] } {
  if (!sig) return { good: false, lines: [] };
  const file = configValue(game, 'gpg.ssh.allowedsignersfile', repoPath);
  const n = file ? game.find(tilde(game, file)) : null;
  if (!file || n?.type !== 'file') return { good: false, lines: [`error: ${game.t('git-allowed-signers-missing')}`] };
  const text = content(n, game);
  const fp = keyFingerprint(sig.key);
  const email = /<([^>]*)>/.exec(identity)?.[1] ?? identity;
  const principals = principalsFor(text, sig.key, 'git');
  if (principals.length && allowedFor(text, sig.key, email, 'git')) return { good: true, lines: [`Good "git" signature for ${email} with ED25519 key ${fp}`] };
  if (principals.length) return { good: true, lines: [`Good "git" signature for ${principals[0]} with ED25519 key ${fp}`] };
  return { good: false, lines: [`Good "git" signature with ED25519 key ${fp}`, 'No principal matched.'] };
}

/** A signed tag's armour, as git show prints it after the message. */
const tagArmour = (t: Tag) => `-----BEGIN SSH SIGNATURE-----\nU1NIU0lH${fingerprint(`${t.commit}|${t.message}|${t.signature?.key}`).replace(/[^0-9a-f]/g, '')}\n-----END SSH SIGNATURE-----`;

/** The author of a new commit: user.name and user.email, or the story's. */
function author(game: Shell, repoPath: string | null): string {
  const name = configValue(game, 'user.name', repoPath);
  const email = configValue(game, 'user.email', repoPath);
  if (name && email) return `${name} <${email}>`;
  return game.state.author ?? `${game.player} <${game.player}@example.org>`;
}

// The machine's clock as git writes a date (Mon Nov 25 10:12:00 2030 +0000), or the story's date.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function now(game: Shell): string {
  const sd = game.state.gitClock ? systemd(game) : null;
  if (!sd) return game.state.date ?? 'Tue Oct 13 21:04:00 2026 +0200';
  const d = new Date(sd.clock);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${d.getUTCFullYear()} +0000`;
}
// --date=iso: 2030-10-14 02:13:44 +0000.
function isoDate(date: string): string {
  const m = /^\w{3} (\w{3}) +(\d+) (\d\d:\d\d:\d\d) (\d{4}) ([+-]\d{4})$/.exec(date);
  return m ? `${m[4]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')} ${m[3]} ${m[5]}` : date;
}

const UNDER: Record<string, (game: Shell, args: string[]) => string> = {
  init: (game, args) => {
    const depots: Record<string, Repo> = (game.state.git ??= {});
    const bare = args.includes('--bare');
    const place = args.find((a) => !a.startsWith('-'));
    const path = place ? game.resolve(place) : game.cwd;
    if (depots[path] && game.exists(path)) return game.t(bare ? 'git-init-existing-bare' : 'git-init-existing', { path: path });
    if (place && !game.exists(path)) {
      const error = game.place('git', path, { type: 'directory', owner: game.who, children: {} });
      if (error) return game.error(game.t('git-init-impossible', { path: path }));
    }
    const directory = (children: Record<string, Node> = {}): Node => ({ type: 'directory', owner: game.who, children });
    const file = (text: string, mode?: string): Node => ({
      type: 'file',
      content: text,
      lines: true,
      owner: game.who,
      ...(mode ? { mode } : {}),
    });
    // What a repository contains: HEAD, config, the sample hooks (not executable: .sample), the objects…
    const inside: Record<string, Node> = {
      HEAD: file('ref: refs/heads/main'),
      config: file(`[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${bare}`),
      description: file("Unnamed repository; edit this file 'description' to name the repository."),
      hooks: directory(
        Object.fromEntries(EXAMPLES_CROCHETS.map((h) => [`${h}.sample`, file(`#!/bin/sh\n#\n# An example hook script (${h}).`, 'rwxr-xr-x')])),
      ),
      info: directory({ exclude: file('# git ls-files --others --exclude-from=.git/info/exclude') }),
      objects: directory({ info: directory(), pack: directory() }),
      refs: directory({ heads: directory(), tags: directory() }),
    };
    const gitPlace = bare ? path : `${path}/.git`;
    if (bare) {
      const n = game.find(path);
      if (n?.type !== 'directory' || !game.writtenIn(`${path}/HEAD`)) return game.error(game.t('git-init-impossible', { path: path }));
      Object.assign(n.children, inside);
    } else {
      const error = game.place('git', gitPlace, directory(inside));
      if (error) return game.error(error);
    }
    depots[path] = { commits: [], index: {}, ...(bare ? { bare: true } : {}) };
    return game.t(bare ? 'git-init-empty-bare' : 'git-init-empty', { path: path });
  },

  status: (game) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const { repo } = here;
    const head = headRef(repo)?.files ?? {};
    const w = travail(game, here.path);
    const indexes: string[] = [];
    const notIndexes: string[] = [];
    const notTracked: string[] = [];
    const line = (state: string, file: string, code: string) => '\t' + paint(code, game.t(`git-status-${state}`, { file: file }));
    for (const name of Object.keys({ ...head, ...repo.index }).sort()) {
      if (!(name in repo.index)) indexes.push(line('deleted', name, '32'));
      else if (!(name in head)) indexes.push(line('new', name, '32'));
      else if (head[name] !== repo.index[name]) indexes.push(line('modified', name, '32'));
    }
    for (const name of Object.keys(repo.index).sort()) {
      if (!(name in w)) notIndexes.push(line('deleted', name, '31'));
      else if (w[name] !== repo.index[name]) notIndexes.push(line('modified', name, '31'));
    }
    for (const name of Object.keys(w).sort()) if (!(name in repo.index)) notTracked.push(`\t${paint('31', name)}`);
    const blocks = [game.t('git-status-branch')];
    if (!repo.commits.length) blocks.push('\n' + game.t('git-status-none-commit'));
    if (indexes.length) blocks.push('\n' + game.t('git-status-indexes') + '\n' + indexes.join('\n'));
    if (notIndexes.length) blocks.push('\n' + game.t('git-status-not-indexes') + '\n' + notIndexes.join('\n'));
    if (notTracked.length) blocks.push('\n' + game.t('git-status-not-tracked') + '\n' + notTracked.join('\n'));
    if (!indexes.length && !notIndexes.length && !notTracked.length) blocks.push(game.t('git-status-own'));
    else if (!indexes.length)
      blocks.push('\n' + game.t(notTracked.length && !notIndexes.length ? 'git-status-only-not-tracked' : 'git-status-nothing-added'));
    return blocks.join('\n');
  },

  add: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    if (!args.length) return game.error(game.t('git-add-nothing'));
    const w = travail(game, here.path);
    const all = args.includes('.') || args.includes('-A') || args.includes('--all');
    const names = all ? [...new Set([...Object.keys(w), ...Object.keys(here.repo.index)])] : args.flatMap((a) => pathsOf(game, here, a, w));
    const warnings: string[] = [];
    for (const name of names) {
      // git warns that it will normalise a working copy written in CRLF.
      if (name in w && textAttribute(game, here.path, name) && (game.read(`${here.path}/${name}`) ?? '').includes('\r\n'))
        warnings.push(`warning: in the working copy of '${name}', CRLF will be replaced by LF the next time Git touches it`);
      if (name in w) here.repo.index[name] = w[name];
      else if (name in here.repo.index) delete here.repo.index[name];
      else return game.error(game.t('git-path-unknown', { file: name }));
    }
    return warnings.join('\n');
  },

  rm: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const keep = args.includes('--cached');
    const names = args.filter((a) => !a.startsWith('-')).flatMap((a) => pathsOf(game, here, a, here.repo.index));
    if (!names.length) return game.error(game.t('git-rm-usage'));
    const outputs: string[] = [];
    for (const name of names) {
      if (!(name in here.repo.index)) return game.error(game.t('git-path-unknown', { file: name }));
      delete here.repo.index[name];
      // Without --cached, git rm also erases the file from the working copy.
      if (!keep) remove(game, here.path, name);
      outputs.push(`rm '${name}'`);
    }
    return outputs.join('\n');
  },

  commit: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const amend = args.includes('--amend');
    const previous = amend ? headRef(here.repo) : null;
    if (amend && !previous) return game.error(game.t('git-amend-nothing'));
    // -m message, -a (first add the modified tracked files), or both: -am.
    const i = args.findIndex((a) => a === '-m' || /^-[a-zA-Z]*m$/.test(a));
    const message = i >= 0 ? args[i + 1] : amend && args.includes('--no-edit') ? previous!.message : undefined;
    if (!message) return game.error(game.t('git-commit-without-message'));
    if (args.some((a) => a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a))) {
      const w = travail(game, here.path);
      for (const name of Object.keys(here.repo.index)) {
        if (name in w) here.repo.index[name] = w[name];
        else delete here.repo.index[name];
      }
    }
    const parent = amend ? (previous!.parent ? (allCommits(here.repo).find((c) => c.id === previous!.parent) ?? null) : null) : headRef(here.repo);
    const before = parent?.files ?? {};
    const { files, more, moins: less } = account(before, here.repo.index);
    if (!files && !amend) return game.error(game.t('git-nothing-a-validate'));
    // -S[keyid], or commit.gpgsign = true (unless --no-gpg-sign).
    const explicit = args.find((a) => a === '-S' || a.startsWith('-S') || a === '--gpg-sign' || a.startsWith('--gpg-sign='));
    const keyId = explicit && explicit !== '-S' && explicit !== '--gpg-sign' ? explicit.replace(/^-S|^--gpg-sign=/, '') : undefined;
    const signed = !args.includes('--no-gpg-sign') && (!!explicit || (configValue(game, 'commit.gpgsign', here.path) ?? '').toLowerCase() === 'true');
    let signature: GitSignature | undefined;
    if (signed) {
      const r = signWith(game, here.path, keyId);
      if ('error' in r) return game.error(r.error, 128);
      signature = r;
    }
    const c = newCommit(parent, message, author(game, here.path), now(game), here.repo.index, signature);
    if (amend) moveBranch(here.repo, c, [...allCommits(here.repo), c]);
    else here.repo.commits.push(c);
    logRef(here.repo, c.id, `commit${amend ? ' (amend)' : parent ? '' : ' (initial)'}: ${message.split('\n')[0]}`, c.date);
    // Like git: zero insertions or deletions are not mentioned.
    const summary = [
      game.t('git-commit-files', { count: files }),
      ...(more ? [game.t('git-commit-insertions', { count: more })] : []),
      ...(less ? [game.t('git-commit-deletions', { count: less })] : []),
    ].join(', ');
    const header = game.t(parent ? 'git-commit-header' : 'git-commit-header-root', { id: c.id.slice(0, 7), message });
    return `${header}\n ${summary}`;
  },

  log: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (!here.repo.commits.length) return game.error(game.t('git-none-commit-branch'));
    const short = args.includes('--oneline') || args.includes('--pretty=oneline');
    // -p (--patch): each commit's changes after its message, as git show prints them.
    const patch = args.includes('-p') || args.includes('-u') || args.includes('--patch');
    const signatures = args.includes('--show-signature');
    // --format=… / --pretty=format:…: %H %h %s %an %ae %ad %G? %GS %GK.
    const formatArg = args.find((a) => a.startsWith('--format=') || a.startsWith('--pretty=format:') || a.startsWith('--pretty=tformat:'));
    const format = formatArg?.replace(/^--format=|^--pretty=t?format:/, '');
    // -n N, -N, --max-count=N.
    let limit = Infinity;
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-n' || args[k] === '--max-count') limit = Number(args[k + 1]);
      else if (/^-\d+$/.test(args[k])) limit = Number(args[k].slice(1));
      else if (args[k].startsWith('--max-count=')) limit = Number(args[k].slice(12));
    }
    const revision = args.filter((a, k) => !a.startsWith('-') && !['-n', '--max-count'].includes(args[k - 1] ?? ''))[0];
    const start = revision ? findCommit(here.repo, revision) : headRef(here.repo);
    if (!start) return game.error(game.t('git-revision-ambiguous', { revision: revision ?? 'HEAD' }));
    const head = headRef(here.repo);
    const changes = (c: Commit) => {
      const parent = c.parent ? (allCommits(here.repo).find((p) => p.id === c.parent)?.files ?? {}) : {};
      return [...new Set([...Object.keys(parent), ...Object.keys(c.files)])]
        .sort()
        .map((n) => diff(n, parent[n] ?? null, c.files[n] ?? null))
        .filter(Boolean)
        .join('\n');
    };
    const tagsOf = (c: Commit) => Object.entries(here.repo.tags ?? {}).filter(([, t]) => t.commit === c.id).map(([n]) => `tag: ${n}`);
    const decoration = (c: Commit) => {
      const refs = [...(c.id === head?.id ? ['HEAD -> main'] : []), ...tagsOf(c)];
      return refs.length ? ` (${refs.join(', ')})` : '';
    };
    const shown = lineage(here.repo, start).reverse().slice(0, limit);
    if (format !== undefined)
      return shown
        .map((c) => {
          const check = () => checkSignature(game, here.path, c.signature, c.author);
          return format.replace(/%(H|h|s|an|ae|ad|G\?|GS|GK|n)/g, (_, k: string) => {
            if (k === 'H') return c.id;
            if (k === 'h') return c.id.slice(0, 7);
            if (k === 's') return c.message.split('\n')[0];
            if (k === 'an') return c.author.replace(/\s*<.*$/, '');
            if (k === 'ae') return /<([^>]*)>/.exec(c.author)?.[1] ?? '';
            if (k === 'ad') return c.date;
            if (k === 'n') return '\n';
            if (k === 'GK') return c.signature ? keyFingerprint(c.signature.key) : '';
            const r = check();
            if (k === 'GS') return r.good ? (/for (\S+) with/.exec(r.lines[0])?.[1] ?? '') : '';
            // %G?: G good, U good with unknown validity (no principal), N none.
            return !c.signature ? 'N' : r.good ? 'G' : r.lines.some((l) => l.startsWith('Good')) ? 'U' : 'E';
          });
        })
        .join('\n');
    return shown
      .map(
        (c) =>
          (short
            ? `${c.id.slice(0, 7)}${decoration(c)} ${c.message}`
            : [
                `commit ${c.id}${decoration(c)}`,
                ...(signatures ? checkSignature(game, here.path, c.signature, c.author).lines : []),
                `Author: ${c.author}\nDate:   ${c.date}\n\n    ${c.message}`,
              ].join('\n')) + (patch ? `\n${short ? '' : '\n'}${changes(c)}` : ''),
      )
      .join(short && !patch ? '\n' : '\n\n');
  },

  diff: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const { repo } = here;
    const w = travail(game, here.path);
    const indexed = args.includes('--staged') || args.includes('--cached');
    const words = args.filter((a) => !a.startsWith('-'));
    let before: Record<string, string> = repo.index;
    let after: Record<string, string> = w;
    let rest = words;
    if (indexed) {
      before = headRef(repo)?.files ?? {};
      after = repo.index;
    } else if (words[0] && !game.exists(`${here.path}/${words[0]}`)) {
      const c = findCommit(repo, words[0]);
      if (!c) return game.error(game.t('git-revision-ambiguous', { revision: words[0] }));
      before = c.files;
      rest = words.slice(1);
    }
    const names = rest.length ? rest.map((r) => game.name(r)) : [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    // Without --staged, git diff does not show untracked files.
    return names
      .filter((n) => indexed || n in before)
      .map((n) => diff(n, before[n] ?? null, after[n] ?? null))
      .filter(Boolean)
      .join('\n');
  },

  show: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    const signatures = args.includes('--show-signature');
    const c = findCommit(here.repo, ref);
    if (!c) return game.error(game.t('git-revision-ambiguous', { revision: ref }));
    const parent = c.parent ? (allCommits(here.repo).find((p) => p.id === c.parent)?.files ?? {}) : {};
    const names = [...new Set([...Object.keys(parent), ...Object.keys(c.files)])].sort();
    // An annotated tag: its object first (tagger, date, message, the signature's armour).
    const tag = here.repo.tags?.[ref.replace(/^refs\/tags\//, '')];
    const tagBlock = tag?.annotated
      ? [`tag ${ref.replace(/^refs\/tags\//, '')}`, `Tagger: ${tag.tagger}`, `Date:   ${tag.date}`, '', tag.message ?? '', ...(tag.signature ? [tagArmour(tag)] : []), ''].join('\n')
      : null;
    return [
      ...(tagBlock ? [tagBlock] : []),
      [`commit ${c.id}`, ...(signatures ? checkSignature(game, here.path, c.signature, c.author).lines : []), `Author: ${c.author}\nDate:   ${c.date}\n\n    ${c.message}\n`].join('\n'),
      ...names.map((n) => diff(n, parent[n] ?? null, c.files[n] ?? null)).filter(Boolean),
    ].join('\n');
  },

  // git config (https://git-scm.com/docs/git-config): --global (~/.gitconfig)
  // or the repository's own file; get, set, --unset, --add, --list.
  config: (game, args) => {
    const global = args.includes('--global');
    const list = args.includes('--list') || args.includes('-l');
    const unset = args.includes('--unset');
    const add = args.includes('--add');
    const words = args.filter((a) => !a.startsWith('-'));
    const unknown = args.find((a) => a.startsWith('-') && !['--global', '--local', '--list', '-l', '--unset', '--add', '--get', '--show-origin'].includes(a));
    if (unknown) return game.error(`error: unknown option \`${unknown.replace(/^-+/, '')}'\n${game.t('git-config-usage')}`, 129);
    const here = global ? null : hereRepo(game);
    if (!global && !here && (words.length > 1 || unset)) return game.error('fatal: not in a git directory', 128);
    const file = global ? `${game.resolve('~')}/.gitconfig` : here!.repo.bare ? `${here!.path}/config` : `${here!.path}/.git/config`;
    if (list) {
      const files = global ? [file] : [`${game.resolve('~')}/.gitconfig`, ...(here ? [file] : [])];
      return files
        .flatMap((f) => {
          const n = game.find(f);
          return n?.type === 'file' ? Object.entries(readConfig(content(n, game))).flatMap(([k, vs]) => vs.map((v) => `${k}=${v}`)) : [];
        })
        .join('\n');
    }
    const [key, value] = words;
    if (!key) return game.error(game.t('git-config-usage'), 129);
    if (!/^[a-z][\w-]*(\.[^\s]+)?\.[a-z][\w-]*$/i.test(key)) return game.error(`error: key does not contain a section: ${key}`, 2);
    if (value === undefined && !unset) {
      const v = global ? (() => { const n = game.find(file); return n?.type === 'file' ? (readConfig(content(n, game))[key.toLowerCase()]?.at(-1) ?? null) : null; })() : configValue(game, key, here?.path);
      if (v === null) return game.error('', 1);
      return v;
    }
    const n = game.find(file);
    const before = n?.type === 'file' ? content(n, game) : '';
    if (unset && !readConfig(before)[key.toLowerCase()]) return game.error('', 5);
    const text = writeConfig(before, key, unset ? null : value, add);
    if (n?.type === 'file') {
      if (!game.can(n, 'w')) return game.error(`error: could not lock config file ${file}: Permission denied`, 255);
      n.content = text;
      delete n.size;
      return '';
    }
    const e = game.place('git', file, { type: 'file', content: text, owner: game.who, lines: true, mode: 'rw-r--r--' });
    return e ? game.error(`error: could not lock config file ${file}: Permission denied`, 255) : '';
  },

  // git tag (https://git-scm.com/docs/git-tag): list, lightweight (NAME),
  // annotated (-a), signed (-s, -u KEY), -d, -v (verify-tag), -m required here.
  tag: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const tags = (here.repo.tags ??= {});
    const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
    const words = args.filter((a, k) => !a.startsWith('-') && !['-m', '-u', '--message', '--local-user'].includes(args[k - 1] ?? ''));
    if (args.includes('-v') || args.includes('--verify')) return UNDER['verify-tag'](game, words);
    if (args.includes('-d') || args.includes('--delete')) {
      const out: string[] = [];
      for (const name of words) {
        if (!tags[name]) return game.error(`error: tag '${name}' not found.`, 1);
        out.push(`Deleted tag '${name}' (was ${tags[name].commit.slice(0, 7)})`);
        delete tags[name];
      }
      return out.join('\n');
    }
    if (!words.length || args.includes('-l') || args.includes('--list')) return Object.keys(tags).sort().join('\n');
    const [name, target = 'HEAD'] = words;
    if (!/^[\w][\w.+-]*$/.test(name)) return game.error(`fatal: '${name}' is not a valid tag name.`, 128);
    if (tags[name] && !args.includes('-f') && !args.includes('--force')) return game.error(`fatal: tag '${name}' already exists`, 128);
    const c = findCommit(here.repo, target);
    if (!c) return game.error(`fatal: Failed to resolve '${target}' as a valid ref.`, 128);
    const keyId = value('-u') ?? value('--local-user');
    const signed = args.includes('-s') || args.includes('--sign') || !!keyId || ((configValue(game, 'tag.gpgsign', here.path) ?? '').toLowerCase() === 'true' && (args.includes('-a') || args.includes('-m')));
    const annotated = signed || args.includes('-a') || args.includes('--annotate') || value('-m') !== undefined;
    if (!annotated) {
      tags[name] = { commit: c.id, annotated: false };
      return '';
    }
    const message = value('-m') ?? value('--message');
    if (!message) return game.error(game.t('git-tag-without-message'));
    let signature: GitSignature | undefined;
    if (signed) {
      const r = signWith(game, here.path, keyId);
      if ('error' in r) return game.error(r.error.replace(game.t('git-sign-failed'), game.t('git-tag-sign-failed')), 128);
      signature = r;
    }
    tags[name] = { commit: c.id, annotated: true, message, tagger: author(game, here.path), date: now(game), ...(signature ? { signature } : {}) };
    return '';
  },

  'verify-tag': (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const names = args.filter((a) => !a.startsWith('-'));
    if (!names.length) return game.error('usage: git verify-tag [-v | --verbose] [--format=<format>] [--raw] <tag>...', 129);
    const lines: string[] = [];
    let ok = true;
    for (const name of names) {
      const tag = here.repo.tags?.[name.replace(/^refs\/tags\//, '')];
      if (!tag) {
        const c = findCommit(here.repo, name);
        if (!c) return game.error(`error: tag '${name}' not found.`, 1);
        return game.error(`error: ${name}: cannot verify a non-tag object of type commit.`, 1);
      }
      if (!tag.annotated) return game.error(`error: ${name}: cannot verify a non-tag object of type commit.`, 1);
      if (!tag.signature) {
        lines.push('error: no signature found');
        ok = false;
        continue;
      }
      const r = checkSignature(game, here.path, tag.signature, tag.tagger ?? '');
      lines.push(...r.lines);
      ok &&= r.good;
    }
    // git verify-tag writes the verification on its error output.
    game.error(lines.join('\n'));
    game.status = ok ? 0 : 1;
    return '';
  },

  'verify-commit': (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const refs = args.filter((a) => !a.startsWith('-'));
    if (!refs.length) return game.error('usage: git verify-commit [-v | --verbose] [--raw] <commit>...', 129);
    const lines: string[] = [];
    let ok = true;
    for (const ref of refs) {
      const c = findCommit(here.repo, ref);
      if (!c) return game.error(`error: commit '${ref}' not found.`, 1);
      // An unsigned commit: nothing printed, a failure.
      if (!c.signature) {
        ok = false;
        continue;
      }
      const r = checkSignature(game, here.path, c.signature, c.author);
      lines.push(...r.lines);
      ok &&= r.good;
    }
    if (lines.length) game.error(lines.join('\n'));
    game.status = ok ? 0 : 1;
    return '';
  },

  // git reset [--soft | --mixed | --hard] [commit]: moves the branch (the
  // commits left behind stay in the object store, and in the reflog).
  reset: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const mode = args.includes('--hard') ? 'hard' : args.includes('--soft') ? 'soft' : 'mixed';
    const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    const c = findCommit(here.repo, ref);
    if (!c) return game.error(game.t('git-revision-ambiguous', { revision: ref }));
    const before = headRef(here.repo)?.files ?? {};
    moveBranch(here.repo, c);
    logRef(here.repo, c.id, `reset: moving to ${ref}`, now(game));
    if (mode === 'soft') return '';
    const w = travail(game, here.path);
    here.repo.index = { ...c.files };
    if (mode === 'mixed') {
      const changed = Object.keys({ ...w, ...c.files }).filter((n) => n in c.files && w[n] !== c.files[n]).sort();
      return changed.length ? [game.t('git-reset-unstaged'), ...changed.map((n) => `${n in w ? 'M' : 'D'}\t${n}`)].join('\n') : '';
    }
    for (const [f, text] of Object.entries(c.files)) write(game, `${here.path}/${f}`, text);
    for (const f of Object.keys(before)) if (!(f in c.files)) remove(game, here.path, f);
    return `HEAD is now at ${c.id.slice(0, 7)} ${c.message.split('\n')[0]}`;
  },

  // git reflog [show] [main|HEAD] [--date=iso]: where the branch pointed, newest first.
  reflog: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const words = args.filter((a) => !a.startsWith('-') && a !== 'show');
    const ref = (words[0] ?? 'HEAD').replace(/^refs\/heads\//, '');
    if (ref !== 'HEAD' && ref !== 'main') return game.error(game.t('git-revision-ambiguous', { revision: ref }), 128);
    const iso = args.some((a) => a === '--date=iso' || a === '--date=iso8601' || a === '--date=local');
    const entries = [...(here.repo.reflog ?? [])].reverse();
    return entries
      .map((e, k) => {
        const tag = Object.entries(here.repo.tags ?? {}).filter(([, t]) => t.commit === e.id).map(([n]) => `tag: ${n}`);
        const decoration = k === 0 ? ` (${['HEAD -> main', ...tag].join(', ')})` : tag.length ? ` (${tag.join(', ')})` : '';
        return `${e.id.slice(0, 7)}${decoration} ${ref}@{${iso ? isoDate(e.date) : k}}: ${e.message}`;
      })
      .join('\n');
  },

  // git archive --format=tar.gz --prefix=DIR/ -o FILE REF: the tracked
  // files of a commit, in a tarball (a .tar.gz the game's tar can read).
  archive: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const value = (o: string) => {
      const eq = args.find((a) => a.startsWith(`${o}=`));
      if (eq) return eq.slice(o.length + 1);
      return args.includes(o) ? args[args.indexOf(o) + 1] : undefined;
    };
    const output = value('--output') ?? value('-o');
    const prefix = value('--prefix') ?? '';
    const format = value('--format') ?? (output && /\.(tar\.gz|tgz)$/.test(output) ? 'tar.gz' : 'tar');
    const ref = args.filter((a, k) => !a.startsWith('-') && !['-o', '--output', '--prefix', '--format'].includes(args[k - 1] ?? ''))[0];
    if (!ref) return game.error('usage: git archive [<options>] <tree-ish> [<path>...]', 129);
    if (!['tar', 'tar.gz', 'tgz', 'zip'].includes(format)) return game.error(`fatal: Unknown archive format '${format}'`, 128);
    const c = findCommit(here.repo, ref);
    if (!c) return game.error(`fatal: not a valid object name: ${ref}`, 128);
    if (!output) return game.error(game.t('git-archive-to-terminal'), 128);
    const files: Record<string, File> = Object.fromEntries(Object.entries(c.files).map(([n, text]) => [`${prefix}${n}`, { type: 'file', content: text, lines: true, owner: game.who } as File]));
    // The bytes: the same commit and prefix always make the same tarball (git archive is reproducible).
    const listing = `${prefix}\n${Object.keys(c.files).sort().map((n) => `${prefix}${n}`).join('\n')}\ncommit ${c.id}`;
    const gz = format !== 'tar';
    const archive: File = {
      type: 'file',
      content: gz ? pack('gzip', listing, { mtime: 0 }) : listing,
      ...(gz ? { charset: 'binary' as const } : {}),
      owner: game.who,
      archive: { files, compressed: gz },
    };
    const e = game.place('git', output, archive);
    return e ? game.error(`fatal: could not create archive file '${output}': Permission denied`, 128) : '';
  },

  restore: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const source = args.find((a) => a.startsWith('--source='))?.slice(9);
    const indexed = args.includes('--staged');
    const names = args.filter((a) => !a.startsWith('-')).map((a) => game.name(a));
    if (!names.length) return game.error(game.t('git-restore-without-path'));
    let since: Record<string, string> = here.repo.index;
    if (source) {
      const c = findCommit(here.repo, source);
      if (!c) return game.error(game.t('git-reference-invalid', { revision: source }));
      since = c.files;
    } else if (indexed) since = headRef(here.repo)?.files ?? {};
    for (const name of names) {
      if (!(name in since)) return game.error(game.t('git-restore-unknown', { file: name }));
      if (indexed) here.repo.index[name] = since[name];
      else {
        const error = write(game, `${here.path}/${name}`, since[name]);
        if (error) return game.error(error);
      }
    }
    return '';
  },

  // git checkout ID -- file: the old way to restore a file.
  // git --work-tree=place checkout [-f] [main]: extracts the files into a place (deployment).
  checkout: (game, args) => {
    const sep = args.indexOf('--');
    if (sep >= 0) {
      const ref = args.slice(0, sep)[0];
      return UNDER.restore(game, [...(ref ? [`--source=${ref}`] : []), ...args.slice(sep + 1)]);
    }
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (!general.workTree) return game.error(game.t(here.repo.bare ? 'git-not-tree' : 'git-checkout-usage'));
    const force = args.includes('-f') || args.includes('--force');
    const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
    const c = findCommit(here.repo, ref);
    if (!c)
      return game.error(
        here.repo.commits.length ? game.t('git-revision-ambiguous', { revision: ref }) : game.t('git-reference-invalid', { revision: ref }),
      );
    const place = game.resolve(general.workTree);
    if (game.find(place)?.type !== 'directory') return game.error(game.t('git-work-tree-missing', { path: place }));
    const excerpts = (here.repo.excerpts ??= {});
    const before = excerpts[place];
    // Without -f, git refuses to overwrite what it does not know, or what was modified by hand.
    if (!force) {
      const overwritten = Object.keys(c.files)
        .sort()
        .filter((name) => {
          const n = game.find(`${place}/${name}`);
          if (n?.type !== 'file') return false;
          const here = content(n, game);
          return here !== c.files[name] && (before ? here !== before[name] : true);
        });
      if (overwritten.length)
        return game.error(
          game.t(before ? 'git-checkout-changes-local' : 'git-checkout-not-tracked', { files: overwritten.map((f) => `\t${f}`).join('\n') }),
        );
    }
    for (const [name, text] of Object.entries(c.files)) {
      const error = write(game, `${place}/${name}`, text);
      if (error) return game.error(error);
    }
    // Tracked files that disappeared from the commit are erased.
    const directory = game.find(place) as Directory;
    for (const name of Object.keys(before ?? {})) if (!(name in c.files)) (name.includes('/') ? remove(game, place, name) : delete directory.children[name]);
    excerpts[place] = { ...c.files };
    // What a hook deployed, and where (for the chapters' objectives).
    if (game.state.gitHook) game.state.gitDeployments = { ...game.state.gitDeployments, [place]: c.id };
    return '';
  },

  clone: (game, args) => {
    const [source, destination] = args.filter((a) => !a.startsWith('-'));
    if (!source) return game.error(game.t('git-clone-usage'));
    const forge = forgeRemote(game, source);
    const path = forge ? forge.path : game.resolve(source).replace(/\/$/, '');
    const origin = repoIn(game, path);
    if (!origin) return game.error(game.t('git-remote-missing', { repository: source }));
    const name =
      destination ??
      (forge ? source : path)
        .split(/[/:]/)
        .at(-1)!
        .replace(/\.git$/, '');
    const target = game.resolve(name);
    if (game.exists(target)) return game.error(game.t('git-clone-exists', { path: name }));
    const lines = [game.t('git-clone-in', { path: name })];
    const before = game.cwd;
    const error = game.place('git', target, { type: 'directory', owner: game.who, children: {} });
    if (error) return game.error(error);
    game.cwd = target;
    try {
      UNDER.init(game, []);
    } finally {
      game.cwd = before;
    }
    const repo = game.state.git[target] as Repo;
    repo.commits = [...origin.commits];
    repo.remotes = { origin: forge ? source : path };
    if (origin.deep) repo.deep = true;
    if (origin.tags) repo.tags = Object.fromEntries(Object.entries(origin.tags).map(([k, v]) => [k, { ...v }]));
    // The tags' commits that main doesn't lead to come along too.
    const tagged = Object.values(origin.tags ?? {}).map((t) => allCommits(origin).find((c) => c.id === t.commit)).filter((c): c is Commit => !!c && !origin.commits.includes(c));
    if (tagged.length) repo.objects = tagged;
    const h = headRef(repo);
    if (h) {
      repo.index = { ...h.files };
      for (const [f, text] of Object.entries(h.files)) write(game, `${target}/${f}`, text);
      logRef(repo, h.id, `clone: from ${forge ? source : path}`, now(game));
      lines.push(game.t('git-done'));
    } else lines.push(game.t('git-clone-empty'));
    return lines.join('\n');
  },

  remote: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const remotes = (here.repo.remotes ??= {});
    const [action, name, url] = args.filter((a) => a !== '-v' && a !== '--verbose');
    if (!action)
      return Object.entries(remotes)
        .map(([n, u]) => (args.includes('-v') || args.includes('--verbose') ? `${n}\t${u} (fetch)\n${n}\t${u} (push)` : n))
        .join('\n');
    if (action === 'add') {
      if (!name || !url) return game.error(game.t('git-remote-usage'));
      if (remotes[name]) return game.error(game.t('git-remote-exists', { name: name }));
      remotes[name] = url;
      return '';
    }
    if (action === 'remove' || action === 'rm') {
      if (!name || !remotes[name]) return game.error(game.t('git-remote-unknown', { name: name ?? '' }));
      delete remotes[name];
      return '';
    }
    if (action === 'set-url') {
      if (!name || !url) return game.error(game.t('git-remote-usage'));
      if (!remotes[name]) return game.error(game.t('git-remote-unknown', { name: name }));
      remotes[name] = url;
      return '';
    }
    if (action === 'get-url') return remotes[name ?? ''] ?? game.error(game.t('git-remote-unknown', { name: name ?? '' }));
    return game.error(game.t('git-remote-usage'));
  },

  push: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    const words = args.filter((a) => !a.startsWith('-') || /^\+/.test(a));
    const [remoteName, ...refspecs] = words;
    const follow = args.includes('-u') || args.includes('--set-upstream');
    const forceAll = args.some((a) => a === '-f' || a === '--force' || a.startsWith('--force-with-lease'));
    const allTags = args.includes('--tags');
    const remotes = here.repo.remotes ?? {};
    const name = remoteName ?? (remotes.origin ? 'origin' : undefined);
    if (!name) return game.error(game.t('git-push-without-destination'));
    const url = remotes[name] ?? name;
    // A forge's URL (git@forge…:owner/repo.git, ssh://, https://): its bare repository on this machine.
    const forge = forgeRemote(game, url);
    const path = forge ? forge.path : game.resolve(url).replace(/\/$/, '');
    const remote = repoIn(game, path);
    if (!remote) return game.error(game.t('git-remote-missing', { repository: url }));
    const impossible = game.t('git-push-impossible', { repository: url });
    // What to send: main by default, the refspecs given, the tags with --tags.
    const specs = refspecs.length ? refspecs : allTags ? [] : ['main'];
    const updates: RefUpdate[] = [];
    const lines: string[] = [];
    const rejected: string[] = [];
    for (const raw of specs) {
      const forced = forceAll || raw.startsWith('+');
      const spec = raw.replace(/^\+/, '');
      const [srcRaw, dstRaw] = spec.includes(':') ? spec.split(':') : [spec, spec];
      const src = srcRaw.replace(/^refs\/(heads|tags)\//, '');
      const dst = (dstRaw || src).replace(/^refs\/(heads|tags)\//, '').replace(/^HEAD$/, 'main');
      const tag = here.repo.tags?.[src];
      if (tag && !spec.includes(':')) {
        const theirs = remote.tags?.[src];
        if (theirs && theirs.commit === tag.commit && !!theirs.signature === !!tag.signature) continue;
        if (theirs && !forced) {
          rejected.push(` ! [rejected]        ${src} -> ${src} (already exists)`);
          continue;
        }
        const target = allCommits(here.repo).find((c) => c.id === tag.commit)!;
        updates.push({ ref: `refs/tags/${src}`, before: theirs ? (allCommits(remote).find((c) => c.id === theirs.commit) ?? null) : null, after: target, forced: !!theirs, tag, commits: lineage(here.repo, target).filter((c) => !allCommits(remote).some((x) => x.id === c.id)) });
        continue;
      }
      const c = here.repo.commits.length || src !== 'main' ? findCommit(here.repo, src === 'main' ? 'HEAD' : src) : null;
      if (!c || dst !== 'main')
        return game.error(`${game.t('git-refspec-unknown', { ref: raw })}\n${impossible}`);
      const before = headRef(remote);
      if (before?.id === c.id) continue;
      const chain = lineage(here.repo, c);
      const fastForward = !before || chain.some((x) => x.id === before.id);
      if (!fastForward && !forced) {
        // The remote has commits we do not have (git pull first), or our branch went back (non-fast-forward).
        const known = allCommits(here.repo).some((x) => x.id === before!.id);
        rejected.push(` ! [rejected]        ${src} -> main (${known ? 'non-fast-forward' : 'fetch first'})`);
        continue;
      }
      updates.push({ ref: 'refs/heads/main', before, after: c, forced: !fastForward, commits: chain.filter((x) => !allCommits(remote).some((y) => y.id === x.id)) });
    }
    if (allTags)
      for (const [t, tag] of Object.entries(here.repo.tags ?? {}).sort()) {
        const theirs = remote.tags?.[t];
        if (theirs?.commit === tag.commit) continue;
        if (theirs && !forceAll) {
          rejected.push(` ! [rejected]        ${t} -> ${t} (already exists)`);
          continue;
        }
        const target = allCommits(here.repo).find((c) => c.id === tag.commit)!;
        updates.push({ ref: `refs/tags/${t}`, before: null, after: target, forced: !!theirs, tag, commits: lineage(here.repo, target).filter((c) => !allCommits(remote).some((x) => x.id === c.id)) });
      }
    if (!updates.length && !rejected.length) return game.t('git-all-a-day');
    const to = game.t('git-to', { repository: url });
    if (!updates.length)
      return game.error([to, ...rejected, impossible, ...(rejected.some((r) => r.includes('(fetch first)')) ? [game.t('git-push-rejected-tip')] : rejected.some((r) => r.includes('non-fast-forward')) ? [game.t('git-push-behind-tip')] : rejected.some((r) => r.includes('already exists')) ? [game.t('git-push-tag-exists-tip')] : [])].join('\n'));
    const fresh = new Set(updates.flatMap((u) => u.commits.map((c) => c.id))).size;
    const objets = Math.max(1, fresh * 3);
    lines.push(...game.t('git-push-progress', { objects: String(objets), bytes: String(240 + objets * 37) }).split('\n'));
    const refusal = (reason: string) => [to, ...updates.map((u) => ` ! [remote rejected] ${shortRef(u.ref)} -> ${shortRef(u.ref)} (${reason})`), impossible].join('\n');
    // Writing into a bare repository requires the right to write into its objects (a forge's own account writes there).
    const objetsPlace = game.find(`${path}/objects`) ?? game.find(`${path}/.git/objects`);
    if (!forge && objetsPlace && !game.can(objetsPlace, 'w')) return game.error([...lines, game.t('git-push-rights'), refusal('unpacker error')].join('\n'));
    // Pushing to the checked-out branch of a non-bare repository: refused (receive.denyCurrentBranch).
    if (!remote.bare) return game.error([...lines, game.t('git-push-branch-extracted'), refusal('branch is currently checked out')].join('\n'));
    // Sending takes a little time (the machine's clock moves forward).
    const sd = systemd(game);
    if (sd) sd.clock += 20_000;
    const remoteRefs: string[] = [];
    const prefix = () => remoteRefs.map((l) => `remote: ${l}`.trimEnd());
    // The forge's own pre-receive hook: protected branches, who may push.
    if (forge) {
      const refused = forgeReceive(game, forge.key, updates);
      if (refused) {
        remoteRefs.push(...refused);
        return game.error([...lines, ...prefix(), refusal('pre-receive hook declined')].join('\n'));
      }
    }
    const hook = (hookName: string): { code: number } | null => {
      if (forge) return null;
      const file = `${path}/hooks/${hookName}`;
      const n = game.find(file);
      if (n?.type !== 'file') return null;
      if (!game.can(n, 'x')) {
        remoteRefs.push(...game.t('git-hook-ignore', { hook: file }).split('\n'));
        return null;
      }
      const previous = general;
      general = {};
      game.state.gitHook = true;
      try {
        const r = runScript(game, content(n, game), {
          cwd: path,
          name: `hooks/${hookName}`,
          input: updates.map((u) => `${u.before?.id ?? '0'.repeat(40)} ${u.after.id} ${u.ref}`).join('\n'),
        });
        if (r.output) remoteRefs.push(...r.output.split('\n'));
        return { code: r.code };
      } finally {
        general = previous;
        game.state.gitHook = false;
      }
    };
    const pre = hook('pre-receive');
    if (pre && pre.code !== 0) return game.error([...lines, ...prefix(), refusal('pre-receive hook declined'), ].join('\n'));
    const results: string[] = [];
    for (const u of updates) {
      const pool = [...allCommits(remote), ...u.commits];
      if (u.tag) {
        (remote.tags ??= {})[shortRef(u.ref)] = { ...u.tag };
        remote.objects = [...(remote.objects ?? []), ...u.commits.filter((c) => !allCommits(remote).some((x) => x.id === c.id))];
        if (!remote.objects.length) delete remote.objects;
        results.push(u.forced ? ` + ${short(u.before)}...${short(u.after)} ${shortRef(u.ref)} -> ${shortRef(u.ref)} (forced update)` : ` * [new tag]         ${shortRef(u.ref)} -> ${shortRef(u.ref)}`);
        continue;
      }
      moveBranch(remote, u.after, pool);
      logRef(remote, u.after.id, 'push', now(game));
      results.push(
        !u.before
          ? ' * [new branch]      main -> main'
          : u.forced
            ? ` + ${short(u.before)}...${short(u.after)} main -> main (forced update)`
            : `   ${short(u.before)}..${short(u.after)}  main -> main`,
      );
    }
    game.state.gitPushes = (game.state.gitPushes ?? 0) + 1;
    hook('post-receive');
    if (forge) remoteRefs.push(...forgeReceived(game, forge.key, updates));
    return [...lines, ...prefix(), to, ...results, ...rejected, ...(rejected.length ? [impossible] : []), ...(follow ? [game.t('git-push-follow', { remote: name })] : [])].join('\n');
  },

  pull: (game, args) => {
    const here = hereRepo(game);
    if (!here) return game.error(game.t('git-not-repo'));
    if (here.repo.bare) return game.error(game.t('git-not-tree'));
    const [remoteName] = args.filter((a) => !a.startsWith('-'));
    const name = remoteName ?? (here.repo.remotes?.origin ? 'origin' : undefined);
    if (!name) return game.error(game.t('git-pull-without-remote'));
    const url = here.repo.remotes?.[name] ?? name;
    const remote = repoIn(game, forgeRemote(game, url)?.path ?? game.resolve(url).replace(/\/$/, ''));
    if (!remote) return game.error(game.t('git-remote-missing', { repository: url }));
    for (const [k, v] of Object.entries(remote.tags ?? {})) (here.repo.tags ??= {})[k] ??= { ...v };
    const their = headRef(remote);
    const our = headRef(here.repo);
    const header = [game.t('git-since', { repository: url }), ' * branch            main       -> FETCH_HEAD'];
    if (!their || their.id === our?.id || here.repo.commits.some((c) => c.id === their.id)) return [...header, game.t('git-already-a-day')].join('\n');
    if (our && !remote.commits.some((c) => c.id === our.id)) return game.error([...header, game.t('git-pull-diverge')].join('\n'));
    const before = our?.files ?? {};
    here.repo.commits = [...remote.commits];
    here.repo.index = { ...their.files };
    for (const [f, text] of Object.entries(their.files)) write(game, `${here.path}/${f}`, text);
    for (const f of Object.keys(before)) if (!(f in their.files)) remove(game, here.path, f);
    logRef(here.repo, their.id, 'pull: Fast-forward', now(game));
    const { files, more, moins: less } = account(before, their.files);
    // "index.html | 2 +-", like git (one + per added line, one - per removed line).
    const names = [...new Set([...Object.keys(before), ...Object.keys(their.files)])]
      .filter((n) => before[n] !== their.files[n])
      .sort()
      .map((n) => {
        const k = account({ [n]: before[n] ?? '' }, { [n]: their.files[n] ?? '' });
        return `${n} | ${k.more + k.moins} ${'+'.repeat(k.more)}${'-'.repeat(k.moins)}`;
      });
    const summary = [
      game.t('git-commit-files', { count: files }),
      ...(more ? [game.t('git-commit-insertions', { count: more })] : []),
      ...(less ? [game.t('git-commit-deletions', { count: less })] : []),
    ].join(', ');
    return [
      ...header,
      game.t('git-update', { before: short(our), after: short(their) }),
      game.t('git-advance-fast'),
      ...names.map((n) => ` ${n}`),
      ` ${summary}`,
    ].join('\n');
  },
};

export const GIT: Record<string, Command> = {
  git: {
    ownOptions: true,
    launch: (c) => {
      const { args, game } = c;
      // The global options, before the subcommand.
      const previous = general;
      general = { ...general };
      let i = 0;
      let moveTo: string | null = null;
      for (; i < args.length && args[i].startsWith('-'); i++) {
        const a = args[i];
        if (a.startsWith('--git-dir=')) general.gitDir = a.slice(10);
        else if (a === '--git-dir') general.gitDir = args[++i];
        else if (a.startsWith('--work-tree=')) general.workTree = a.slice(12);
        else if (a === '--work-tree') general.workTree = args[++i];
        else if (a === '-C') {
          const dir = args[++i];
          if (!dir || game.find(game.resolve(dir))?.type !== 'directory') return game.error(`fatal: cannot change to '${dir ?? ''}': No such file or directory`, 128);
          moveTo = game.resolve(dir);
        } else if (a === '--version') return 'git version 2.47.2';
        else if (a === '--help') return game.t('git-usage');
        else return game.error(game.t('git-option-unknown', { option: a }));
      }
      const [under, ...raw] = args.slice(i);
      // --color[=WHEN] and --no-color, on the subcommand; by default, on screen only.
      const colour = readColour(raw.filter((a) => a !== '--no-color'), raw.includes('--no-color') ? 'never' : 'auto');
      const rest = colour.args;
      general.colour = colourise(c, colour.when);
      const cwd = game.cwd;
      if (moveTo) game.cwd = moveTo;
      try {
        if (!under) return game.error(game.t('git-usage'));
        const f = UNDER[under];
        if (!f) return game.error(game.t('git-under-command-unknown', { command: under, commands: Object.keys(UNDER).join(', ') }));
        const output = f(game, rest);
        return ['diff', 'show', 'log'].includes(under) ? colourDiff(output) : output;
      } finally {
        general = previous;
        game.cwd = cwd;
      }
    },
  },
};
