// The command-line tools of an inbound mail server, loaded with the story
// that has one ("The Lifeboat"): doveadm (quota, expunge, search, fetch,
// mailbox, user, sieve, log, reload), doveconf, Pigeonhole's sievec and
// sieve-test, rspamc (symbols, stat, learn_spam, learn_ham) and rspamadm
// (configtest, configdump). The models are dovecot.ts, sieve.ts, rspamd.ts.
// After https://doc.dovecot.org/2.4.1/core/man/doveadm.1.html and its
// pages (doveadm-quota, doveadm-expunge, doveadm-search-query,
// doveadm-mailbox, doveadm-user, doveadm-sieve, doveadm-log), doveconf.1,
// sievec.1, sieve-test.1, and https://docs.rspamd.com/developers/protocol/
// for rspamc's answers.
// Differences: doveadm's formatters are only table, tab and pager; sievec -d
// prints the commands and their lines, not Pigeonhole's byte code;
// sieve-test -e is accepted but stores nothing; rspamc only talks to the
// local rspamd.

import type { Shell } from './shell';
import type { Context } from './commands/index';
import { systemd } from './systemd';
import {
  actualUsage, allMessages, conf, confPath, confText, createMailbox, dovecot, header, lookup, mailboxDir, mailboxes, matchUsers, messagesOf, parseMail, putFile, quotaRoot,
  readConf, recalc, reloadDovecot, removeMessage, running, sieveScripts, usage, users, confErrorText, USERS, VMAIL,
  type MailUser, type Stored, type ConfNode, type Mail,
} from './dovecot';
import { compile, execute, printResult } from './sieve';
import { learn, readConfig, rspamd, rspamdRunning, scan, VERSION as RSPAMD_VERSION, type Scan } from './rspamd';

// ——— doveadm ———

const DOVEADM_USAGE = `usage: doveadm [-Dv] [-f <formatter>] <command> [<args>]

  expunge     [-u <user>|-A] [-S <socket_path>] [-d] <search query>
  fetch       [-u <user>|-A] [-S <socket_path>] <fields> <search query>
  log         errors|find|reopen|test
  mailbox     create|delete|list|rename|status|subscribe|unsubscribe
  quota       get|recalc
  reload
  search      [-u <user>|-A] [-S <socket_path>] <search query>
  sieve       put|get|delete|list|rename|activate|deactivate
  user        [-a <userdb socket path>] [-x <auth info>] [-f field] <user mask> [...]`;

interface Opts {
  users: string[] | null;
  all: boolean;
  flags: Set<string>;
  formatter?: string;
  rest: string[];
  error?: string;
}

function options(args: string[], valued: string[]): Opts {
  const o: Opts = { users: null, all: false, flags: new Set(), rest: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-u') o.users = [...(o.users ?? []), args[++i] ?? ''];
    else if (a === '-A') o.all = true;
    else if (a === '-f' && valued.includes('f')) o.formatter = args[++i];
    else if (/^-[A-Za-z]$/.test(a) && valued.includes(a[1])) {
      o.flags.add(a[1] + '=' + (args[++i] ?? ''));
    } else if (/^-[A-Za-z]+$/.test(a) && !o.rest.length) for (const c of a.slice(1)) o.flags.add(c);
    else o.rest.push(a);
  }
  return o;
}

const needRoot = (game: Shell, program: string) => {
  if (game.who === 'root') return false;
  game.error(`${program}: Fatal: Error reading configuration: stat(/etc/dovecot/conf.d/10-auth.conf) failed: Permission denied (euid=${game.accounts.users[game.who]?.uid ?? 1000}(${game.who}) egid=${game.accounts.users[game.who]?.uid ?? 1000}(${game.who}) missing +r perm: ${USERS}, dir owned by 0:0 mode=0755)`, 75);
  return true;
};

function targets(game: Shell, o: Opts, cmd: string): MailUser[] | null {
  if (o.all) return users(game);
  if (!o.users) {
    game.error(`doveadm ${cmd}: Error: USER environment is missing and -u option not used`, 64);
    return null;
  }
  const found = o.users.flatMap((u) => matchUsers(game, u));
  if (!found.length) {
    game.error(`doveadm(${o.users[0]}): Error: User doesn't exist`, 67);
    return null;
  }
  return found;
}

const table = (rows: string[][], right: number[] = []) => {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => r.map((v, c) => (right.includes(c) ? v.padStart(widths[c]) : v.padEnd(widths[c]))).join(' ').trimEnd()).join('\n');
};

function quota(game: Shell, args: string[]): string {
  const [sub, ...rest] = args;
  const o = options(rest, ['f']);
  if (sub !== 'get' && sub !== 'recalc') return game.error('doveadm quota: Usage: doveadm quota get|recalc [-u <user>|-A]', 64);
  const list = targets(game, o, `quota ${sub}`);
  if (!list) return '';
  const rows: string[][] = [[...(list.length > 1 || o.all ? ['Username'] : []), 'Quota name', 'Type', 'Value', 'Limit', '%']];
  for (const u of list) {
    const root = quotaRoot(game, u);
    if (!root) return game.error(`doveadm(${u.user}): Error: quota plugin not loaded`, 75);
    if (sub === 'recalc') {
      recalc(game, u, root);
      continue;
    }
    const used = usage(game, u, root);
    const limit = root.limit ? String(Math.floor(root.limit / 1024)) : '-';
    const pct = root.limit ? String(Math.floor((used.bytes * 100) / root.limit)) : '0';
    const who = list.length > 1 || o.all ? [u.user] : [];
    rows.push([...who, root.name, 'STORAGE', String(Math.floor(used.bytes / 1024)), limit, pct], [...who, root.name, 'MESSAGE', String(used.count), '-', '0']);
  }
  if (sub === 'recalc') return '';
  if (o.formatter === 'tab') return rows.map((r) => r.join('\t')).join('\n');
  const n = rows[0].length;
  return table(rows, [n - 3, n - 2, n - 1]);
}

// ——— Search queries (doveadm-search-query(7)) ———

type Query = (m: Stored, u: MailUser) => boolean;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const UNITS: Record<string, number> = { w: 604_800_000, week: 604_800_000, weeks: 604_800_000, d: 86_400_000, day: 86_400_000, days: 86_400_000, h: 3_600_000, hour: 3_600_000, hours: 3_600_000, m: 60_000, min: 60_000, mins: 60_000, s: 1000, sec: 1000, secs: 1000 };

/** A date specification: YYYY-MM-DD, dd-mon-yyyy, an interval (2w, 30days) back from now, a Unix timestamp. */
function dateSpec(text: string, now: number): number | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})-([a-z]{3})-(\d{4})$/i.exec(text);
  if (m && MONTHS.includes(m[2].toLowerCase())) return Date.UTC(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]));
  m = /^(\d+)\s*([a-z]+)$/i.exec(text);
  if (m && UNITS[m[2].toLowerCase()]) return now - Number(m[1]) * UNITS[m[2].toLowerCase()];
  if (/^\d{10}$/.test(text)) return Number(text) * 1000;
  return null;
}
// A size as Dovecot 2.4.1's str_parse_get_size reads it (src/lib/str-parse.c): digits, spaces,
// then B, K, M, G or T, the last four optionally followed by i and B ("10k", "2 MiB").
const sizeSpec = (text: string): number | null => {
  const m = /^(\d+) *(?:(b)|([kmgt])i?b?)?$/i.exec(text);
  if (!m) return null;
  return Number(m[1]) * ({ k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 } as Record<string, number>)[(m[3] ?? '').toLowerCase()] || Number(m[1]);
};

function parseQuery(words: string[], now: number): { query: Query; mailbox: string[] } | { error: string } {
  const mailbox: string[] = [];
  let i = 0;
  const day = 86_400_000;
  const text = (m: Stored) => (typeof m.file.content === 'string' ? m.file.content : '');
  const head = (m: Stored, name: string) => header(parseMail(text(m)), name).join(' ').toLowerCase();
  const one = (): Query | { error: string } => {
    const w = words[i++];
    if (w === undefined) return { error: 'Missing argument' };
    const k = w.toLowerCase();
    const arg = () => words[i++];
    if (k === '(') {
      const inner = seq(')');
      if ('error' in inner) return inner;
      i++;
      return inner.query;
    }
    if (k === 'all') return () => true;
    if (k === 'not') {
      const q = one();
      return 'error' in q ? q : (m: Stored, u: MailUser) => !q(m, u);
    }
    if (k === 'mailbox') {
      const name = arg();
      if (name === undefined) return { error: 'Missing argument' };
      mailbox.push(name);
      const re = new RegExp('^' + name.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '[^/]*') + '$', 'i');
      return (m) => re.test(m.mailbox);
    }
    const dates: Record<string, [keyof Stored, 'before' | 'since' | 'on']> = {
      before: ['received', 'before'], since: ['received', 'since'], on: ['received', 'on'],
      savedbefore: ['saved', 'before'], savedsince: ['saved', 'since'], savedon: ['saved', 'on'],
      sentbefore: ['received', 'before'], sentsince: ['received', 'since'], senton: ['received', 'on'],
    };
    if (dates[k]) {
      const raw = arg();
      const at = raw === undefined ? null : dateSpec(raw, now);
      if (at === null) return { error: raw === undefined ? 'Missing argument' : `Invalid search date parameter: ${raw}` };
      const [field, how] = dates[k];
      return (m) => {
        const v = m[field] as number;
        return how === 'before' ? v < at : how === 'since' ? v >= at : v >= at && v < at + day;
      };
    }
    if (k === 'larger' || k === 'smaller') {
      const raw = arg();
      if (raw === undefined) return { error: 'Missing argument' };
      // mail-search-register-human.c (arg_new_human_size) passes on str_parse_get_size's error.
      const s = sizeSpec(raw);
      if (s === null) return { error: `Invalid size: ${raw}` };
      return (m) => (k === 'larger' ? m.size > s : m.size < s);
    }
    if (['from', 'to', 'cc', 'subject'].includes(k)) {
      const v = (arg() ?? '').toLowerCase();
      return (m) => head(m, k).includes(v);
    }
    if (k === 'body' || k === 'text') {
      const v = (arg() ?? '').toLowerCase();
      return (m) => text(m).toLowerCase().includes(v);
    }
    if (k === 'header') {
      const h = arg() ?? '';
      const v = (arg() ?? '').toLowerCase();
      return (m) => head(m, h).includes(v);
    }
    if (k === 'seen' || k === 'unseen') return (m) => /:2,[A-Z]*S/.test(m.name) === (k === 'seen');
    if (k === 'deleted') return (m) => /:2,[A-Z]*T/.test(m.name);
    if (k === 'new' || k === 'recent') return (m) => m.path.includes('/new/');
    if (k === 'old') return (m) => m.path.includes('/cur/');
    return { error: `Unknown argument ${w}` };
  };
  const seq = (end?: string): { query: Query } | { error: string } => {
    const all: Query[] = [];
    while (i < words.length && words[i] !== end) {
      const q = one();
      if ('error' in q) return q;
      if ((words[i] ?? '').toLowerCase() === 'or') {
        i++;
        const r = one();
        if ('error' in r) return r;
        all.push((m, u) => q(m, u) || r(m, u));
      } else all.push(q);
    }
    return { query: (m, u) => all.every((q) => q(m, u)) };
  };
  if (!words.length) return { error: 'Missing argument' };
  const r = seq();
  return 'error' in r ? r : { query: r.query, mailbox };
}

function matching(game: Shell, u: MailUser, words: string[], cmd: string): Stored[] | null {
  const now = systemd(game)?.clock ?? 0;
  const q = parseQuery(words, now);
  if ('error' in q) {
    // doveadm-mail.c: i_fatal("%s", error), the search parser's message (mail-search-build.c).
    void cmd;
    game.error(`doveadm(${u.user}): Fatal: ${q.error}`, 89);
    return null;
  }
  return allMessages(game, u).filter((m) => q.query(m, u));
}

const guid = (u: MailUser, mailbox: string) => {
  let h = 0x811c9dc5;
  const s = `${u.user}/${mailbox}`;
  let out = '';
  for (let i = 0; out.length < 32; i++) {
    h = Math.imul(h ^ s.charCodeAt(i % s.length) ^ i, 0x01000193) >>> 0;
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 32);
};
const uidOf = (game: Shell, u: MailUser, m: Stored) => messagesOf(game, u, m.mailbox).findIndex((x) => x.path === m.path) + 1;

function expunge(game: Shell, args: string[]): string {
  const o = options(args, []);
  const list = targets(game, o, 'expunge');
  if (!list) return '';
  for (const u of list) {
    const found = matching(game, u, o.rest, 'expunge');
    if (!found) return '';
    if (!o.rest.some((w) => w.toLowerCase() === 'mailbox') && !o.rest.some((w) => /^all$/i.test(w))) void 0;
    for (const m of found) removeMessage(game, u, m);
    if (o.flags.has('d')) for (const box of new Set(found.map((m) => m.mailbox))) if (box !== 'INBOX' && !messagesOf(game, u, box).length) game.erase(mailboxDir(u, box));
  }
  return '';
}

function search(game: Shell, args: string[]): string {
  const o = options(args, []);
  const list = targets(game, o, 'search');
  if (!list) return '';
  const out: string[] = [];
  for (const u of list) {
    const found = matching(game, u, o.rest, 'search');
    if (!found) return '';
    for (const m of found) out.push(`${o.all || list.length > 1 ? `${u.user} ` : ''}${guid(u, m.mailbox)} ${uidOf(game, u, m)}`);
  }
  return out.join('\n');
}

const dateText = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

function fetch(game: Shell, args: string[]): string {
  const o = options(args, ['f']);
  const list = targets(game, o, 'fetch');
  if (!list) return '';
  const [fields, ...query] = o.rest;
  if (!fields) return game.error('doveadm fetch: Usage: doveadm fetch [-u <user>|-A] <fields> <search query>', 64);
  const names = fields.split(/\s+/).filter(Boolean);
  const known = ['mailbox', 'uid', 'guid', 'size.physical', 'size.virtual', 'date.received', 'date.saved', 'date.sent', 'hdr', 'body', 'text', 'flags', 'user'];
  const bad = names.find((n) => !known.includes(n) && !/^hdr\.[\w-]+$/i.test(n));
  if (bad) return game.error(`doveadm fetch: Fatal: Unknown fetch field: ${bad}`, 64);
  const records: string[] = [];
  for (const u of list) {
    const found = matching(game, u, query, 'fetch');
    if (!found) return '';
    for (const m of found) {
      const text = typeof m.file.content === 'string' ? m.file.content : '';
      const mail = parseMail(text);
      const value = (n: string): string => {
        if (n === 'mailbox') return m.mailbox;
        if (n === 'uid') return String(uidOf(game, u, m));
        if (n === 'guid') return guid(u, m.mailbox + m.name).slice(0, 32);
        if (n === 'user') return u.user;
        if (n === 'size.physical' || n === 'size.virtual') return String(m.size);
        if (n === 'date.received') return dateText(m.received);
        if (n === 'date.saved') return dateText(m.saved);
        if (n === 'date.sent') return header(mail, 'Date')[0] ?? '';
        if (n === 'flags') return /:2,[A-Z]*S/.test(m.name) ? '\\Seen' : '';
        if (n === 'hdr') return mail.headers.map(([k, v]) => `${k}: ${v}`).join('\n');
        if (n === 'body') return mail.body;
        if (n === 'text') return text;
        return header(mail, n.slice(4))[0] ?? '';
      };
      if (o.formatter === 'tab' || o.formatter === 'table') records.push(names.map(value).join('\t'));
      else records.push(names.map((n) => `${n}: ${value(n)}`).join('\n'));
    }
  }
  if (o.formatter === 'tab' || o.formatter === 'table') return [names.join('\t'), ...records].join('\n');
  return records.join('\n\f\n');
}

function mailbox(game: Shell, args: string[]): string {
  const [sub, ...rest] = args;
  const o = options(rest, ['f']);
  const usageText = 'doveadm mailbox: Usage: doveadm mailbox create|delete|list|rename|status [-u <user>] [<mailbox> ...]';
  if (!['list', 'create', 'delete', 'status', 'rename'].includes(sub ?? '')) return game.error(usageText, 64);
  const list = targets(game, o, `mailbox ${sub}`);
  if (!list) return '';
  const out: string[] = [];
  for (const u of list) {
    const boxes = mailboxes(game, u);
    if (sub === 'list') {
      const pattern = o.rest[0];
      const re = pattern ? new RegExp('^' + pattern.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '[^/]*') + '$', 'i') : null;
      out.push(...boxes.filter((b) => !re || re.test(b)));
    } else if (sub === 'create') {
      for (const name of o.rest) {
        if (boxes.some((b) => b.toLowerCase() === name.toLowerCase())) return game.error(`doveadm(${u.user}): Error: Can't create mailbox ${name}: Mailbox already exists`, 65);
        createMailbox(game, u, name);
      }
    } else if (sub === 'delete') {
      for (const name of o.rest) {
        if (!boxes.includes(name)) return game.error(`doveadm(${u.user}): Error: Can't delete mailbox ${name}: Mailbox doesn't exist: ${name}`, 68);
        if (name === 'INBOX') return game.error(`doveadm(${u.user}): Error: Can't delete mailbox INBOX: INBOX can't be deleted.`, 65);
        if (messagesOf(game, u, name).length && !o.flags.has('r') && !o.flags.has('s')) return game.error(`doveadm(${u.user}): Error: Can't delete mailbox ${name}: Mailbox isn't empty`, 65);
        for (const m of messagesOf(game, u, name)) removeMessage(game, u, m);
        game.erase(mailboxDir(u, name));
      }
    } else if (sub === 'rename') {
      const [from, to] = o.rest;
      if (!from || !to) return game.error(usageText, 64);
      if (!boxes.includes(from)) return game.error(`doveadm(${u.user}): Error: Can't rename mailbox ${from} to ${to}: Mailbox doesn't exist: ${from}`, 68);
      const n = game.find(mailboxDir(u, from));
      const parent = game.find(mailboxDir(u, 'INBOX'));
      if (n && parent?.type === 'directory') {
        parent.children[`.${to}`] = n;
        delete parent.children[`.${from}`];
      }
    } else {
      const [fields, ...names] = o.rest;
      if (!fields || !names.length) return game.error('doveadm mailbox status: Usage: doveadm mailbox status [-u <user>] [-t] <fields> <mailbox> [...]', 64);
      const want = fields === 'all' ? ['messages', 'recent', 'uidnext', 'uidvalidity', 'unseen', 'highestmodseq', 'vsize', 'guid'] : fields.split(/\s+/);
      for (const name of names) {
        const re = new RegExp('^' + name.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
        const hits = boxes.filter((b) => re.test(b));
        if (!hits.length) return game.error(`doveadm(${u.user}): Error: Mailbox ${name}: Failed to lookup mailbox status: Mailbox doesn't exist: ${name}`, 68);
        for (const b of hits) {
          const ms = messagesOf(game, u, b);
          const v: Record<string, string> = {
            messages: String(ms.length), recent: String(ms.filter((m) => m.path.includes('/new/')).length), uidnext: String(ms.length + 1), uidvalidity: '1757900000',
            unseen: String(ms.filter((m) => !/:2,[A-Z]*S/.test(m.name)).length), highestmodseq: String(ms.length + 3), vsize: String(ms.reduce((t, m) => t + m.size, 0)), guid: guid(u, b),
          };
          const bad = want.find((w) => !(w in v));
          if (bad) return game.error(`doveadm mailbox status: Fatal: Unknown status field: ${bad}`, 64);
          out.push(`${names.length > 1 || hits.length > 1 ? `${b} ` : ''}${want.map((w) => `${w}=${v[w]}`).join(' ')}`);
        }
      }
    }
  }
  return out.join('\n');
}

function user(game: Shell, args: string[]): string {
  const o = options(args, ['f', 'a', 'x']);
  if (!o.rest.length) return game.error('doveadm user: Usage: doveadm user [-a <userdb socket path>] [-x <auth info>] [-f field] [-e <value>] <user mask> [...]', 64);
  const out: string[] = [];
  for (const mask of o.rest) {
    if (/[*?]/.test(mask)) {
      out.push(...matchUsers(game, mask).map((u) => u.user));
      continue;
    }
    const u = lookup(game, mask);
    if (!u) {
      out.push(`userdb lookup: user ${mask} doesn't exist`);
      game.status = 2;
      continue;
    }
    const fields: [string, string][] = [['uid', String(u.uid)], ['gid', String(u.gid)], ['home', u.home], ...Object.entries(u.fields)];
    if (o.formatter) {
      const f = fields.find(([k]) => k === o.formatter);
      out.push(f ? f[1] : '');
      continue;
    }
    const width = Math.max(...fields.map(([k]) => k.length));
    out.push(`userdb: ${u.user}`, ...fields.map(([k, v]) => `  ${k.padEnd(width)}: ${v}`));
  }
  return out.join('\n');
}

// doveadm sieve: the personal storage's scripts (files NAME.sieve in ~/sieve, ~/.dovecot.sieve the active link).
function sieve(game: Shell, args: string[], input: string | null): string {
  const [sub, ...rest] = args;
  const o = options(rest, []);
  const subs = ['list', 'put', 'get', 'activate', 'deactivate', 'delete', 'rename'];
  if (!subs.includes(sub ?? '')) return game.error('doveadm sieve: Usage: doveadm sieve put|get|delete|list|rename|activate|deactivate [-u <user>|-A] ...', 64);
  const list = targets(game, o, `sieve ${sub}`);
  if (!list) return '';
  const out: string[] = [];
  for (const u of list) {
    const st = sieveScripts(game, u);
    const dir = st.storage.path;
    const n = game.find(dir);
    const names = n?.type === 'directory' ? Object.keys(n.children).filter((k) => k.endsWith('.sieve')).map((k) => k.slice(0, -6)).sort() : [];
    const activeName = st.personal && st.personal.startsWith(dir + '/') ? st.personal.slice(dir.length + 1).replace(/\.sieve$/, '') : null;
    const name = o.rest[0];
    const link = (to: string | null) => {
      const parent = game.find(st.storage.active.replace(/\/[^/]*$/, ''));
      if (parent?.type !== 'directory') return;
      const base = st.storage.active.split('/').pop()!;
      if (to === null) delete parent.children[base];
      else parent.children[base] = { type: 'file', content: '', link: `${dir.startsWith(u.home + '/') ? dir.slice(u.home.length + 1) : dir}/${to}.sieve`, owner: VMAIL.user, group: VMAIL.user, mode: 'rwxrwxrwx' };
    };
    if (sub === 'list') out.push(...names.map((x) => `${x}${x === activeName ? ' ACTIVE' : ''}`));
    else if (!name) return game.error(`doveadm sieve ${sub}: Usage: doveadm sieve ${sub} [-u <user>] <scriptname>`, 64);
    else if (sub === 'put') {
      const c = compile(input ?? '', name);
      if (!c.ok) {
        for (const e of c.errors) game.error(`doveadm(${u.user}): Error: ${e.replace(/^[^:]+: /, '')}`, 0);
        return game.error(`doveadm(${u.user}): Error: sieve put: Compilation failed: ${c.errors[0].replace(/^[^:]+: /, '')}`, 65);
      }
      putFile(game, `${dir}/${name}.sieve`, input ?? '', { owner: VMAIL.user, group: VMAIL.user, mode: 'rw-------' });
      if (o.flags.has('a')) link(name);
    } else if (!names.includes(name) && sub !== 'deactivate') return game.error(`doveadm(${u.user}): Error: Sieve script does not exist`, 68);
    else if (sub === 'get') out.push(game.read(`${dir}/${name}.sieve`) ?? '');
    else if (sub === 'activate') {
      const c = compile(game.read(`${dir}/${name}.sieve`) ?? '', name);
      if (!c.ok) return game.error(`doveadm(${u.user}): Error: Failed to activate Sieve script: ${c.errors[0].replace(/^[^:]+: /, '')}`, 65);
      link(name);
    } else if (sub === 'deactivate') link(null);
    else if (sub === 'delete') {
      if (name === activeName && !o.flags.has('a')) return game.error(`doveadm(${u.user}): Error: Failed to delete Sieve script: Cannot delete the active Sieve script.`, 65);
      if (name === activeName) link(null);
      game.erase(`${dir}/${name}.sieve`);
    } else if (sub === 'rename') {
      const to = o.rest[1];
      const f = game.find(`${dir}/${name}.sieve`);
      const parent = game.find(dir);
      if (!to || !f || parent?.type !== 'directory') return game.error('doveadm sieve rename: Usage: doveadm sieve rename [-u <user>] <old name> <new name>', 64);
      parent.children[`${to}.sieve`] = f;
      delete parent.children[`${name}.sieve`];
      if (name === activeName) link(to);
    }
  }
  return out.join('\n');
}

function log(game: Shell, args: string[]): string {
  const sub = args[0];
  if (sub === 'errors') {
    const lines = (game.read('/var/log/mail.log') ?? '').split('\n').filter((l) => / dovecot\[\d+\]: /.test(l) && /Error|Fatal|save failed|failed to/.test(l));
    return lines
      .slice(-20)
      .map((l) => {
        const m = /^(\S+) \S+ dovecot\[\d+\]: (.*)$/.exec(l);
        if (!m) return l;
        const d = new Date(m[1].slice(0, 19) + 'Z');
        const level = /Fatal/.test(m[2]) ? 'Fatal' : 'Error';
        return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${m[1].slice(11, 19)} ${level}: ${m[2].replace(/^Error: /, '')}`;
      })
      .join('\n');
  }
  if (sub === 'find') return 'Looking for log files from /var/log\nDebug: /var/log/mail.log\nInfo: /var/log/mail.log\nWarning: /var/log/mail.log\nError: /var/log/mail.log\nFatal: /var/log/mail.log';
  if (sub === 'reopen' || sub === 'test') return '';
  return game.error('doveadm log: Usage: doveadm log errors|find|reopen|test', 64);
}

export function doveadm(c: Context): string {
  const game = c.game;
  let args = [...c.args];
  // Global options before the command.
  while (/^-[DvkO]+$/.test(args[0] ?? '') || ['-o', '-c', '-i'].includes(args[0] ?? '')) args = ['-o', '-c', '-i'].includes(args[0]) ? args.slice(2) : args.slice(1);
  let formatter: string | undefined;
  if (args[0] === '-f') {
    formatter = args[1];
    args = args.slice(2);
  }
  const [cmd, ...rest] = args;
  if (!cmd || cmd === 'help') return cmd ? DOVEADM_USAGE : game.error(DOVEADM_USAGE, 64);
  if (needRoot(game, 'doveadm')) return '';
  const r = readConf(game);
  if (r.error) return game.error(confErrorText(r.error).replace(/^doveconf/, 'doveadm'), 89);
  const withF = formatter ? ['-f', formatter, ...rest] : rest;
  switch (cmd) {
    case 'quota':
      return quota(game, formatter ? [rest[0], '-f', formatter, ...rest.slice(1)] : rest);
    case 'expunge':
      return expunge(game, rest);
    case 'search':
      return search(game, rest);
    case 'fetch':
      return fetch(game, withF);
    case 'mailbox':
      return mailbox(game, rest);
    case 'user':
      return user(game, rest);
    case 'sieve':
      return sieve(game, rest, c.input);
    case 'log':
      return log(game, rest);
    case 'reload': {
      if (!running(game)) return game.error('doveadm: Fatal: Dovecot is not running (read from /run/dovecot/master.pid)', 75);
      const e = reloadDovecot(game);
      return e ? game.error(confErrorText(e), 89) : '';
    }
  }
  return game.error(`doveadm: Unknown command '${cmd}'\n${DOVEADM_USAGE}`, 64);
}

// ——— doveconf ———

const nodeText = (nodes: ConfNode[], indent = ''): string[] =>
  nodes.flatMap((n) => (n.kind === 'setting' ? [`${indent}${n.key} = ${n.value}`] : [`${indent}${n.key}${n.name ? ` ${/\s/.test(n.name) ? `"${n.name}"` : n.name}` : ''} {`, ...nodeText(n.children ?? [], indent + '  '), `${indent}}`]));

export function doveconf(c: Context): string {
  const game = c.game;
  const flags = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (a === '-c' || a === '-f' || a === '-m' || a === '-i') i++;
    else if (/^-[a-zA-Z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (!'acdfhimnNPsSUx'.includes(ch)) return game.error(`doveconf: invalid option -- '${ch}'\ndoveconf: Fatal: Usage: doveconf [-adnPNUx] [-c <config file>] [-f <filter>] [setting...] [section_name...]`, 64);
        flags.add(ch);
      }
    } else names.push(a);
  }
  const r = readConf(game);
  if (r.error) return game.error(confErrorText(r.error), 89);
  if (!names.length) return confText(r.tree, systemd(game)?.host ?? 'localhost');
  const out: string[] = [];
  for (const name of names) {
    const found = confPath(r.tree, name);
    if (!found.length) {
      const k = name.split('/').pop()!;
      const def = DEFAULTS[k];
      if (def === undefined) return game.error(`doveconf: Fatal: Unknown setting: ${name}`, 89);
      out.push(flags.has('h') ? def : `${k} = ${def}`);
      continue;
    }
    const last = found[found.length - 1];
    if (last.kind === 'setting') out.push(flags.has('h') ? (last.value ?? '') : `${last.key} = ${last.value}`);
    else out.push(...(flags.has('h') ? nodeText(last.children ?? []) : nodeText(found)));
  }
  return out.join('\n');
}
// A few defaults doveconf can show (doveconf -d).
const DEFAULTS: Record<string, string> = {
  quota_driver: 'count', quota_storage_size: 'unlimited', quota_storage_grace: '10M', quota_exceeded_message: 'Quota exceeded (mailbox for user is full)', quota_full_tempfail: 'no',
  mail_driver: '', mail_path: '', protocols: 'imap pop3 lmtp', sieve_vacation_default_period: '7d', sieve_vacation_min_period: '1d', sieve_vacation_max_period: '60d', postmaster_address: 'postmaster@%{user | domain | default(hostname)}',
};

// ——— sievec and sieve-test ———

function sievec(c: Context): string {
  const game = c.game;
  const flags = new Set<string>();
  const files: string[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (['-c', '-o', '-u', '-x'].includes(a)) i++;
    else if (/^-[dD]+$/.test(a)) for (const ch of a.slice(1)) flags.add(ch);
    else if (a.startsWith('-')) return game.error(`sievec: Unknown option -- '${a.slice(1, 2)}'\nUsage: sievec [-c <config-file>] [-d] [-D] [-o <setting>=<value>] [-u <user>] [-x <extensions>] <script-file> [<out-file>]`, 64);
    else files.push(a);
  }
  if (!files.length) return game.error('Usage: sievec [-c <config-file>] [-d] [-D] [-o <setting>=<value>] [-u <user>] [-x <extensions>] <script-file> [<out-file>]', 64);
  const target = files[0];
  const n = game.find(target);
  if (!n) return game.error(`sievec(${game.who}): Fatal: failed to compile sieve script '${target}': no such file`, 68);
  const list = n.type === 'directory' ? Object.keys(n.children).filter((k) => k.endsWith('.sieve')).map((k) => `${game.resolve(target)}/${k}`) : [game.resolve(target)];
  const out: string[] = [];
  let failed = false;
  for (const path of list) {
    const node = game.find(path)!;
    if (!game.can(node, 'r')) {
      game.error(`sievec(${game.who}): Error: failed to open sieve script '${path}': Permission denied`, 77);
      failed = true;
      continue;
    }
    const name = path.split('/').pop()!.replace(/\.sieve$/, '');
    const compiled = compile(game.read(path) ?? '', name);
    if (!compiled.ok) {
      for (const e of compiled.errors) game.error(e, 1);
      failed = true;
      continue;
    }
    if (flags.has('d')) {
      const dump = (cmds: { name: string; line: number; block?: unknown[] }[], depth: number): string[] =>
        cmds.flatMap((x) => [`${String(x.line).padStart(4, '0')}: ${'  '.repeat(depth)}${x.name.toUpperCase()}`, ...(x.block ? dump(x.block as never, depth + 1) : [])]);
      out.push(`Address   Line  Code`, ...dump(compiled.program!.commands, 0));
      continue;
    }
    const bin = files[1] && n.type !== 'directory' ? game.resolve(files[1]) : path.replace(/\.sieve$/, '') + '.svbin';
    const err = game.place('sievec', bin, { type: 'file', content: `# Pigeonhole Sieve binary (compiled from ${path.split('/').pop()})`, owner: game.who, group: game.who, mode: 'rw-------', size: 412, charset: 'binary' });
    if (err) {
      game.error(`sievec(${game.who}): Error: binary ${bin}: save: failed to create temporary file: open(${bin}.tmp) failed: Permission denied`, 73);
      failed = true;
    }
  }
  if (failed && !game.status) game.status = 1;
  return out.join('\n');
}

function sieveTest(c: Context): string {
  const game = c.game;
  const usageText = 'Usage: sieve-test [-a <orig-recipient-address] [-C] [-D] [-d <dump-filename>] [-e]\n                  [-f <envelope-sender>] [-m <default-mailbox>]\n                  [-r <recipient-address>] [-s <script-file>]\n                  [-t <trace-file>] [-T <trace-option>] [-x <extensions>]\n                  <script-file> <mail-file>';
  const opts: Record<string, string> = {};
  const extra: string[] = [];
  const files: string[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (['-a', '-r', '-f', '-m', '-d', '-t', '-T', '-x', '-c', '-o', '-u'].includes(a)) opts[a.slice(1)] = c.args[++i] ?? '';
    else if (a === '-s') extra.push(c.args[++i] ?? '');
    else if (/^-[CDe]+$/.test(a)) void 0;
    else if (a.startsWith('-')) return game.error(`sieve-test: Unknown option -- '${a.slice(1, 2)}'\n${usageText}`, 64);
    else files.push(a);
  }
  if (files.length < 2) return game.error(usageText, 64);
  const [script, mailFile] = files;
  const mailText = game.readFor('sieve-test', mailFile);
  if (mailText === null) {
    game.status = 1;
    return '';
  }
  const scripts = [...extra, script];
  const m = parseMail(mailText);
  const addrOf = (v: string | undefined) => (v ? (/<([^>]*)>/.exec(v)?.[1] ?? v.trim()) : undefined);
  const from = opts.f ?? addrOf(header(m, 'Return-Path')[0]) ?? addrOf(header(m, 'Sender')[0]) ?? addrOf(header(m, 'From')[0]) ?? 'sender@example.com';
  const orig = opts.a ?? addrOf(header(m, 'Envelope-To')[0]) ?? addrOf(header(m, 'To')[0]) ?? 'recipient@example.com';
  const to = opts.r ?? orig;
  let keep = true;
  const actions: ReturnType<typeof execute>['actions'] = [];
  for (const s of scripts) {
    const text = game.readFor('sieve-test', s);
    if (text === null) {
      game.status = 1;
      return '';
    }
    const name = s.split('/').pop()!.replace(/\.sieve$/, '');
    const compiled = compile(text, name);
    if (!compiled.ok) {
      for (const e of compiled.errors) game.error(e, 0);
      return game.error(`sieve-test(${game.who}): Fatal: failed to compile sieve script`, 1);
    }
    const r = execute(compiled.program!, m, { from, to, orig, user: to, now: systemd(game)?.clock ?? 0, dupes: {}, dryRun: true });
    actions.push(...r.actions);
    keep = r.keep;
    if (!keep) break;
  }
  return printResult({ actions, keep }, opts.m || 'INBOX');
}

// ——— rspamc and rspamadm ———

const RSPAMC_USAGE = `Usage:
  rspamc [OPTION?] - run rspamc client

Help Options:
  -?, --help                  Show help options

Application Options:
  -h, --connect               Specify host and port
  -P, --password              Specify control password
  -i, --ip                    Emulate that message was received from specified ip address
  -F, --from                  Emulate that message has specified SMTP FROM address
  -r, --rcpt                  Emulate that message has specified SMTP RCPT address
  -d, --deliver               Emulate that message is delivered to specified user (for LDA/statistics)
  --helo                      Imitate SMTP HELO passing from MTA

Commands: symbols (default), stat, learn_spam, learn_ham`;

/** The files a list of paths names (a directory: every file under it, recursively). */
function filesUnder(game: Shell, paths: string[]): { path: string; error?: string }[] {
  const out: { path: string; error?: string }[] = [];
  const walk = (p: string) => {
    const n = game.find(p);
    if (!n) return out.push({ path: p, error: `cannot open file ${p}: No such file or directory` });
    if (!game.traverses(p) || !game.can(n, 'r')) return out.push({ path: p, error: `cannot open file ${p}: Permission denied` });
    if (n.type === 'directory') {
      for (const k of Object.keys(n.children).sort()) walk(`${p.replace(/\/$/, '')}/${k}`);
      return;
    }
    out.push({ path: p });
  };
  for (const p of paths) walk(game.resolve(p));
  return out;
}

/**
 * rspamc's output for a scanned file (src/client/rspamc.cxx of rspamd 3.12.1: the time with
 * fmt's "{:.3}", three significant digits; rspamc_metric_output, rspamc_symbol_output,
 * rspamc_symbols_output). The server sends "urls" and "emails" (compact JSON: each URL's host
 * once, the addresses of mailto links and bare addresses) only when the message has some
 * (src/libserver/protocol.c), and "undef" for a message without a Message-ID (libmime/message.c).
 */
function symbolsText(s: Scan, what: string, m: Mail): string {
  const hosts = [...new Set([...m.body.matchAll(/\bhttps?:\/\/([A-Za-z0-9.-]+)/g)].map((x) => x[1].toLowerCase()))];
  const emails = [...new Set([...m.body.matchAll(/(?:mailto:)?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)].map((x) => x[1]))];
  const json = (xs: string[]) => `[${xs.map((x) => JSON.stringify(x)).join(',')}]`;
  return [
    `Results for file: ${what} (${Number((0.08 + (s.score % 1) / 10).toPrecision(3))} seconds)`,
    '[Metric: default]',
    `Action: ${s.action}`,
    `Spam: ${s.isSpam ? 'true' : 'false'}`,
    `Score: ${s.score.toFixed(2)} / ${s.required.toFixed(2)}`,
    ...s.symbols.map((x) => `Symbol: ${x.name} (${x.score.toFixed(2)})${x.options?.length ? `[${x.options.join(', ')}]` : ''}`),
    `Message-ID: ${s.msgid.replace(/^<|>$/g, '') || 'undef'}`,
    ...(hosts.length || emails.length ? [`Urls: ${json(hosts)}`, `Emails: ${json(emails)}`] : []),
  ].join('\n');
}

function rspamc(c: Context): string {
  const game = c.game;
  const env: { ip?: string; from?: string; rcpt?: string[] } = {};
  const rest: string[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    const v = () => c.args[++i] ?? '';
    if (a === '-i' || a === '--ip') env.ip = v();
    else if (a === '-F' || a === '--from') env.from = v();
    else if (a === '-r' || a === '--rcpt') env.rcpt = [...(env.rcpt ?? []), v()];
    else if (['-h', '--connect', '-P', '--password', '-d', '--deliver', '--helo', '-t', '--timeout'].includes(a)) v();
    else if (/^--?[a-zA-Z]/.test(a)) return game.error(`option parsing failed: Unknown option ${a}`, 1);
    else rest.push(a);
  }
  const commands = ['symbols', 'check', 'stat', 'learn_spam', 'learn_ham', 'stat_reset', 'counters', 'uptime'];
  const cmd = commands.includes(rest[0] ?? '') ? rest.shift()! : 'symbols';
  if (!rspamdRunning(game)) return game.error(`${cmd === 'stat' || cmd === 'uptime' ? '' : 'Results for file: stdin (0.000 seconds)\n'}HTTP error: 0, Connection refused`, 1);
  const st = rspamd(game)!;
  if (cmd === 'uptime') return 'Rspamd uptime: 2 days, 03:12:44';
  if (cmd === 'stat' || cmd === 'stat_reset') {
    const total = st.scanned;
    const pct = (n: number) => (total ? ((n * 100) / total).toFixed(2) : '0.00');
    const act = (a: string) => st.stats[a] ?? 0;
    const spam = act('reject') + act('add header') + act('rewrite subject');
    const conf = st.loaded!;
    return [
      `Results for command: stat (0.001 seconds)`,
      `Messages scanned: ${total}`,
      ...['reject', 'soft reject', 'rewrite subject', 'add header', 'greylist', 'no action'].map((a) => `Messages with action ${a}: ${act(a)}, ${pct(act(a))}%`),
      `Messages treated as spam: ${spam}, ${pct(spam)}%`,
      `Messages treated as ham: ${total - spam}, ${pct(total - spam)}%`,
      `Messages learned: ${st.counts.spam + st.counts.ham}`,
      `Connections count: ${total + 2}`,
      `Control connections count: ${st.asked.learn.length + 3}`,
      `Statfile: BAYES_SPAM type: redis; length: 0; free blocks: 0; total blocks: 0; free: 0.00%; learned: ${st.counts.spam}; users: 1; languages: 0`,
      `Statfile: BAYES_HAM type: redis; length: 0; free blocks: 0; total blocks: 0; free: 0.00%; learned: ${st.counts.ham}; users: 1; languages: 0`,
      `Total learns: ${st.counts.spam + st.counts.ham}`,
      ...(st.counts.spam < conf.minLearns || st.counts.ham < conf.minLearns ? [] : []),
    ].join('\n');
  }
  if (cmd === 'counters') return ['Pri | Symbol | Weight | Frequency | Hits | Avg. time | Avg. time hits'].join('\n');
  const inputs = rest.length ? filesUnder(game, rest) : [{ path: 'stdin' }];
  const out: string[] = [];
  for (const f of inputs) {
    if (f.error) {
      game.error(f.error, 1);
      continue;
    }
    const text = f.path === 'stdin' ? (c.input ?? '') : (game.read(f.path) ?? '');
    const m = parseMail(text);
    if (cmd === 'learn_spam' || cmd === 'learn_ham') {
      const cls = cmd === 'learn_spam' ? 'spam' : 'ham';
      st.asked.learn.push(`${cls}:${f.path}`);
      const r = learn(st, m, cls);
      const id = (header(m, 'Message-ID')[0] ?? '').replace(/^<|>$/g, '');
      out.push(
        r === 'already'
          ? `Results for file: ${f.path} (0.004 seconds)\nHTTP error: 208, <${id}> has been already learned as ${cls}, ignore it`
          : `Results for file: ${f.path} (0.011 seconds)\nsuccess = true;\nfilename = "${f.path}";\nscan_time = 0.011;`,
      );
      continue;
    }
    st.asked.symbols++;
    out.push(symbolsText(scan(game, m, env), f.path, m));
  }
  return out.join('\n');
}

function rspamadm(c: Context): string {
  const game = c.game;
  const [cmd, ...rest] = c.args;
  const usageText = `Rspamadm ${RSPAMD_VERSION}\nUsage: rspamadm [global_options] command [command_options]\n\nAvailable commands:\n  configtest       Perform configuration file test\n  configdump       Perform configuration file dump\n  pw               Manage rspamd passwords`;
  if (!cmd) return usageText;
  if (cmd === 'configtest') {
    const r = readConfig(game);
    if (r.errors.length) {
      for (const e of r.errors) game.error(e, 0);
      return game.error('config file test failed', 1);
    }
    return 'syntax OK';
  }
  if (cmd === 'configdump') {
    const r = readConfig(game);
    if (r.errors.length) {
      for (const e of r.errors) game.error(e, 0);
      return game.error('cannot load config', 1);
    }
    const sections = rest.filter((x) => !x.startsWith('-'));
    const blocks: Record<string, string[]> = {
      actions: Object.entries(r.conf.actions).map(([k, v]) => `    ${k.replace('_', ' ') === k ? k : `"${k.replace('_', ' ')}"`} = ${v === null ? 'null' : v.toFixed(1)};`),
      multimap: r.conf.multimap.flatMap((m) => [`    ${m.symbol} {`, `        type = "${m.type}";`, ...(m.filter ? [`        filter = "${m.filter}";`] : []), ...(m.extract ? [`        extract_from = "${m.extract}";`] : []), `        score = ${m.score.toFixed(1)};`, ...(m.action ? [`        action = "${m.action}";`] : []), `    }`]),
      settings: r.conf.settings.flatMap((s) => [`    ${s.name} {`, ...(s.from.length ? [`        from = ${JSON.stringify(s.from)};`] : []), ...(s.fromMime.length ? [`        from_mime = ${JSON.stringify(s.fromMime)};`] : []), ...(s.wantSpam ? ['        want_spam = true;'] : []), `    }`]),
    };
    const which = sections.length ? sections : Object.keys(blocks);
    const out: string[] = [];
    for (const s of which) {
      if (!blocks[s]) return game.error(`cannot find section ${s}`, 1);
      out.push(`${s} {`, ...blocks[s], '}');
    }
    return out.join('\n');
  }
  return game.error(`Unknown command: ${cmd}\n${usageText}`, 1);
}

export const INBOUND_PROGRAMS: Record<string, (c: Context) => string> = {
  doveadm,
  doveconf,
  sievec,
  'sieve-test': sieveTest,
  rspamc,
  rspamadm,
};

export { actualUsage, conf, dovecot, createMailbox, VMAIL };
