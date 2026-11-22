// Story "The Choir": what its chapters share. The Riverside Community
// Choir (la Chorale des Berges in French) runs its site and its members'
// area on a small Debian server, baton (baguette in French): nginx serves
// www.riversidechoir.example, the members' app keeps its PostgreSQL
// database `choir` (members, rehearsal attendance, subscriptions, the
// newsletter), the members' uploads (a photo and its consent form) and a
// security log of the members' area. Ruben, a volunteer, set it all up in
// 2027 and moved away; Amara chairs the choir, Kenji is the treasurer. The
// board adopted a retention policy in 2029 (/srv/choir/docs), which nobody
// applied. Chapter 1 brings the logs in line with it; chapter 2 answers a
// member's access request (GDPR art. 15); chapter 3 erases a leaving
// member (art. 17) and makes retention automatic.
// No real personal data: invented names, addresses and numbers (Ofcom's
// and ARCEP's drama ranges), .example domains, RFC 5737 and RFC 3849
// addresses.
// Sources: https://eur-lex.europa.eu/eli/reg/2016/679/oj (GDPR),
// https://nginx.org/en/docs/http/ngx_http_log_module.html,
// https://man7.org/linux/man-pages/man8/logrotate.8.html,
// https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html,
// https://restic.readthedocs.io/en/stable/060_forget.html.

import { accountsFiles, d, f, name, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { machineName } from '../machines';
import { MIME, NGINX_CONF } from '../commands/apt';
import { httpRequest, loadNginx, checkNginx, accessLines, type Configuration } from '../nginx';
import { packedFile, unpack } from '../compression';
import { startJournald, maxRetention, journalFiles } from '../journal-files';
import { readConfig, PERIODS } from '../commands/logs';
import { loadUnits } from '../timers';
import { loadOverrides } from '../commands/systemd';
import { addSnapshot, applyPolicy, hex, readWithin, repoChildren, type Repo, type Snapshot } from '../commands/restic';
import { copyOf, dumpSql, type Table } from '../postgres';
import { generateKey } from '../access';

export const HOME = '/home/you';
export const PASSWORD = 'choir-loft-31';
export const ADDRESS = '192.0.2.112';
export const SITE = 'www.riversidechoir.example';
export const DOMAIN = 'riversidechoir.example';
export const DAY = 86_400_000;
export type ChapterNo = 1 | 2 | 3;

// Tuesday 4 March 2031, 9:10; Monday 17 March, 18:40; Monday 7 April, 9:30.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2031, 2, 4, 9, 10, 0), 2: Date.UTC(2031, 2, 17, 18, 40, 0), 3: Date.UTC(2031, 3, 7, 9, 30, 0) };
const BOOT = Date.UTC(2031, 1, 9, 6, 4, 0);

export const POLICY_DIR = '/srv/choir/docs';
export const REQUESTS = '/srv/choir/gdpr-requests';
export const UPLOADS = '/srv/choir/uploads';
export const AUDIT = '/var/log/choir/audit.log';
export const ACCESS = '/var/log/nginx/access.log';
export const NGINX_ROTATE = '/etc/logrotate.d/nginx';
export const REPO = '/var/backups/restic';
export const PURGE = '/usr/local/sbin/choir-purge';
export const BACKUP = '/usr/local/sbin/choir-backup';
export const DUMP = '/var/backups/choir.sql';
export const PRIYA = '27';
export const TOMAS = '41';
const MACHINE_ID = '7c41e2b9d05a4f8e9b3a6d2c1f0e8a57';

// ——— The players' helpers ———

export const typed = (j: Game) => j.last.line ?? '';
/** The last command's output (and errors) contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const sd = (j: Game) => systemd(j)!;
export const clock = (j: Game) => sd(j).clock;

// ——— The members (choir-members in the texts: id|first_name|last_name|email|phone|voice|joined_on|left_on|address) ———

export interface Member {
  id: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  voice: string;
  joined: string;
  left: string;
  address: string;
}

export const MEMBER_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'phone', 'voice', 'joined_on', 'left_on', 'address'];

/** The members as the chapter starts (Tomas leaves on 5 April 2031). */
export function members(t: Translate, n: ChapterNo): Member[] {
  return t('choir-members')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+\|/.test(l))
    .map((l) => {
      const [id, first, last, email, phone, voice, joined, left, address] = l.split('|').map((x) => x.trim());
      return { id, first, last, email, phone, voice, joined, left: id === TOMAS && n === 3 ? '2031-04-05' : left, address };
    })
    .filter((m) => m.joined <= new Date(NOW[n]).toISOString().slice(0, 10));
}
export const member = (t: Translate, id: string, n: ChapterNo = 3) => members(t, n).find((m) => m.id === id)!;

// A number from a text, always the same (FNV-1a).
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Tuesdays the choir rehearsed (from September 2028, not in July, August or the Christmas fortnight), before `until`. */
export function rehearsals(until: number): string[] {
  const out: string[] = [];
  for (let ms = Date.UTC(2028, 8, 5); ms < until; ms += 7 * DAY) {
    const d = new Date(ms);
    const m = d.getUTCMonth();
    if (m === 6 || m === 7 || (m === 11 && d.getUTCDate() > 20) || (m === 0 && d.getUTCDate() < 6)) continue;
    out.push(iso(ms));
  }
  return out;
}

const activeOn = (m: Member, date: string) => m.joined <= date && (!m.left || date <= m.left);

// The tables are computed once per language and chapter (the checks read them often).
const computed = new WeakMap<Translate, Map<ChapterNo, Record<string, Table>>>();

/** The database `choir` as a chapter starts, to read (a check's reference): never change it. */
export function referenceTables(t: Translate, n: ChapterNo): Record<string, Table> {
  let byChapter = computed.get(t);
  if (!byChapter) computed.set(t, (byChapter = new Map()));
  let tables = byChapter.get(n);
  if (!tables) byChapter.set(n, (tables = buildTables(t, n)));
  return tables;
}

/** The database `choir` at a chapter's start (a copy, for the machine's state). */
export const choirTables = (t: Translate, n: ChapterNo): Record<string, Table> => copyOf(referenceTables(t, n));

function buildTables(t: Translate, n: ChapterNo): Record<string, Table> {
  const all = members(t, n);
  const attendance: string[][] = [];
  for (const date of rehearsals(NOW[n]))
    for (const m of all) if (activeOn(m, date) && hash(`${m.id}|${date}`) % 10 < 8) attendance.push([String(attendance.length + 1), m.id, date]);
  const payments: string[][] = [];
  for (let y = 2027; y <= 2030; y++)
    for (const m of all) {
      const start = `${y}-09-01`;
      const end = `${y + 1}-06-30`;
      if (m.joined > end || (m.left && m.left < start)) continue;
      const paid = m.joined > start ? m.joined : `${y}-10-${String(1 + (hash(`${m.id}${y}`) % 20)).padStart(2, '0')}`;
      payments.push([String(payments.length + 1), m.id, `${m.first} ${m.last}`, `${y}-${y + 1}`, hash(m.id) % 5 === 0 ? '60.00' : '120.00', paid, `SUB-${y}-${m.id.padStart(3, '0')}`]);
    }
  const newsletter: string[][] = [];
  for (const m of all) if ((!m.left || m.id === TOMAS) && (hash(`news${m.id}`) % 4 !== 0 || m.id === PRIYA || m.id === TOMAS)) newsletter.push([String(newsletter.length + 1), m.email, newsletterDate(m)]);
  for (const e of t('choir-newsletter-public').split('\n').map((x) => x.trim()).filter((x) => x.includes('@'))) {
    const [email, date] = e.split('|');
    newsletter.push([String(newsletter.length + 1), email.trim(), date.trim()]);
  }
  return {
    members: { columns: MEMBER_COLUMNS, lines: all.map((m) => [m.id, m.first, m.last, m.email, m.phone, m.voice, m.joined, m.left, m.address]) },
    attendance: { columns: ['id', 'member_id', 'rehearsed_on'], lines: attendance },
    payments: { columns: ['id', 'member_id', 'payer', 'season', 'amount', 'paid_on', 'reference'], lines: payments },
    newsletter: { columns: ['id', 'email', 'subscribed_on'], lines: newsletter },
  };
}

// The day a member subscribed to the newsletter: a Saturday or Sunday after joining (never a rehearsal day).
const newsletterDate = (m: Member) => {
  const start = Date.parse(`${m.joined}T00:00:00Z`) + (3 + (hash(`sub${m.id}`) % 20)) * DAY;
  const d = new Date(start);
  return iso(start + ((6 - d.getUTCDay() + 7) % 7) * DAY);
};

export const db = (j: Game): Record<string, Table> => j.state.postgres?.bases?.choir?.tables ?? {};
export const rowsOf = (j: Game, table: string) => db(j)[table]?.lines ?? [];

// ——— Accounts ———

export const choirAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    postgres: { uid: 108, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    choir: { uid: 997, group: 'choir', home: '/srv/choir', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    'systemd-journal': { gid: 101, members: [] },
    postgres: { gid: 113, members: [] },
    choir: { gid: 997, members: [] },
    you: { gid: 1000, members: [] },
  },
});

// ——— Configuration files ———

export const SITE_CONF = `server {
    listen 80;
    listen [::]:80;
    server_name ${SITE} ${DOMAIN};

    root /var/www/choir;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /members/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

/** The truncated addresses chapter 1 sets up (what chapters 2 and 3 find in conf.d). */
export const ANONYMISE_CONF = `# Truncated client addresses in the access log (retention policy, March 2031).
map $remote_addr $remote_addr_anon {
    ~(?P<ip>\\d+\\.\\d+\\.\\d+)\\.    $ip.0;
    ~(?P<ip>[^:]+:[^:]+):       $ip::;
    default                     0.0.0.0;
}

log_format anonymised '$remote_addr_anon - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"';`;

const nginxConf = (n: ChapterNo) => (n === 1 ? NGINX_CONF : NGINX_CONF.replace('access_log /var/log/nginx/access.log;', 'access_log /var/log/nginx/access.log anonymised;'));

/** Ruben's logrotate file for nginx (chapter 1: ten years of weekly logs); after chapter 1, the policy's. */
export const nginxRotate = (n: ChapterNo) => `/var/log/nginx/*.log {
${n === 1 ? '\tweekly\n\tmissingok\n\trotate 520' : '\tdaily\n\tmissingok\n\trotate 30\n\tmaxage 30'}
\tcompress
\tdelaycompress
\tnotifempty
\tcreate 0640 www-data adm
\tsharedscripts
\tpostrotate
\t\tsystemctl reload nginx > /dev/null 2>&1
\tendscript
}`;

export const CHOIR_ROTATE = `/var/log/choir/audit.log {
\tmonthly
\trotate 12
\tcompress
\tmissingok
\tnotifempty
\tcreate 0640 choir adm
}`;

const LOGROTATE_CONF = `# see "man logrotate" for details

# global options do not affect preceding include directives

# rotate log files weekly
weekly

# keep 4 weeks worth of backlogs
rotate 4

# create new (empty) log files after rotating old ones
create

# use date as a suffix of the rotated file
#dateext

# uncomment this if you want your log files compressed
#compress

# packages drop log rotation information into this directory
include /etc/logrotate.d

# system-specific logs may also be configured here.`;

const journaldConf = (n: ChapterNo) =>
  `#  This file is part of systemd.
#
#  systemd is free software; you can redistribute it and/or modify it under the
#  terms of the GNU Lesser General Public License as published by the Free
#  Software Foundation; either version 2.1 of the License, or (at your option)
#  any later version.
#
# Entries in this file show the compile time defaults. Local configuration
# should be created by either modifying this file (or a copy of it placed in
# /etc/ if the original file is shipped in /usr/), or by creating "drop-ins" in
# the /etc/systemd/journald.conf.d/ directory. The latter is generally
# recommended. Defaults can be restored by simply deleting the main
# configuration file and all drop-ins located in /etc/.
#
# Use 'systemd-analyze cat-config systemd/journald.conf' to display the full config.
#
# See journald.conf(5) for details.

[Journal]
#Storage=auto
#Compress=yes
#Seal=yes
#SplitMode=uid
#SyncIntervalSec=5m
#RateLimitIntervalSec=30s
#RateLimitBurst=10000
#SystemMaxUse=
#SystemKeepFree=
#SystemMaxFileSize=
#SystemMaxFiles=100
#MaxRetentionSec=0
#MaxFileSec=1month
#ForwardToSyslog=no${n === 1 ? '' : '\n\n# Retention policy (March 2031): 30 days.\nMaxRetentionSec=30day'}`;

// ——— Logs ———

const VISITORS = ['203.0.113.57', '198.51.100.83', '2001:db8:4a::17', '203.0.113.201', '198.51.100.9', '2001:db8:c0::5', '203.0.113.14', '198.51.100.140'];
const PAGES = ['/', '/concerts.html', '/join.html', '/', '/members/login', '/concerts.html'];
const AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clf = (ms: number) => {
  const x = new Date(ms);
  const summer = x.getUTCMonth() > 2 && x.getUTCMonth() < 9;
  return `${String(x.getUTCDate()).padStart(2, '0')}/${MONTHS[x.getUTCMonth()]}/${x.getUTCFullYear()}:${x.toISOString().slice(11, 19)} ${summer ? '+0200' : '+0100'}`;
};
const visitorLine = (seed: number, ms: number) =>
  `${VISITORS[seed % VISITORS.length]} - - [${clf(ms)}] "GET ${PAGES[seed % PAGES.length]} HTTP/1.1" 200 ${2100 + (seed % 7) * 311} "-" "${AGENTS[seed % AGENTS.length]}"`;

// The last weekly rotation (Sunday 2 March 2031, 00:00) and the first log (September 2027).
const LAST_ROTATION = Date.UTC(2031, 2, 2, 0, 0, 0);
export const FIRST_LOG = Date.UTC(2027, 8, 12, 0, 0, 0);
export const ARCHIVES = Math.floor((LAST_ROTATION - FIRST_LOG) / (7 * DAY));

const weekLines = (from: number, to: number, count: number) => Array.from({ length: count }, (_, i) => visitorLine(hash(`${from}-${i}`), from + ((to - from) * (i + 1)) / (count + 1)));

/** The first line of this week's access.log at chapter 1. */
export const todayFirstLine = () => weekLines(LAST_ROTATION, NOW[1] - 120_000, 8)[0];

/** A file's text, gzip or not. */
export const textOf = (n: Node | null | undefined): string => (n?.type === 'file' && typeof n.content === 'string' ? (unpack(n.content)?.text ?? n.content) : '');

/** The last three weeks of access logs (the policy's thirty days) are still somewhere in /var/log/nginx. */
export function recentKept(j: Game): boolean {
  const dir = j.find('/var/log/nginx');
  if (dir?.type !== 'directory') return false;
  // Addresses truncated by hand (sed) still count.
  const all = new Set(Object.values(dir.children).flatMap((n) => textOf(n).split('\n').map(truncated)));
  return [1, 2, 3].every((k) => {
    const end = LAST_ROTATION - (k - 1) * 7 * DAY;
    return all.has(truncated(weekLines(end - 7 * DAY, end, k === 1 ? 6 : 4)[0]));
  });
}

/** /var/log/nginx at chapter 1: access.log, access.log.1, then a gzipped week per file, since September 2027. */
function nginxLogs(n: ChapterNo): Record<string, Node> {
  const own: Rights = { owner: 'www-data', group: 'adm', mode: 'rw-r-----' };
  const lines = weekLines;
  if (n !== 1) {
    // After chapter 1: thirty daily files at most, the addresses truncated.
    const files: Record<string, Node> = { 'access.log': f(lines(NOW[n] - 9 * 3_600_000, NOW[n] - 60_000, 6).map(truncated).join('\n'), { lines: true, ...own, mtime: NOW[n] - 60_000 }), 'error.log': f('', { lines: true, ...own }) };
    for (let k = 1; k <= 29; k++) {
      const end = Math.floor(NOW[n] / DAY) * DAY - (k - 1) * DAY;
      const text = lines(end - DAY, end, 5).map(truncated).join('\n');
      files[`access.log.${k}${k === 1 ? '' : '.gz'}`] = k === 1 ? f(text, { lines: true, ...own, mtime: end, size: 61_000 }) : packedFile('gzip', text, { size: 61_000, mtime: end, ...own });
    }
    return files;
  }
  const files: Record<string, Node> = {
    'access.log': f(lines(LAST_ROTATION, NOW[1] - 120_000, 8).join('\n'), { lines: true, ...own, mtime: NOW[1] - 120_000 }),
    'access.log.1': f(lines(LAST_ROTATION - 7 * DAY, LAST_ROTATION, 6).join('\n'), { lines: true, ...own, mtime: LAST_ROTATION, size: 412_000 }),
    'error.log': f(`2031/03/03 21:14:09 [error] 812#812: *4411 open() "/var/www/choir/wp-login.php" failed (2: No such file or directory), client: 203.0.113.201, server: ${SITE}, request: "GET /wp-login.php HTTP/1.1", host: "${SITE}"`, { lines: true, ...own, mtime: Date.UTC(2031, 2, 3, 21, 14, 9) }),
  };
  for (let k = 2; k <= ARCHIVES; k++) {
    const end = LAST_ROTATION - (k - 1) * 7 * DAY;
    files[`access.log.${k}.gz`] = packedFile('gzip', lines(end - 7 * DAY, end, 4).join('\n'), { size: 380_000 + (hash(`w${k}`) % 90_000), mtime: end, ...own });
  }
  return files;
}

/** An address as the anonymised format writes it (the last byte of IPv4, all but two groups of IPv6). */
export const truncatedAddress = (a: string) => (a.includes(':') ? `${a.split(':').slice(0, 2).join(':')}::` : a.replace(/\.\d+$/, '.0'));
const truncated = (line: string) => line.replace(/^\S+/, (a) => truncatedAddress(a));

// The members' area's security log: one line per login or change.
const auditLine = (ms: number, m: Member, action: string, from: string) => `${new Date(ms).toISOString().slice(0, 19)}+01:00 member=${m.id} user=${m.email} action=${action} result=ok from=${from}`;

/** The audit log of a chapter: [current, previous months' archives (1 = last month)], each a list of lines. */
export function auditLogs(t: Translate, n: ChapterNo): string[][] {
  const all = members(t, n).filter((m) => !m.left);
  const months = 13;
  const out: string[][] = [];
  for (let k = 0; k < months; k++) {
    // Month k before the chapter's (0: the current month).
    const startDate = new Date(Date.UTC(2031, 2 - k + (n === 3 ? 1 : 0), 1));
    const start = startDate.getTime();
    const end = k === 0 ? NOW[n] - 3_600_000 : new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)).getTime();
    const lines: string[] = [];
    for (let i = 0; i < 6; i++) {
      const m = all[hash(`a${k}${i}${n}`) % all.length];
      if (m.id === PRIYA || m.id === TOMAS) continue;
      lines.push(auditLine(start + ((end - start) * (i + 1)) / 8, m, i % 3 === 2 ? 'profile-update' : 'login', truncatedAddress(VISITORS[(i + k) % VISITORS.length])));
    }
    out.push(lines);
  }
  // Priya's own lines (chapter 2): two logins and an address change this month, a login last month.
  if (n === 2) {
    const p = member(t, PRIYA, 2);
    out[0].splice(1, 0, auditLine(Date.UTC(2031, 2, 2, 19, 14, 7), p, 'login', '198.51.100.0'));
    out[0].splice(3, 0, auditLine(Date.UTC(2031, 2, 2, 19, 16, 52), p, 'profile-update field=address', '198.51.100.0'));
    out[0].push(auditLine(Date.UTC(2031, 2, 13, 8, 2, 31), p, 'login', '2001:db8:c0::'));
    out[1].splice(2, 0, auditLine(Date.UTC(2031, 1, 9, 20, 41, 3), p, 'login', '198.51.100.0'));
    out.forEach((l) => l.sort());
  }
  if (n === 3) {
    const tm = member(t, TOMAS, 3);
    out[0].splice(2, 0, auditLine(Date.UTC(2031, 3, 5, 10, 2, 11), tm, 'login', '203.0.113.0'));
    out[0].sort();
  }
  return out;
}

/** Priya's lines in the audit log and its last archive (chapter 2). */
export const priyaAudit = (t: Translate) =>
  auditLogs(t, 2)
    .flat()
    .filter((l) => l.includes(` member=${PRIYA} `));

/** /var/log/mail.log (chapters 2 and 3): the newsletters Postfix sent, and a few replies. */
export function mailLog(t: Translate, n: ChapterNo): string {
  const list = members(t, n).filter((m) => !m.left || m.id === TOMAS);
  const lines: string[] = [];
  const sends = n === 2 ? [Date.UTC(2031, 2, 3, 18, 0, 0), Date.UTC(2031, 2, 10, 18, 0, 0)] : [Date.UTC(2031, 2, 31, 18, 0, 0)];
  for (const s of sends)
    list.forEach((m, i) => {
      if (i % 3 !== 0 && m.id !== PRIYA && m.id !== TOMAS) return;
      const at = new Date(s + i * 2000);
      const stamp = `${MONTHS[at.getUTCMonth()]} ${String(at.getUTCDate()).padStart(2, ' ')} ${at.toISOString().slice(11, 19)}`;
      const queue = hex(`q${s}${m.id}`, 10).toUpperCase();
      lines.push(`${stamp} baton postfix/smtp[${4100 + i}]: ${queue}: to=<${m.email}>, relay=mx.mail.example[198.51.100.25]:25, delay=1.2, delays=0.1/0/0.6/0.5, dsn=2.0.0, status=sent (250 2.0.0 Ok: queued as ${hex(`r${s}${m.id}`, 6).toUpperCase()})`);
    });
  return lines.join('\n');
}

export const priyaMail = (t: Translate) =>
  mailLog(t, 2)
    .split('\n')
    .filter((l) => l.includes(member(t, PRIYA, 2).email));

/** Ruben's export for the phone tree (October 2030), forgotten in /srv/choir/exports. */
export const phoneTree = (t: Translate) => t('choir-phone-tree').replace(/^\n+|\s+$/g, '');

// ——— Uploads ———

// A photo and a consent form: binary files, the same in every game.
const bytes = (...codes: number[]) => String.fromCharCode(...codes);
const jpeg = (seed: string): File => ({ type: 'file', content: `${bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10)}JFIF${bytes(0, 1, 1, 0, 0, 1, 0, 1, 0, 0)}${hex(seed, 160)}${bytes(0xff, 0xd9)}`, charset: 'binary', size: 48_000 + (hash(seed) % 30_000), owner: 'choir', group: 'choir', mode: 'rw-r-----' });
const pdf = (seed: string): File => ({ type: 'file', content: `%PDF-1.7\n%${bytes(0xe2, 0xe3, 0xcf, 0xd3)}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${hex(seed, 120)}\n%%EOF`, charset: 'binary', size: 91_000 + (hash(seed) % 20_000), owner: 'choir', group: 'choir', mode: 'rw-r-----' });
export const photoOf = (id: string) => jpeg(`photo-${id}`);
export const consentOf = (id: string) => pdf(`consent-${id}`);

function uploads(t: Translate, n: ChapterNo): Directory {
  const dir = (children: Record<string, Node>) => d(children, undefined, { owner: 'choir', group: 'choir', mode: 'rwxr-x---' });
  const children: Record<string, Node> = {};
  for (const m of members(t, n)) {
    if (m.left && m.left < '2030-01-01') continue;
    if (hash(`up${m.id}`) % 3 === 0 && m.id !== PRIYA && m.id !== TOMAS) continue;
    children[m.id] = dir({ 'photo.jpg': photoOf(m.id), 'consent-form.pdf': consentOf(m.id) });
  }
  return dir(children);
}

// ——— Backups (chapter 3): the nightly dump, and a restic snapshot every Sunday since September 2029 ———

export const BACKUP_SCRIPT = `#!/bin/sh
# Weekly backup of the choir's server (Ruben, 2029).
set -e
export RESTIC_REPOSITORY=${REPO}
export RESTIC_PASSWORD_FILE=/root/.restic-pass
sudo -u postgres pg_dump choir > ${DUMP}
restic backup ${DUMP} ${UPLOADS}
echo "$(date -Is) backup done"`;

export const PURGE_SCRIPT = (t: Translate) => `#!/bin/sh
# ${t('choir-purge-comment')}
# TODO attendance (2 years)
psql choir -c "DELETE FROM members WHERE left_on < current_date - interval '2 years'"`;

export const PURGE_SERVICE = `[Unit]
Description=Purge the choir's expired personal data

[Service]
Type=oneshot
User=www-data
ExecStart=${PURGE}`;

export const PURGE_TIMER = `[Unit]
Description=Purge the choir's expired personal data every night

[Timer]
OnCalendar=*-*-* 03:30:00

[Install]
WantedBy=timers.target`;

const BACKUP_SERVICE = `[Unit]
Description=Weekly backup of the choir's server

[Service]
Type=oneshot
ExecStart=${BACKUP}`;

const BACKUP_TIMER = `[Unit]
Description=Weekly backup of the choir's server

[Timer]
OnCalendar=Sun *-*-* 02:00:00

[Install]
WantedBy=timers.target`;

export const RESTIC_PASSWORD = 'k7Rw2pXq9LmZ4vTn-baton';
/** The Sundays the backup ran (from 2 September 2029 to 6 April 2031). */
export const backupSundays = () => {
  const out: number[] = [];
  for (let ms = Date.UTC(2029, 8, 2, 2, 0, 41); ms < NOW[3]; ms += 7 * DAY) out.push(ms);
  return out;
};

export function choirRepo(t: Translate): Repo {
  const host = machineName(t, 'baton');
  const repo: Repo = { id: hex('choir-repository-2029'), password: RESTIC_PASSWORD, snapshotList: [], packs: [], checked: true, pruneNeeded: false };
  repo.keys = [{ id: hex('choir-key-ruben'), password: RESTIC_PASSWORD, user: 'root', host, created: Date.UTC(2029, 8, 1, 21, 12, 0) }];
  const tomas = member(t, TOMAS, 3);
  for (const time of backupSundays()) {
    const files: Snapshot['files'] = {
      [DUMP]: { content: `-- PostgreSQL database dump (choir) ${iso(time)}`, size: 1_400_000 + Math.floor((time - Date.UTC(2029, 8, 1)) / DAY) * 900, modified: time - 30_000 },
    };
    for (const m of members(t, 3)) {
      if (m.joined > iso(time) || (m.left && m.left < '2030-01-01')) continue;
      if (m.id !== tomas.id && m.id !== PRIYA && hash(`up${m.id}`) % 3 === 0) continue;
      files[`${UPLOADS}/${m.id}/photo.jpg`] = { content: `photo-${m.id}`, size: 48_000 + (hash(`photo-${m.id}`) % 30_000), modified: Date.parse(`${m.joined}T12:00:00Z`) };
    }
    addSnapshot(repo, { id: hex(`choir-snapshot-${time}`), time, host, paths: [DUMP, UPLOADS], files });
  }
  repo.checked = true;
  return repo;
}

// ——— The machine ———

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.4, command });

function services(): Record<string, DefinitionService> {
  return {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] },
    'systemd-journald': { description: 'Journal Service', active: true, executable: 'systemd-journald', modelled: true, process: [proc(301, 'root', '/lib/systemd/systemd-journald')] },
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      process: [proc(812, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'), proc(813, 'www-data', 'nginx: worker process')],
      check: (j) => checkNginx(j),
      checkToReload: true,
      load: (j) => loadNginx(j),
    },
    'choir-app': { description: 'Riverside Community Choir members area', active: true, executable: 'gunicorn', process: [proc(902, 'choir', '/srv/choir/venv/bin/python3 /srv/choir/venv/bin/gunicorn -b 127.0.0.1:8000 choir.wsgi')] },
    postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres', process: [proc(742, 'postgres', '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main')] },
    postfix: { description: 'Postfix Mail Transport Agent', active: true, executable: 'master', process: [proc(1012, 'root', '/usr/lib/postfix/sbin/master -w')] },
  };
}

/** baton's state at the start of a chapter. */
export function choirState(t: Translate, n: ChapterNo) {
  return {
    systemd: newSystemd(machineName(t, 'baton'), BOOT, NOW[n], services()),
    nginx: { load: null, names: ['localhost', '127.0.0.1', SITE, DOMAIN], accessLog: true },
    postgres: { bases: { choir: { owner: 'choir', tables: choirTables(t, n) } }, roles: ['postgres', 'choir'], archives: {} },
    restic: n === 3 ? { [REPO]: choirRepo(t) } : {},
    resticClock: NOW[n],
    apps: { '127.0.0.1:8000': { service: 'choir-app', pages: { '/login': t('choir-page-login') } } },
    choir: { chapter: n, visits: 0 },
    mounts: [{ path: '/', capacity: 80 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
  };
}

/** At the start: nginx's and journald's configuration loaded, the hand-written units read, the timers' state. */
export function initialiseChoir(j: Game, n: ChapterNo) {
  const s = sd(j);
  loadNginx(j);
  s.services['systemd-journald'].load = startJournald;
  j.state.journalLimit = null;
  j.state.journalRetention = maxRetention(j);
  j.state.logrotateState = Object.fromEntries(['/var/log/nginx/access.log', '/var/log/nginx/error.log', AUDIT].map((p) => [p, n === 1 ? LAST_ROTATION : Math.floor(NOW[n] / DAY) * DAY]));
  if (n === 3) {
    loadUnits(j as Shell, s);
    loadOverrides(j as Shell, s);
    const backup = s.timers?.['choir-backup'];
    if (backup) Object.assign(backup, { active: true, state: 'active', last: backupSundays().at(-1) });
  }
}

/** Each command: half a minute, and a visitor or two on the site (chapter 1). */
export function passTime(j: Game) {
  const s = sd(j);
  const state = j.state.choir as { chapter: ChapterNo; visits: number };
  s.clock += 30_000;
  if (state.chapter !== 1) return;
  for (let i = 0; i < 2; i++) {
    const k = state.visits++;
    httpRequest(j, SITE, PAGES[k % PAGES.length], 80, true, { address: VISITORS[k % VISITORS.length], time: s.clock - 15_000 + i * 7000, agent: AGENTS[k % AGENTS.length] });
  }
}

// ——— The world ———

const root: Rights = { owner: 'root' };
const place = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });

function journalDir(n: ChapterNo): Directory {
  const files: Record<string, Node> = {};
  const M = 1024 * 1024;
  // A file a month since September 2027 (chapter 1); thirty days after.
  const months = n === 1 ? 42 : 1;
  for (let i = 0; i < months; i++) {
    const at = n === 1 ? Date.UTC(2027, 8 + i, 28, 4, 0, 0) : NOW[n] - 12 * DAY;
    const us = BigInt(at) * 1000n;
    files[`system@${MACHINE_ID}-${(0x51c2a0n + BigInt(i) * 0x3e8n).toString(16).padStart(16, '0')}-${us.toString(16).padStart(16, '0')}.journal`] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 64 * M + (hash(`j${i}`) % 40) * M });
  }
  files['system.journal'] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 40 * M });
  files['user-1000.journal'] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 8 * M });
  return d({ [MACHINE_ID]: d(files, undefined, { owner: 'root', group: 'systemd-journal', mode: 'rwxr-sr-x' }) }, undefined, { owner: 'root', group: 'systemd-journal', mode: 'rwxr-sr-x' });
}

/** /var/log/choir: the audit log and its monthly archives (gzipped, the last one too: no delaycompress). */
function choirLogs(t: Translate, n: ChapterNo): Directory {
  const own: Rights = { owner: 'choir', group: 'adm', mode: 'rw-r-----' };
  const logs = auditLogs(t, n);
  const children: Record<string, Node> = { 'audit.log': f(logs[0].join('\n'), { lines: true, ...own, mtime: NOW[n] - 3_600_000 }) };
  logs.slice(1).forEach((lines, k) => {
    const first = new Date(Date.UTC(2031, 2 - k + (n === 3 ? 1 : 0), 1)).getTime();
    children[`audit.log.${k + 1}.gz`] = packedFile('gzip', lines.join('\n'), { size: 52_000 + (hash(`au${k}`) % 9000), mtime: first, ...own });
  });
  return d(children, undefined, { owner: 'choir', group: 'adm', mode: 'rwxr-x---' });
}

/** The archives of the audit log chapter 1 starts with, and their dates (the policy keeps 12 months). */
export const auditArchives = () => Array.from({ length: 12 }, (_, k) => ({ name: `audit.log.${k + 1}.gz`, mtime: new Date(Date.UTC(2031, 2 - k, 1)).getTime() }));

export function choirWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const host = machineName(t, 'baton');
  const key = generateKey('choir-baton', `you@${host}`);
  const tables = choirTables(t, n);
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${ADDRESS}\t${host}.${DOMAIN} ${host}\n::1\tlocalhost ip6-localhost ip6-loopback`),
      nginx: place({
        'nginx.conf': file(nginxConf(n)),
        'mime.types': file(MIME),
        'conf.d': place(n === 1 ? {} : { 'anonymise.conf': file(ANONYMISE_CONF) }),
        'modules-enabled': place({}),
        'sites-available': place({ choir: file(SITE_CONF) }),
        'sites-enabled': place({ choir: f('', { owner: 'root', link: '/etc/nginx/sites-available/choir' }) }),
      }),
      'logrotate.conf': file(LOGROTATE_CONF),
      'logrotate.d': place({ nginx: file(nginxRotate(n)), choir: file(CHOIR_ROTATE) }),
      systemd: place({
        'journald.conf': file(journaldConf(n)),
        system: place(
          n === 3
            ? {
                'choir-purge.service': file(PURGE_SERVICE),
                'choir-purge.timer': file(PURGE_TIMER),
                'choir-backup.service': file(BACKUP_SERVICE),
                'choir-backup.timer': file(BACKUP_TIMER),
              }
            : {},
        ),
      }),
    }),
    home: place({
      you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }),
    }),
    root: place(n === 3 ? { '.restic-pass': f(RESTIC_PASSWORD, { lines: true, owner: 'root', group: 'root', mode: 'rw-------' }) } : {}, { owner: 'root', mode: 'rwx------' }),
    srv: place({
      choir: place(
        {
          docs: place({ [name(t, 'retention-policy.txt')]: file(t('choir-policy'), { owner: 'choir', group: 'choir', mode: 'rw-r--r--' }) }, { owner: 'choir', group: 'choir', mode: 'rwxr-xr-x' }),
          uploads: uploads(t, n),
          ...(n === 2 ? { exports: place({ 'phone-tree-2030-10.csv': file(phoneTree(t), { owner: 'choir', group: 'choir', mode: 'rw-r-----' }) }, { owner: 'choir', group: 'choir', mode: 'rwxr-x---' }) } : {}),
          ...(n === 2 ? { [name(t, 'gdpr-requests')]: place({}, { owner: 'you', group: 'choir', mode: 'rwxr-x---' }) } : {}),
        },
        { owner: 'choir', group: 'choir', mode: 'rwxr-xr-x' },
      ),
    }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({
      sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }),
      local: place({
        sbin: place(
          n === 3
            ? {
                'choir-purge': file(PURGE_SCRIPT(t), { owner: 'root', mode: 'rwxr-xr-x' }),
                'choir-backup': file(BACKUP_SCRIPT, { owner: 'root', mode: 'rwx------' }),
              }
            : {},
        ),
      }),
    }),
    var: place({
      backups: place(n === 1 ? {} : { 'choir.sql': file(dumpSql('choir', tables, 'choir'), { owner: 'root', group: 'root', mode: 'rw-------' }), ...(n === 3 ? { restic: place({}, { owner: 'root', mode: 'rwx------' }) } : {}) }),
      log: place({
        nginx: place(nginxLogs(n), { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' }),
        choir: choirLogs(t, n),
        journal: journalDir(n),
        ...(n === 1 ? {} : { 'mail.log': file(mailLog(t, n), { owner: 'root', group: 'adm', mode: 'rw-r-----' }) }),
      }),
      www: place({
        choir: place(
          {
            'index.html': file(t('choir-page-index'), { owner: 'www-data', group: 'www-data' }),
            'concerts.html': file(t('choir-page-concerts'), { owner: 'www-data', group: 'www-data' }),
            'join.html': file(t('choir-page-join'), { owner: 'www-data', group: 'www-data' }),
          },
          { owner: 'www-data', group: 'www-data', mode: 'rwxr-xr-x' },
        ),
      }),
    }),
  });
}

/** Writes the restic repository's files on disk once the state exists (chapter 3). */
export function writeChoirRepo(j: Game) {
  const n = j.find(REPO);
  const repo = j.state.restic?.[REPO] as Repo | undefined;
  if (n?.type === 'directory' && repo) n.children = repoChildren(repo);
}

// ——— What the chapters check ———

/** The retention logrotate gives /var/log/nginx/access.log (days), as the files in /etc/logrotate.d read now. */
export function accessRetention(j: Game): number | null {
  const s = j as Shell;
  const errors: string[] = [];
  const blocks = readConfig(s, '/etc/logrotate.conf', errors);
  const block = blocks.filter((b) => b.patterns.some((p) => p === ACCESS || (p.startsWith('/var/log/nginx/') && new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '.')}$`).test(ACCESS)))).at(-1);
  if (!block) return null;
  const period = PERIODS[block.period ?? 'weekly'] / DAY;
  const byCount = (block.rotation + 1) * period;
  const byAge = block.maxAge !== null ? block.maxAge + period : Infinity;
  return Math.min(byCount, byAge);
}

/** The files of /var/log/nginx whose last line is older than `days` days (find -mtime +days). */
export const oldNginxFiles = (j: Game, days = 30) => {
  const dir = j.find('/var/log/nginx');
  if (dir?.type !== 'directory') return [];
  return Object.entries(dir.children)
    .filter(([, n]) => n.type === 'file' && (n as File).mtime !== undefined && (n as File).mtime! < clock(j) - (days + 1) * DAY)
    .map(([k]) => k);
};

/** The audit archives younger than twelve months that are no longer there. */
export const auditLost = (j: Game) => auditArchives().filter((a) => a.mtime >= clock(j) - 365 * DAY && !j.find(`/var/log/choir/${a.name}`));

/** What the loaded nginx writes for a visitor's request: the lines of its access logs. */
export const wouldLog = (j: Game, address: string) => accessLines(j, { address, time: clock(j), agent: AGENTS[0] }, SITE, '/', 80, { code: 200, body: 'x' }).map(([, l]) => l);

export const loaded = (j: Game): Configuration | null => j.state.nginx?.load ?? null;

/** The journal's archived files older than 31 days. */
export const oldJournals = (j: Game) => journalFiles(j).filter((x) => x.archived && x.time < clock(j) - 31 * DAY);

// ——— The restic policy of the backup script, as it will run ———

/** The forget line of a script (with its options) and whether the data is pruned too. */
export function forgetPolicy(text: string): { policy: Record<string, number>; within?: ReturnType<typeof readWithin> & { text: string }; prune: boolean } | null {
  const line = text.split('\n').find((l) => /^\s*[^#]*\brestic\b.*\bforget\b/.test(l));
  if (!line) return null;
  const words = line.trim().split(/\s+/);
  const policy: Record<string, number> = {};
  let within: (ReturnType<typeof readWithin> & { text: string }) | undefined;
  words.forEach((w, i) => {
    const m = /^--keep-(last|hourly|daily|weekly|monthly|yearly|within)(?:=(.*))?$/.exec(w);
    if (!m) return;
    const v = m[2] ?? words[i + 1] ?? '';
    if (m[1] === 'within') {
      const r = readWithin(v);
      if (r) within = { ...r, text: v };
    } else if (/^\d+$/.test(v)) policy[m[1]] = Number(v);
  });
  const prune = words.includes('--prune') || text.split('\n').some((l) => /^\s*[^#]*\brestic\b.*\bprune\b/.test(l) && !/forget/.test(l));
  return { policy, within, prune };
}

/** What a policy keeps after two years of weekly backups: how many snapshots, and the oldest one's age (days). */
export function policyOutcome(p: NonNullable<ReturnType<typeof forgetPolicy>>): { kept: number; oldest: number } {
  const start = Date.UTC(2031, 3, 13, 2, 0, 0);
  const list: Snapshot[] = Array.from({ length: 104 }, (_, i) => ({ id: `s${i}`, time: start + i * 7 * DAY, host: 'baton', paths: [], files: {} }));
  const reasons = applyPolicy(list, p.policy, p.within ?? undefined);
  const kept = list.filter((s) => reasons.has(s.id));
  const last = list.at(-1)!.time;
  return { kept: kept.length, oldest: kept.length ? (last - Math.min(...kept.map((s) => s.time))) / DAY : 0 };
}
