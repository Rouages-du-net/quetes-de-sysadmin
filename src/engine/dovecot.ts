// A machine's Dovecot 2.4 (Debian 13's dovecot-core, dovecot-lmtpd,
// dovecot-sieve): the configuration read like doveconf (dovecot.conf and
// conf.d/*.conf, `key = value`, named filters `quota "User quota" { … }`,
// !include and !include_try), the passwd-file userdb (/etc/dovecot/users,
// its userdb_* extra fields), the users' Maildirs (Maildir++ folders .Trash,
// .Junk…, files named with ,S=size), the quota (the count and maildir
// drivers, the maildirsize file, storage grace, quota warnings) and LMTP
// delivery with the Sieve plugin (sieve.ts), logged to /var/log/mail.log.
// After https://doc.dovecot.org/2.4.1/core/plugins/quota.html,
// https://doc.dovecot.org/2.4.1/core/config/delivery/lmtp.html,
// https://doc.dovecot.org/2.4.1/core/config/auth/databases/passwd_file.html,
// https://doc.dovecot.org/2.4.1/core/config/mailbox_formats/maildir.html and
// https://doc.dovecot.org/2.4.1/core/plugins/sieve.html.
//
//   state.dovecot = { loaded: the configuration in use (null: stopped),
//     counter: for file names, warnings: the quota warnings run,
//     deliveries: what LMTP did (for the chapters) }
//
// Differences: no IMAP sessions (mail clients are not simulated); the
// configuration is validated only for the quota and sieve settings; the
// maildirsize file is read and written, but never recalculated on its own
// when it grows past 5120 bytes; a userdb extra field overrides the setting
// inside the quota filter.

import type { Game, Shell } from './shell';
import type { Directory, File, Node } from './world';
import { systemd, writeLog as journal } from './systemd';
import { logTime, MAIL_LOG } from './mail';
import { compile, execute, type SieveResult } from './sieve';

export const VERSION = '2.4.1-4 (7d8c0e5759)';
export const PIGEONHOLE = '2.4.1-4 (0a86619f)';
export const DOVECOT_CONF = '/etc/dovecot/dovecot.conf';
export const USERS = '/etc/dovecot/users';
export const VMAIL = { uid: 5000, gid: 5000, user: 'vmail' };

// ——— The configuration ———

export interface ConfNode {
  kind: 'setting' | 'section';
  key: string;
  // A named filter's name ("User quota" in quota "User quota" { … }).
  name?: string;
  value?: string;
  children?: ConfNode[];
  file: string;
  line: number;
}

export interface ConfError {
  file: string;
  line: number;
  message: string;
}

// Settings the game checks (others are accepted as they are), by the section they are in ('' at the top).
const QUOTA_KEYS = ['quota_driver', 'driver', 'quota_storage_size', 'storage_size', 'quota_message_count', 'message_count', 'quota_storage_grace', 'storage_grace', 'quota_storage_percentage', 'storage_percentage', 'quota_storage_extra', 'storage_extra', 'quota_name', 'quota_ignore', 'quota_enforce', 'quota_hidden', 'quota_mail_size', 'quota_exceeded_message', 'quota_full_tempfail'];
const WARNING_KEYS = ['quota_storage_percentage', 'storage_percentage', 'quota_message_percentage', 'message_percentage', 'quota_warning_threshold', 'threshold', 'quota_warning_resource', 'resource', 'quota_storage_size', 'storage_size'];
const SIEVE_SCRIPT_KEYS = ['type', 'sieve_script_type', 'path', 'sieve_script_path', 'active_path', 'sieve_script_active_path', 'driver', 'sieve_script_driver', 'name', 'sieve_script_name', 'bin_path', 'sieve_script_bin_path'];

const unknownIn = (section: string, key: string): boolean => {
  if (section === 'quota') return !QUOTA_KEYS.includes(key) && !['warning', 'quota_warning'].includes(key);
  if (section === 'warning' || section === 'quota_warning') return !WARNING_KEYS.includes(key) && key !== 'execute';
  if (section === 'sieve_script') return !SIEVE_SCRIPT_KEYS.includes(key);
  if (section === 'execute') return !['args', 'execute_args'].includes(key);
  if (section === '') return (/^quota_/.test(key) && !QUOTA_KEYS.includes(key) && key !== 'quota_warning') || (/^sieve_/.test(key) && !SIEVE_TOP.includes(key));
  return false;
};
const SIEVE_TOP = ['sieve_script', 'sieve_extensions', 'sieve_global_extensions', 'sieve_plugins', 'sieve_vacation_default_period', 'sieve_vacation_min_period', 'sieve_vacation_max_period', 'sieve_vacation_check_recipient', 'sieve_vacation_use_original_recipient', 'sieve_vacation_send_from_recipient', 'sieve_max_script_size', 'sieve_max_actions', 'sieve_max_redirects', 'sieve_quota_storage_size', 'sieve_user_log_path', 'sieve_trace_dir', 'sieve_trace_level'];

/** Reads dovecot.conf and what it includes, like doveconf: the tree, or the first error. */
export function readConf(game: Game, path = DOVECOT_CONF): { tree: ConfNode[]; error: ConfError | null } {
  const top: ConfNode[] = [];
  const stack: { node: ConfNode | null; children: ConfNode[] }[] = [{ node: null, children: top }];
  let error: ConfError | null = null;
  const parseFile = (file: string, depth: number): void => {
    if (error) return;
    const text = game.read(file);
    if (text === null) {
      error = { file, line: 0, message: `open(${file}) failed: No such file or directory` };
      return;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && !error; i++) {
      const raw = lines[i].replace(/(^|\s)#.*$/, '').trim();
      if (!raw) continue;
      const at = { file, line: i + 1 };
      const include = /^!(include|include_try)\s+(\S+)$/.exec(raw);
      if (include) {
        const target = include[2].startsWith('/') ? include[2] : `${file.replace(/\/[^/]*$/, '')}/${include[2]}`;
        const found = globFiles(game, target);
        if (!found.length && include[1] === 'include' && !/[*?]/.test(target)) {
          error = { ...at, message: `Couldn't open include file ${target}: No such file or directory` };
          return;
        }
        if (depth < 4) for (const f of found) parseFile(f, depth + 1);
        continue;
      }
      if (raw === '}') {
        if (stack.length === 1) {
          error = { ...at, message: "Unexpected '}'" };
          return;
        }
        stack.pop();
        continue;
      }
      const open = /^([A-Za-z_][\w-]*)(?:\s+("([^"]*)"|[^\s{]+))?\s*\{$/.exec(raw);
      if (open) {
        const section = stack[stack.length - 1].node?.key ?? '';
        if (unknownIn(section, open[1]) && section !== '') {
          error = { ...at, message: `Unknown section name: ${open[1]}` };
          return;
        }
        const node: ConfNode = { kind: 'section', key: open[1], name: open[3] ?? open[2], children: [], ...at };
        stack[stack.length - 1].children.push(node);
        stack.push({ node, children: node.children! });
        continue;
      }
      const set = /^([A-Za-z_][\w/-]*)\s*=\s*(.*)$/.exec(raw);
      if (set) {
        const section = stack[stack.length - 1].node?.key ?? '';
        if (unknownIn(section, set[1])) {
          error = { ...at, message: `Unknown setting: ${set[1]}` };
          return;
        }
        stack[stack.length - 1].children.push({ kind: 'setting', key: set[1], value: set[2].replace(/^"(.*)"$/, '$1'), ...at });
        continue;
      }
      error = { ...at, message: `Expecting '='` };
    }
  };
  parseFile(path, 0);
  if (!error && stack.length > 1) {
    const open = stack[stack.length - 1].node!;
    error = { file: open.file, line: open.line, message: "Missing '}'" };
  }
  return { tree: top, error };
}

/** The files a path or a glob names (conf.d/*.conf), in order. */
function globFiles(game: Game, target: string): string[] {
  if (!/[*?]/.test(target)) return game.read(target) !== null ? [target] : [];
  const dir = target.replace(/\/[^/]*$/, '');
  const pattern = new RegExp('^' + target.slice(dir.length + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  const n = game.find(dir);
  if (n?.type !== 'directory') return [];
  return Object.keys(n.children)
    .filter((k) => pattern.test(k) && n.children[k].type === 'file')
    .sort()
    .map((k) => `${dir}/${k}`);
}

export const confErrorText = (e: ConfError) =>
  e.line ? `doveconf: Fatal: Error in configuration file ${e.file} line ${e.line}: ${e.message}` : `doveconf: Fatal: Error in configuration file ${e.file}: ${e.message}`;

/** The last value of a top-level setting (the last one wins, like doveconf). */
export function setting(tree: ConfNode[], key: string): string | undefined {
  let v: string | undefined;
  for (const n of tree) if (n.kind === 'setting' && n.key === key) v = n.value;
  return v;
}
const sectionsOf = (tree: ConfNode[], key: string) => tree.filter((n) => n.kind === 'section' && n.key === key);
const inside = (n: ConfNode, ...keys: string[]): string | undefined => {
  let v: string | undefined;
  for (const c of n.children ?? []) if (c.kind === 'setting' && keys.includes(c.key)) v = c.value;
  return v;
};

/** doveconf -n: the configuration as Dovecot reads it, with the version lines. */
export function confText(tree: ConfNode[], host: string): string {
  const lines = [`# ${VERSION}: ${DOVECOT_CONF}`, `# Pigeonhole version ${PIGEONHOLE}`, '# OS: Linux 6.12.0-quetes x86_64 Debian 13.2 ext4', `# Hostname: ${host}`];
  const out = (nodes: ConfNode[], indent: string) => {
    for (const n of nodes) {
      if (n.kind === 'setting') lines.push(`${indent}${n.key} = ${n.value}`);
      else {
        lines.push(`${indent}${n.key}${n.name ? ` ${/\s/.test(n.name) ? `"${n.name}"` : n.name}` : ''} {`);
        out(n.children ?? [], indent + '  ');
        lines.push(`${indent}}`);
      }
    }
  };
  out(tree, '');
  return lines.join('\n');
}

/** A section (or a setting) by path: "quota", "service/quota-warning". */
export function confPath(tree: ConfNode[], path: string): ConfNode[] {
  let nodes = tree;
  const parts = path.split('/');
  let found: ConfNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    found = nodes.filter((n) => n.key === parts[i] || (i > 0 && n.name === parts[i] && n.key === parts[i - 1]));
    if (i < parts.length - 1) {
      const next = parts[i + 1];
      const named = found.filter((n) => n.name === next);
      if (named.length) {
        i++;
        found = named;
      }
      nodes = found.flatMap((n) => n.children ?? []);
    }
  }
  return found;
}

// ——— State ———

export interface Delivery {
  time: number;
  user: string;
  // Where it went (a mailbox), or why not: 'quota', 'unknown', 'rejected'.
  mailbox: string | null;
  error?: string;
  msgid: string;
  // Sieve's actions (fileinto, vacation sent or discarded…), for the chapters.
  sieve?: string[];
  // The original recipient (an alias, bookings@…), when it differs.
  orig?: string;
}

export interface DovecotState {
  loaded: ConfNode[] | null;
  counter: number;
  warnings: { user: string; args: string; time: number }[];
  deliveries: Delivery[];
  // Vacation replies already sent (.dovecot.lda-dupes): user → sender → time.
  dupes: Record<string, Record<string, number>>;
  // Replies "sent" by vacation (to whom, from whom, subject).
  replies: { to: string; from: string; subject: string; time: number; kind: 'vacation' | 'reject' }[];
}

export const dovecot = (game: Game): DovecotState | undefined => game.state.dovecot as DovecotState | undefined;
export const newDovecot = (): DovecotState => ({ loaded: null, counter: 0, warnings: [], deliveries: [], dupes: {}, replies: [] });
export const running = (game: Game) => systemd(game)?.services.dovecot?.state === 'active' && !!dovecot(game)?.loaded;

/** The configuration in use, or what the files say (doveadm reads the files). */
export const conf = (game: Game): ConfNode[] => dovecot(game)?.loaded ?? readConf(game).tree;

export function attachDovecot(game: Game) {
  const svc = systemd(game)?.services.dovecot;
  if (!svc) return;
  svc.check = (g) => {
    const r = readConf(g);
    return r.error ? [confErrorText(r.error)] : null;
  };
  svc.checkToReload = true;
  svc.load = (g) => {
    const st = dovecot(g);
    if (st) st.loaded = readConf(g).tree;
  };
  svc.stop = (g) => {
    const st = dovecot(g);
    if (st) st.loaded = null;
  };
}

/** doveadm reload: the running Dovecot rereads its configuration. */
export function reloadDovecot(game: Game): ConfError | null {
  const r = readConf(game);
  if (r.error) return r.error;
  const sd = systemd(game);
  const st = dovecot(game);
  if (st && running(game)) st.loaded = r.tree;
  if (sd) journal(sd, 'dovecot.service', 'dovecot', 1102, 'master: Warning: SIGHUP received - reloading configuration');
  return null;
}

// ——— Users (passwd-file) ———

export interface MailUser {
  user: string;
  uid: number;
  gid: number;
  home: string;
  fields: Record<string, string>;
}

/** /etc/dovecot/users: user:password:uid:gid:gecos:home:shell:extra fields (userdb_key=value). */
export function users(game: Game): MailUser[] {
  const text = game.read(USERS) ?? '';
  return text
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const p = l.split(':');
      const fields: Record<string, string> = {};
      for (const kv of (p.slice(7).join(':') ?? '').split(/\s+/).filter(Boolean)) {
        const m = /^(?:userdb_)?([\w/]+)=(.*)$/.exec(kv);
        if (m && kv.startsWith('userdb_')) fields[m[1]] = m[2];
      }
      return { user: p[0].toLowerCase(), uid: Number(p[2] || VMAIL.uid), gid: Number(p[3] || VMAIL.gid), home: p[5] ?? '', fields };
    });
}
export const lookup = (game: Game, user: string) => users(game).find((u) => u.user === user.toLowerCase()) ?? null;
/** -u mask: a user, or '*' and '?' wildcards. */
export function matchUsers(game: Game, mask: string): MailUser[] {
  if (!/[*?]/.test(mask)) return users(game).filter((u) => u.user === mask.toLowerCase());
  const re = new RegExp('^' + mask.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return users(game).filter((u) => re.test(u.user));
}

// ——— Sizes ———

/** "1G", "500 M", "1024k", "1073741824", "unlimited" → bytes (0: unlimited); null if unreadable. */
export function parseSize(text: string | undefined): number | null {
  if (text === undefined) return null;
  const t = text.trim();
  if (/^unlimited$/i.test(t)) return 0;
  const m = /^(\d+(?:\.\d+)?)\s*([bkmgt]?)b?$/i.exec(t);
  if (!m) return null;
  const mult: Record<string, number> = { '': 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
  return Math.round(Number(m[1]) * mult[m[2].toLowerCase()]);
}

// ——— The quota ———

export interface QuotaRoot {
  name: string;
  driver: string;
  limit: number;
  grace: number;
  warnings: { name: string; percentage: number; threshold: string; service: string; args: string }[];
  tempfail: boolean;
  message: string;
}

/** The user's quota root (null: the quota plugin is not enabled, or no quota is configured). */
export function quotaRoot(game: Game, user: MailUser, tree = conf(game)): QuotaRoot | null {
  const plugins = [...sectionsOf(tree, 'mail_plugins'), ...sectionsOf(tree, 'protocol').filter((p) => p.name === 'lmtp').flatMap((p) => sectionsOf(p.children ?? [], 'mail_plugins'))];
  const enabled = plugins.some((p) => /^yes$/i.test(inside(p, 'quota') ?? ''));
  const block = sectionsOf(tree, 'quota')[0];
  if (!enabled || !block) return null;
  const global = (k: string) => setting(tree, k);
  const sizeText = user.fields.quota_storage_size ?? inside(block, 'quota_storage_size', 'storage_size') ?? global('quota_storage_size');
  const graceText = inside(block, 'quota_storage_grace', 'storage_grace') ?? global('quota_storage_grace') ?? '10M';
  const warnings = (block.children ?? [])
    .filter((c) => c.kind === 'section' && (c.key === 'warning' || c.key === 'quota_warning'))
    .map((w) => {
      const exec = (w.children ?? []).find((c) => c.kind === 'section' && c.key === 'execute');
      return {
        name: w.name ?? '',
        percentage: Number(inside(w, 'quota_storage_percentage', 'storage_percentage') ?? 100),
        threshold: inside(w, 'quota_warning_threshold', 'threshold') ?? 'over',
        service: exec?.name ?? '',
        args: exec ? (inside(exec, 'args', 'execute_args') ?? '') : '',
      };
    });
  return {
    name: inside(block, 'quota_name') ?? block.name ?? 'User quota',
    driver: inside(block, 'quota_driver', 'driver') ?? global('quota_driver') ?? 'count',
    limit: parseSize(sizeText) ?? 0,
    grace: parseSize(graceText) ?? 10 * 1024 ** 2,
    warnings,
    tempfail: /^yes$/i.test(global('quota_full_tempfail') ?? 'no'),
    message: global('quota_exceeded_message') ?? 'Quota exceeded (mailbox for user is full)',
  };
}

// ——— Maildir ———

export interface Stored {
  mailbox: string;
  path: string;
  name: string;
  size: number;
  // The save date (the file's date) and the message's received date (from its name).
  saved: number;
  received: number;
  file: File;
}

const maildirOf = (u: MailUser) => `${u.home}/Maildir`;
/** A mailbox's directory: INBOX is the Maildir itself, Trash is .Trash (Maildir++). */
export const mailboxDir = (u: MailUser, mailbox: string) => (mailbox.toUpperCase() === 'INBOX' ? maildirOf(u) : `${maildirOf(u)}/.${mailbox.replace(/\//g, '.')}`);

/** The user's mailboxes, INBOX first. */
export function mailboxes(game: Game, u: MailUser): string[] {
  const n = game.find(maildirOf(u));
  if (n?.type !== 'directory') return [];
  const others = Object.keys(n.children)
    .filter((k) => k.startsWith('.') && k.length > 1 && n.children[k].type === 'directory' && (n.children[k] as Directory).children.cur)
    .map((k) => k.slice(1));
  return ['INBOX', ...others.sort()];
}

const sizeOfName = (name: string, f: File) => Number(/,S=(\d+)/.exec(name)?.[1] ?? f.size ?? (typeof f.content === 'string' ? f.content.length : 0));

/** The messages of a mailbox (new/ and cur/). */
export function messagesOf(game: Game, u: MailUser, mailbox: string): Stored[] {
  const dir = mailboxDir(u, mailbox);
  const out: Stored[] = [];
  for (const sub of ['cur', 'new']) {
    const n = game.find(`${dir}/${sub}`);
    if (n?.type !== 'directory') continue;
    for (const [name, f] of Object.entries(n.children)) {
      if (f.type !== 'file') continue;
      const received = Number(/^(\d+)\./.exec(name)?.[1] ?? 0) * 1000;
      out.push({ mailbox: mailbox === 'INBOX' ? 'INBOX' : mailbox, path: `${dir}/${sub}/${name}`, name, size: sizeOfName(name, f), saved: f.mtime ?? received, received, file: f });
    }
  }
  return out.sort((a, b) => a.received - b.received || a.name.localeCompare(b.name));
}
export const allMessages = (game: Game, u: MailUser) => mailboxes(game, u).flatMap((m) => messagesOf(game, u, m));
export const actualUsage = (game: Game, u: MailUser) => {
  const all = allMessages(game, u);
  return { bytes: all.reduce((t, m) => t + m.size, 0), count: all.length };
};

// The maildirsize file (Maildir++ quota): "<limit>S" then lines "<bytes> <count>".
const maildirsizePath = (u: MailUser) => `${maildirOf(u)}/maildirsize`;
function maildirsize(game: Game, u: MailUser): { bytes: number; count: number } | null {
  const text = game.read(maildirsizePath(u));
  if (text === null) return null;
  let bytes = 0;
  let count = 0;
  for (const l of text.split('\n').slice(1)) {
    const m = /^\s*(-?\d+)\s+(-?\d+)\s*$/.exec(l);
    if (m) {
      bytes += Number(m[1]);
      count += Number(m[2]);
    }
  }
  return { bytes, count };
}
function writeMaildirsize(game: Game, u: MailUser, lines: string[], append: boolean) {
  const path = maildirsizePath(u);
  const n = game.find(path);
  if (append && n?.type === 'file' && typeof n.content === 'string') n.content = `${n.content.replace(/\n*$/, '')}\n${lines.join('\n')}`;
  else putFile(game, path, lines.join('\n'), { owner: VMAIL.user, group: VMAIL.user, mode: 'rw-------' });
}

/** The usage the quota knows (maildir driver: maildirsize, made on first use; count: the mailboxes themselves). */
export function usage(game: Game, u: MailUser, root = quotaRoot(game, u)): { bytes: number; count: number } {
  if (root?.driver === 'maildir') {
    const known = maildirsize(game, u);
    if (known) return known;
    recalc(game, u, root);
    return maildirsize(game, u)!;
  }
  return actualUsage(game, u);
}

/** doveadm quota recalc: the usage counted again from the mailboxes. */
export function recalc(game: Game, u: MailUser, root = quotaRoot(game, u)) {
  if (root?.driver !== 'maildir') return;
  const a = actualUsage(game, u);
  writeMaildirsize(game, u, [`${root.limit}S`, `${a.bytes} ${a.count}`], false);
}

/** A change of usage made through Dovecot (a delivery, an expunge): maildirsize follows. */
function account(game: Game, u: MailUser, bytes: number, count: number) {
  const root = quotaRoot(game, u);
  if (root?.driver !== 'maildir') return;
  if (!maildirsize(game, u)) recalc(game, u, root);
  writeMaildirsize(game, u, [`${bytes} ${count}`], true);
}

// ——— Writing in the world (as the vmail user) ———

export function ensureDir(game: Game, path: string, owner = VMAIL.user): Directory | null {
  let n: Node | null = game.find('/');
  for (const part of path.split('/').filter(Boolean)) {
    if (n?.type !== 'directory') return null;
    if (!n.children[part]) n.children[part] = { type: 'directory', children: {}, owner, group: owner, mode: 'rwx------' };
    n = n.children[part];
  }
  return n?.type === 'directory' ? n : null;
}
export function putFile(game: Game, path: string, content: string, rights: Partial<File> = {}) {
  const dir = ensureDir(game, path.replace(/\/[^/]*$/, ''));
  if (!dir) return;
  dir.children[path.split('/').pop()!] = { type: 'file', content, lines: true, ...rights };
}
/** Creates a mailbox (Maildir++: .Name with cur, new, tmp). */
export function createMailbox(game: Game, u: MailUser, mailbox: string) {
  const dir = mailboxDir(u, mailbox);
  for (const sub of ['cur', 'new', 'tmp']) ensureDir(game, `${dir}/${sub}`);
}
export function removeMessage(game: Game, u: MailUser, m: Stored) {
  game.erase(m.path);
  account(game, u, -m.size, -1);
}

/** A file name like Dovecot's for Maildir: <time>.M<usecs>P<pid>.<host>,S=<size>,W=<vsize>:2,<flags>. */
export function maildirName(game: Game, time: number, size: number, flags = ''): string {
  const st = dovecot(game)!;
  st.counter++;
  const host = (game.read('/etc/hostname') ?? 'localhost').trim();
  return `${Math.floor(time / 1000)}.M${(st.counter * 7919) % 1_000_000}P${3100 + (st.counter % 700)}.${host},S=${size},W=${size + Math.round(size / 60)}${flags ? `:2,${flags}` : ''}`;
}

// ——— Messages ———

export interface Mail {
  headers: [string, string][];
  body: string;
  // The size on disk (big attachments): otherwise the text's.
  size?: number;
}

export function parseMail(text: string): Mail {
  const cut = text.search(/\r?\n\r?\n/);
  const head = cut < 0 ? text : text.slice(0, cut);
  const body = cut < 0 ? '' : text.slice(cut).replace(/^\r?\n\r?\n/, '');
  const headers: [string, string][] = [];
  for (const l of head.split(/\r?\n/)) {
    if (/^[ \t]/.test(l) && headers.length) headers[headers.length - 1][1] += ' ' + l.trim();
    else {
      const m = /^([!-9;-~]+):\s*(.*)$/.exec(l);
      if (m) headers.push([m[1], m[2]]);
    }
  }
  return { headers, body };
}
export const mailText = (m: Mail) => `${m.headers.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${m.body}`;
export const header = (m: Mail, name: string) => m.headers.filter(([k]) => k.toLowerCase() === name.toLowerCase()).map(([, v]) => v);
export const addressesIn = (value: string): string[] => [...value.matchAll(/<?([^\s<>,"]+@[^\s<>,"]+)>?/g)].map((x) => x[1].toLowerCase());
export const sizeOf = (m: Mail) => m.size ?? mailText(m).length;

// ——— The log (/var/log/mail.log) ———

export function mailLog(game: Game, program: string, pid: number, message: string) {
  const sd = systemd(game);
  const n = game.find(MAIL_LOG);
  if (!sd || n?.type !== 'file' || typeof n.content !== 'string') return;
  n.content = `${n.content ? n.content + '\n' : ''}${logTime(sd.clock)} ${sd.host} ${program}[${pid}]: ${message}`;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** The LMTP session's id (22 base64 characters), as Dovecot logs it and puts in its reply. */
const sessionId = (game: Game) => {
  let h = 0x811c9dc5 ^ dovecot(game)!.deliveries.length;
  let out = '';
  for (let i = 0; out.length < 22; i++) {
    h = Math.imul(h ^ (i + 31), 0x01000193) >>> 0;
    out += B64[h % 64];
  }
  return out;
};
const session = (game: Game) => `<${4200 + (dovecot(game)!.deliveries.length % 50)}><${sessionId(game)}>`;

// ——— LMTP delivery ———

export interface LmtpResult {
  code: string;
  delivery: Delivery;
}

/**
 * Dovecot's LMTP receives a message for a user: the user lookup, the
 * quota (with its grace and its warnings), Sieve (before scripts, then the
 * user's active script), the Maildir. Returns the LMTP reply.
 */
export function lmtpDeliver(game: Game, rcpt: string, mail: Mail, env: { from: string; orig?: string; time: number }): LmtpResult {
  const st = dovecot(game)!;
  const msgid = header(mail, 'Message-ID')[0] ?? '<none>';
  const u = lookup(game, rcpt);
  const base = { time: env.time, user: rcpt.toLowerCase(), msgid, ...(env.orig && env.orig !== rcpt ? { orig: env.orig } : {}) };
  if (!u) {
    const d: Delivery = { ...base, mailbox: null, error: 'unknown' };
    st.deliveries.push(d);
    return { code: `550 5.1.1 <${rcpt}> User doesn't exist: ${rcpt}`, delivery: d };
  }
  const sid = sessionId(game);
  const who = `lmtp(${u.user})${session(game)}`;
  // Sieve decides where the message goes (or the implicit keep: INBOX).
  const sieve = runSieve(game, u, mail, env);
  const actions: string[] = sieve.log;
  const targets = sieve.stores.length ? sieve.stores : sieve.keep ? ['INBOX'] : [];
  const root = quotaRoot(game, u);
  const size = sizeOf(mail);
  let saved: string | null = null;
  for (const target of targets) {
    if (root && root.limit > 0) {
      const used = usage(game, u, root).bytes;
      const over = used > root.limit || used + size > root.limit + root.grace;
      if (over) {
        mailLog(game, 'dovecot', 4201, sieve.script ? `${who}: sieve: msgid=${msgid}: failed to store into mailbox '${target}': ${root.message}` : `${who}: msgid=${msgid}: save failed to ${target}: ${root.message}`);
        const d: Delivery = { ...base, mailbox: null, error: 'quota', sieve: actions };
        st.deliveries.push(d);
        return { code: root.tempfail ? `452 4.2.2 <${rcpt}> ${root.message}` : `552 5.2.2 <${rcpt}> ${root.message}`, delivery: d };
      }
    }
    let mailbox = target;
    if (!mailboxes(game, u).some((b) => b.toLowerCase() === target.toLowerCase())) {
      if (sieve.create.includes(target)) createMailbox(game, u, target);
      else {
        mailLog(game, 'dovecot', 4201, `${who}: sieve: msgid=${msgid}: failed to store into mailbox '${target}': Mailbox doesn't exist: ${target}`);
        mailLog(game, 'dovecot', 4201, `${who}: sieve: Execution of script ${sieve.script ?? ''} failed, but implicit keep was successful (user logfile ${u.home}/.dovecot.sieve.log may reveal additional details)`);
        actions.push(`failed:${target}`);
        mailbox = 'INBOX';
      }
    }
    const before = root ? usage(game, u, root).bytes : 0;
    const name = maildirName(game, env.time, size);
    const dir = mailboxDir(u, mailbox);
    ensureDir(game, `${dir}/new`);
    putFile(game, `${dir}/new/${name}`, mailText(mail), { owner: VMAIL.user, group: VMAIL.user, mode: 'rw-------', size, mtime: env.time });
    account(game, u, size, 1);
    const how = sieve.stores.includes(target) && target !== 'INBOX' ? 'fileinto action: ' : '';
    mailLog(game, 'dovecot', 4201, sieve.script ? `${who}: sieve: msgid=${msgid}: ${how}stored mail into mailbox '${mailbox}'` : `${who}: msgid=${msgid}: saved mail to ${mailbox}`);
    saved = saved ?? mailbox;
    if (root) quotaWarnings(game, u, root, before);
  }
  for (const l of sieve.messages) mailLog(game, 'dovecot', 4201, `${who}: sieve: msgid=${msgid}: ${l}`);
  const d: Delivery = { ...base, mailbox: saved ?? (sieve.rejected ? null : 'discarded'), ...(sieve.rejected ? { error: 'rejected' } : {}), sieve: actions };
  st.deliveries.push(d);
  return { code: `250 2.0.0 <${rcpt}> ${sid} Saved`, delivery: d };
}

/** The quota warnings crossed by this delivery: only the first one that matches runs (the highest first). */
function quotaWarnings(game: Game, u: MailUser, root: QuotaRoot, before: number) {
  if (!root.limit) return;
  const after = usage(game, u, root).bytes;
  for (const w of root.warnings) {
    const at = (root.limit * w.percentage) / 100;
    const crossed = w.threshold === 'under' ? before >= at && after < at : before < at && after >= at;
    if (!crossed) continue;
    const st = dovecot(game)!;
    const args = w.args.replace(/%\{user\}|%u/g, u.user);
    st.warnings.push({ user: u.user, args, time: systemd(game)?.clock ?? 0 });
    mailLog(game, 'dovecot', 4202, `script(quota-warning): Executing ${args}`);
    break;
  }
}

// ——— Sieve at delivery ———

export interface SieveRun {
  keep: boolean;
  stores: string[];
  create: string[];
  rejected: boolean;
  log: string[];
  messages: string[];
  script?: string;
}

/** The scripts the Sieve plugin runs: the before storages, then the user's active personal script. */
export function sieveScripts(game: Game, u: MailUser, tree = conf(game)): { before: string[]; personal: string | null; storage: { path: string; active: string } } {
  const expand = (p: string) => p.replace(/^~/, u.home).replace(/%\{user \| domain\}/g, u.user.split('@')[1] ?? '').replace(/%\{user \| username\}/g, u.user.split('@')[0]).replace(/%\{user\}|%u/g, u.user);
  const plugins = [...sectionsOf(tree, 'mail_plugins'), ...sectionsOf(tree, 'protocol').filter((p) => p.name === 'lmtp').flatMap((p) => sectionsOf(p.children ?? [], 'mail_plugins'))];
  const enabled = plugins.some((p) => /^yes$/i.test(inside(p, 'sieve') ?? ''));
  const storages = sectionsOf(tree, 'sieve_script');
  const before: string[] = [];
  let storage = { path: `${u.home}/sieve`, active: `${u.home}/.dovecot.sieve` };
  let personalSeen = false;
  for (const s of storages) {
    const type = inside(s, 'type', 'sieve_script_type') ?? 'personal';
    const path = inside(s, 'path', 'sieve_script_path');
    if (type === 'before' && path) {
      const p = expand(path);
      const n = game.find(p);
      if (n?.type === 'directory')
        before.push(
          ...Object.keys(n.children)
            .filter((k) => k.endsWith('.sieve'))
            .sort()
            .map((k) => `${p}/${k}`),
        );
      else if (n) before.push(p);
    }
    if (type === 'personal' && !personalSeen && path) {
      personalSeen = true;
      const active = inside(s, 'active_path', 'sieve_script_active_path');
      storage = { path: expand(path), active: active ? expand(active) : `${u.home}/.dovecot.sieve` };
    }
  }
  if (!enabled) return { before: [], personal: null, storage };
  const link = game.find(storage.active, false);
  let personal: string | null = null;
  if (link?.type === 'file') personal = link.link !== undefined ? (link.link.startsWith('/') ? link.link : `${storage.active.replace(/\/[^/]*$/, '')}/${link.link}`) : storage.active;
  if (personal && !game.find(personal)) personal = null;
  return { before, personal, storage };
}

export function runSieve(game: Game, u: MailUser, mail: Mail, env: { from: string; orig?: string; time: number }, dupes?: Record<string, number>, quiet = false): SieveRun {
  const out: SieveRun = { keep: true, stores: [], create: [], rejected: false, log: [], messages: [] };
  const scripts = sieveScripts(game, u);
  const list = [...scripts.before, ...(scripts.personal ? [scripts.personal] : [])];
  const st = dovecot(game)!;
  for (const path of list) {
    const text = game.read(path) ?? '';
    const c = compile(text, path.split('/').pop()!.replace(/\.sieve$/, ''));
    if (!c.ok) {
      if (!quiet) mailLog(game, 'dovecot', 4201, `lmtp(${u.user})${session(game)}: Error: sieve: failed to compile script ${path}`);
      out.log.push('compile-error');
      break;
    }
    out.script = path;
    const r: SieveResult = execute(c.program!, mail, { from: env.from, to: u.user, orig: env.orig, user: u.user, now: env.time, dupes: dupes ?? (st.dupes[u.user] ??= {}) });
    for (const a of r.actions) {
      if (a.type === 'fileinto') {
        out.stores.push(a.mailbox);
        if (a.create) out.create.push(a.mailbox);
        out.log.push(`fileinto:${a.mailbox}`);
      } else if (a.type === 'vacation') {
        if (a.sent) {
          if (!quiet) st.replies.push({ to: a.to, from: u.user, subject: a.subject, time: env.time, kind: 'vacation' });
          out.log.push(`vacation:${a.to}`);
          out.messages.push(`sent vacation response to <${a.to}>`);
        } else {
          out.log.push(`vacation-skip:${a.reason}`);
          out.messages.push(a.why);
        }
      } else if (a.type === 'reject') {
        out.rejected = true;
        out.log.push('reject');
        if (!quiet) st.replies.push({ to: env.from, from: u.user, subject: 'Rejected', time: env.time, kind: 'reject' });
        out.messages.push(`rejected message from <${env.from}> (reject)`);
      } else if (a.type === 'redirect') {
        out.log.push(`redirect:${a.to}`);
        out.messages.push(`forwarded to <${a.to}>`);
      } else if (a.type === 'discard') {
        out.log.push('discard');
        out.messages.push('marked message to be discarded if not explicitly delivered (discard action)');
      }
    }
    out.keep = r.keep;
    if (!r.keep) break;
  }
  if (out.rejected) out.keep = false;
  if (out.keep && out.stores.length) out.stores.push('INBOX');
  out.stores = [...new Set(out.stores)];
  return out;
}

export type { Shell };
